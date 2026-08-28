import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};
const DEFAULT_PUBLIC_ORIGIN = "https://anunciomlbr.lovable.app";

const schema = z.object({
  plan_id: z.string().uuid(),
  period: z.enum(["monthly", "quarterly", "semiannual", "annual"]),
  coupon_code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});

/** Cria uma preferência real no Mercado Pago; nunca simula aprovação ou pedido offline. */
export const createMercadoPagoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim();

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
    let amountCents = Math.round(plan.price_monthly_cents * months * (1 - percent / 100));

    let coupon: { code: string; discount_percent: number } | null = null;
    if (data.coupon_code) {
      const { resolveCoupon } = await import("@/lib/coupons.server");
      const result = await resolveCoupon(data.coupon_code);
      if (result.ok) {
        coupon = { code: result.code, discount_percent: result.discount_percent };
        amountCents = Math.max(Math.round(amountCents * (1 - result.discount_percent / 100)), 100);
      }
    }

    if (!accessToken) {
      return {
        configured: false as const,
        payment_id: null,
        amount_cents: amountCents,
        checkout_url: null,
        reason: "Mercado Pago ainda não está configurado no servidor.",
      };
    }

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
        raw: coupon ? ({ coupon } as never) : null,
      })
      .select("id")
      .single();
    if (paymentError) throw new Error("Não foi possível registrar o pagamento.");

    const origin = (process.env["APP_PUBLIC_URL"]?.trim() || DEFAULT_PUBLIC_ORIGIN).replace(/\/$/, "");
    const successUrl = `${origin}/checkout/success?payment_id=${payment.id}`;
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
        metadata: {
          payment_id: payment.id,
          user_id: context.userId,
          plan_id: plan.id,
          coupon_code: coupon?.code ?? null,
        },
        notification_url: `${origin}/api/public/webhooks/mercadopago`,
        back_urls: {
          success: successUrl,
          pending: successUrl,
          failure: `${origin}/checkout`,
        },
        auto_return: "approved",
      }),
    });

    if (!response.ok) {
      const providerError = await response.text().catch(() => "");
      console.error("Mercado Pago preference failed", response.status, providerError.slice(0, 500));
      await supabaseAdmin
        .from("payments")
        .update({ raw: { checkout_error_status: response.status } as never })
        .eq("id", payment.id);
      return {
        configured: true as const,
        payment_id: payment.id,
        amount_cents: amountCents,
        checkout_url: null,
        reason: "O Mercado Pago não conseguiu iniciar o checkout agora.",
      };
    }

    const preference = (await response.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
    };
    const checkoutUrl = preference.init_point ?? preference.sandbox_init_point ?? null;
    if (!checkoutUrl) {
      return {
        configured: true as const,
        payment_id: payment.id,
        amount_cents: amountCents,
        checkout_url: null,
        reason: "O Mercado Pago não retornou o endereço do checkout.",
      };
    }

    if (preference.id) {
      await supabaseAdmin.from("payments").update({ provider_ref: preference.id }).eq("id", payment.id);
    }

    return {
      configured: true as const,
      payment_id: payment.id,
      amount_cents: amountCents,
      checkout_url: checkoutUrl,
      reason: null,
    };
  });

/** Resumo real do pedido para a página de sucesso (apenas o próprio dono). */
export const getCheckoutSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ payment_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: payment, error } = await context.supabase
      .from("payments")
      .select("id, status, amount_cents, period, created_at, plan_id, plans(name, code)")
      .eq("id", data.payment_id)
      .maybeSingle();
    if (error || !payment) throw new Error("Pedido não encontrado.");

    const { data: license } = await context.supabase
      .from("licenses")
      .select("code, status, expires_at")
      .eq("note", `payment:${payment.id}`)
      .maybeSingle();

    return {
      id: payment.id,
      status: payment.status,
      amount_cents: payment.amount_cents,
      period: payment.period,
      created_at: payment.created_at,
      plan_name: (payment as { plans?: { name?: string } }).plans?.name ?? "Plano",
      license: license ?? null,
    };
  });

/** Confirma o pagamento na API do Mercado Pago e emite a licença somente quando aprovado. */
export const confirmCheckoutPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ payment_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: payment } = await context.supabase
      .from("payments")
      .select("id, status")
      .eq("id", data.payment_id)
      .maybeSingle();
    if (!payment) throw new Error("Pedido não encontrado.");

    if (payment.status === "approved") {
      const { issueLicenseForPayment } = await import("@/lib/licensing.server");
      const issued = await issueLicenseForPayment(payment.id);
      return {
        status: "approved" as string,
        license_code: issued.ok ? issued.license_code : null,
      };
    }

    const { syncPaymentWithMercadoPago } = await import("@/lib/licensing.server");
    const result = await syncPaymentWithMercadoPago(payment.id);
    return { status: result.status ?? payment.status, license_code: result.license_code };
  });
