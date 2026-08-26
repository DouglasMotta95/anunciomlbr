import { createHmac, timingSafeEqual } from "node:crypto";

import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook oficial do Mercado Pago.
 * Confirmamos o pagamento consultando a API do provedor com o access token do
 * servidor — nunca confiamos apenas no corpo recebido — e só então geramos a
 * licença correspondente.
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

function isValidMercadoPagoSignature(request: Request, dataId: string, secret: string) {
  const requestId = request.headers.get("x-request-id");
  const { ts, v1 } = parseSignature(request.headers.get("x-signature"));
  if (!requestId || !ts || !v1) return false;

  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp)) return false;
  const maxAgeMs = 10 * 60 * 1000;
  if (Math.abs(Date.now() - timestamp) > maxAgeMs) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const received = Buffer.from(v1, "hex");
  const calculated = Buffer.from(expected, "hex");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];
        const webhookSecret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
        if (!accessToken) {
          return json({ ok: false, reason: "not_configured" }, 503);
        }

        let payload: { data?: { id?: string | number }; type?: string; action?: string };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const paymentId = payload.data?.id;
        if (!paymentId) return new Response("ignored", { status: 200 });
        // Com secret configurado, exigimos a assinatura HMAC do Mercado Pago.
        // Sem secret, o status ainda é confirmado consultando a API oficial do
        // Mercado Pago com o nosso access token — nunca confiamos no corpo.
        if (webhookSecret && !isValidMercadoPagoSignature(request, String(paymentId), webhookSecret)) {
          return json({ ok: false, reason: "invalid_signature" }, 401);
        }


        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!mpResponse.ok) {
          console.error("Mercado Pago lookup failed", mpResponse.status);
          return new Response("lookup failed", { status: 502 });
        }

        const mpPayment = (await mpResponse.json()) as {
          status?: string;
          external_reference?: string;
          metadata?: { payment_id?: string; user_id?: string; plan_id?: string };
        };

        const internalId = mpPayment.external_reference ?? mpPayment.metadata?.payment_id;
        if (!internalId) return new Response("no reference", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("*, plans(code)")
          .eq("id", internalId)
          .maybeSingle();
        if (!payment) return new Response("unknown payment", { status: 200 });

        await supabaseAdmin
          .from("payments")
          .update({
            status: mpPayment.status ?? "unknown",
            provider_ref: String(paymentId),
            raw: mpPayment as never,
          })
          .eq("id", payment.id);

        if (mpPayment.status !== "approved") {
          return json({ ok: true, status: mpPayment.status });
        }

        // Evita licença duplicada para o mesmo pagamento.
        const { data: existing } = await supabaseAdmin
          .from("licenses")
          .select("id")
          .eq("note", `payment:${payment.id}`)
          .maybeSingle();
        if (existing) return json({ ok: true, deduped: true });

        const months: Record<string, number> = {
          monthly: 1,
          quarterly: 3,
          semiannual: 6,
          annual: 12,
        };
        const startsAt = new Date();
        const expiresAt = new Date(startsAt);
        expiresAt.setMonth(expiresAt.getMonth() + (months[payment.period] ?? 1));

        const { data: code } = await supabaseAdmin.rpc("generate_license_code", {
          _plan_code: payment.plans?.code ?? "pro",
        });

        const { error: licenseError } = await supabaseAdmin.from("licenses").insert({
          code: code as string,
          plan_id: payment.plan_id,
          period: payment.period,
          origin: "mercado_pago",
          status: payment.user_id ? "active" : "available",
          user_id: payment.user_id,
          activated_at: payment.user_id ? startsAt.toISOString() : null,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          note: `payment:${payment.id}`,
        });
        if (licenseError) {
          if (licenseError.code === "23505") return json({ ok: true, deduped: true });
          console.error("Mercado Pago license insert failed", licenseError.message);
          return json({ ok: false, reason: "license_failed" }, 500);
        }

        const couponCode = (payment.raw as { coupon?: { code?: string } } | null)?.coupon?.code;
        if (couponCode) {
          const { consumeCoupon } = await import("@/lib/coupons.server");
          await consumeCoupon(couponCode);
        }

        if (payment.user_id) {
          await supabaseAdmin.from("activity_events").insert({
            user_id: payment.user_id,
            kind: "payment_approved",
            message: "Pagamento aprovado e licença liberada",
            meta: { payment_id: payment.id },
          });
        }

        return json({ ok: true });
      },
    },
  },
});
