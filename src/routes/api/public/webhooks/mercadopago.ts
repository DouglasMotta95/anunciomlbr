import { createHmac, timingSafeEqual } from "node:crypto";

import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook oficial do Mercado Pago.
 * A assinatura é obrigatória e, mesmo depois dela, o pagamento é relido na API
 * oficial antes de qualquer licença ser emitida.
 */
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseSignature(header: string | null) {
  const parts = new Map<string, string>();
  for (const segment of (header ?? "").split(",")) {
    const [key, value] = segment.split("=").map((part) => part?.trim());
    if (key && value) parts.set(key, value);
  }
  return { ts: parts.get("ts") ?? null, v1: parts.get("v1") ?? null };
}

function normalizeSignatureDataId(value: string) {
  return /[a-z]/i.test(value) ? value.toLowerCase() : value;
}

function isValidMercadoPagoSignature(request: Request, dataId: string, secret: string) {
  const requestId = request.headers.get("x-request-id")?.trim();
  const { ts, v1 } = parseSignature(request.headers.get("x-signature"));
  if (!requestId || !ts || !v1 || !/^[a-f0-9]{64}$/i.test(v1)) return false;

  const rawTimestamp = Number(ts);
  if (!Number.isFinite(rawTimestamp) || rawTimestamp <= 0) return false;
  // A documentação do Mercado Pago possui exemplos em 10 e 13 dígitos.
  const timestampMs = rawTimestamp < 1_000_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;
  const maxAgeMs = 10 * 60 * 1000;
  if (Math.abs(Date.now() - timestampMs) > maxAgeMs) return false;

  const manifest = `id:${normalizeSignatureDataId(dataId)};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const received = Buffer.from(v1, "hex");
  const calculated = Buffer.from(expected, "hex");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim();
        const webhookSecret = process.env["MERCADOPAGO_WEBHOOK_SECRET"]?.trim();
        if (!accessToken || !webhookSecret) {
          console.error("Mercado Pago webhook blocked: secure webhook configuration incomplete");
          return json({ ok: false, reason: "not_configured" }, 503);
        }

        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          return json({ ok: false, reason: "unsupported_media_type" }, 415);
        }

        let payload: { data?: { id?: string | number }; type?: string; action?: string };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ ok: false, reason: "invalid_json" }, 400);
        }

        const url = new URL(request.url);
        const payloadId = payload.data?.id != null ? String(payload.data.id) : null;
        const queryId = url.searchParams.get("data.id");
        const paymentId = (queryId ?? payloadId)?.trim() ?? "";
        if (!/^\d{1,32}$/.test(paymentId)) {
          return json({ ok: false, reason: "invalid_payment_id" }, 400);
        }

        if (!isValidMercadoPagoSignature(request, paymentId, webhookSecret)) {
          return json({ ok: false, reason: "invalid_signature" }, 401);
        }

        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          },
        );
        if (!mpResponse.ok) {
          console.error("Mercado Pago lookup failed", mpResponse.status);
          return json({ ok: false, reason: "lookup_failed" }, 502);
        }

        const mpPayment = (await mpResponse.json()) as {
          id?: string | number;
          status?: string;
          external_reference?: string;
          transaction_amount?: number;
          currency_id?: string;
          metadata?: { payment_id?: string; user_id?: string; plan_id?: string };
        };

        if (mpPayment.id != null && String(mpPayment.id) !== paymentId) {
          return json({ ok: false, reason: "provider_id_mismatch" }, 409);
        }

        const internalId = (mpPayment.external_reference ?? mpPayment.metadata?.payment_id)?.trim();
        if (!internalId || !/^[0-9a-f-]{36}$/i.test(internalId)) {
          return json({ ok: false, reason: "invalid_reference" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: payment, error: paymentError } = await supabaseAdmin
          .from("payments")
          .select("id,user_id,plan_id,amount_cents,status")
          .eq("id", internalId)
          .maybeSingle();

        if (paymentError) {
          console.error("Mercado Pago internal payment lookup failed", paymentError.message);
          return json({ ok: false, reason: "internal_lookup_failed" }, 500);
        }
        if (!payment) return json({ ok: false, reason: "unknown_payment" }, 404);

        const providerAmountCents =
          typeof mpPayment.transaction_amount === "number"
            ? Math.round(mpPayment.transaction_amount * 100)
            : null;
        if (providerAmountCents == null || providerAmountCents !== payment.amount_cents) {
          console.error("Mercado Pago amount mismatch", { paymentId, internalId });
          return json({ ok: false, reason: "amount_mismatch" }, 409);
        }
        if (mpPayment.currency_id && mpPayment.currency_id !== "BRL") {
          return json({ ok: false, reason: "currency_mismatch" }, 409);
        }
        if (
          mpPayment.metadata?.user_id &&
          payment.user_id &&
          mpPayment.metadata.user_id !== payment.user_id
        ) {
          return json({ ok: false, reason: "user_mismatch" }, 409);
        }
        if (
          mpPayment.metadata?.plan_id &&
          payment.plan_id &&
          mpPayment.metadata.plan_id !== payment.plan_id
        ) {
          return json({ ok: false, reason: "plan_mismatch" }, 409);
        }

        await supabaseAdmin
          .from("payments")
          .update({
            status: mpPayment.status ?? "unknown",
            provider_ref: paymentId,
            raw: mpPayment as never,
          })
          .eq("id", payment.id);

        if (mpPayment.status !== "approved") {
          return json({ ok: true, status: mpPayment.status });
        }

        const { issueLicenseForPayment } = await import("@/lib/licensing.server");
        const issued = await issueLicenseForPayment(payment.id);
        if (!issued.ok) {
          return json(
            { ok: false, reason: issued.reason },
            issued.reason === "license_failed" ? 500 : 200,
          );
        }

        return json({ ok: true, created: issued.created });
      },
    },
  },
});
