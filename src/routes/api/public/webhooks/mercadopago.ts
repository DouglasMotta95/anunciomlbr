import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook oficial do Mercado Pago.
 * Confirmamos o pagamento consultando a API do provedor com o access token do
 * servidor — nunca confiamos apenas no corpo recebido — e só então geramos a
 * licença correspondente.
 */
export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];
        if (!accessToken) {
          return new Response(JSON.stringify({ ok: false, reason: "not_configured" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }

        let payload: { data?: { id?: string | number }; type?: string; action?: string };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const paymentId = payload.data?.id;
        if (!paymentId) return new Response("ignored", { status: 200 });

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
          return new Response(JSON.stringify({ ok: true, status: mpPayment.status }), {
            headers: { "content-type": "application/json" },
          });
        }

        // Evita licença duplicada para o mesmo pagamento.
        const { data: existing } = await supabaseAdmin
          .from("licenses")
          .select("id")
          .eq("note", `payment:${payment.id}`)
          .maybeSingle();
        if (existing) return new Response(JSON.stringify({ ok: true, deduped: true }));

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

        await supabaseAdmin.from("licenses").insert({
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

        if (payment.user_id) {
          await supabaseAdmin.from("activity_events").insert({
            user_id: payment.user_id,
            kind: "payment_approved",
            message: "Pagamento aprovado e licença liberada",
            meta: { payment_id: payment.id },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
