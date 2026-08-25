import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

const schema = z.object({
  plan_id: z.string().uuid(),
  period: z.enum(["monthly", "quarterly", "semiannual", "annual"]),
});

/**
 * Cria a preferência de pagamento no Mercado Pago (checkout oficial).
 * Sem o token de acesso configurado, retornamos "configuração pendente" —
 * nunca simulamos um pagamento aprovado.
 */
export const createMercadoPagoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];

    const { data: plan, error: planError } = await context.supabase
      .from("plans")
      .select("*")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (planError || !plan) throw new Error("Plano não encontrado.");

    const { data: discount } = await context.supabase
      .from("period_discounts")
      .select("*")
      .eq("period", data.period)
      .maybeSingle();

    const months = discount?.months ?? PERIOD_MONTHS[data.period] ?? 1;
    const percent = Number(discount?.discount_percent ?? 0);
    const amountCents = Math.round(plan.price_monthly_cents * months * (1 - percent / 100));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        plan_id: plan.id,
        period: data.period,
        amount_cents: amountCents,
        provider: "mercado_pago",
        status: "pending",
      })
      .select("id")
      .single();
    if (paymentError) throw new Error("Não foi possível registrar o pagamento.");

    if (!accessToken) {
      return {
        configured: false as const,
        payment_id: payment.id,
        amount_cents: amountCents,
        checkout_url: null,
      };
    }

    const origin = process.env["APP_PUBLIC_URL"] ?? "";
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: `ANÚNCIO ML ${plan.name} — ${months} ${months > 1 ? "meses" : "mês"}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: amountCents / 100,
          },
        ],
        external_reference: payment.id,
        metadata: { payment_id: payment.id, user_id: context.userId, plan_id: plan.id },
        notification_url: origin ? `${origin}/api/public/webhooks/mercadopago` : undefined,
        back_urls: origin
          ? {
              success: `${origin}/licenca`,
              pending: `${origin}/licenca`,
              failure: `${origin}/checkout`,
            }
          : undefined,
      }),
    });

    if (!response.ok) {
      console.error("Mercado Pago preference failed", response.status, await response.text());
      return {
        configured: true as const,
        payment_id: payment.id,
        amount_cents: amountCents,
        checkout_url: null,
      };
    }

    const preference = (await response.json()) as { init_point?: string; sandbox_init_point?: string };
    return {
      configured: true as const,
      payment_id: payment.id,
      amount_cents: amountCents,
      checkout_url: preference.init_point ?? preference.sandbox_init_point ?? null,
    };
  });
