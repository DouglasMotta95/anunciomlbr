import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function hasMainLicense(db: any, userId: string) {
  const { data } = await db
    .from("licenses")
    .select("id,expires_at,plans!inner(kind)")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .limit(20);
  return (data ?? []).some((row: any) => !["ad_package", "ai_package"].includes(row?.plans?.kind));
}

export const getExtraAiPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ getAiQuota }, eligible, packagesResult] = await Promise.all([
      import("@/lib/ai-quota.server"),
      hasMainLicense(context.supabase, context.userId),
      context.supabase
        .from("plans")
        .select("id,code,name,tagline,price_monthly_cents,ai_credits,badge,highlighted")
        .eq("active", true)
        .eq("kind", "ai_package")
        .order("sort_order"),
    ]);
    if (packagesResult.error) throw new Error("Não foi possível carregar os pacotes de IA.");
    const quota = await getAiQuota(context.userId);
    return {
      eligible,
      quota: {
        total: quota.credit_limit,
        used: quota.used,
        remaining: quota.remaining,
      },
      packages: packagesResult.data ?? [],
    };
  });

export const createExtraAiCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ package_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    if (!(await hasMainLicense(context.supabase, context.userId))) {
      throw new Error("Créditos extras de IA estão disponíveis apenas para clientes com plano ativo.");
    }

    const { data: pack, error: packError } = await context.supabase
      .from("plans")
      .select("id,code,name,price_monthly_cents,ai_credits,period_months,kind")
      .eq("id", data.package_id)
      .eq("active", true)
      .eq("kind", "ai_package")
      .maybeSingle();
    if (packError || !pack || !pack.ai_credits) throw new Error("Pacote de IA inválido.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        plan_id: pack.id,
        period: "annual",
        amount_cents: pack.price_monthly_cents,
        provider: "mercado_pago",
        status: "pending",
        raw: { purchase_kind: "ai_package", ai_credits: pack.ai_credits, package_code: pack.code } as never,
      })
      .select("id")
      .single();
    if (paymentError) throw new Error("Não foi possível registrar a compra dos créditos de IA.");

    const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];
    if (!accessToken) return { configured: false as const, payment_id: payment.id, checkout_url: null };

    const origin = process.env["APP_PUBLIC_URL"] ?? "";
    const returnUrl = origin ? `${origin}/creditos-ia?payment_id=${payment.id}` : undefined;
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        items: [{ title: `ANÚNCIO ML — ${pack.name}`, quantity: 1, currency_id: "BRL", unit_price: pack.price_monthly_cents / 100 }],
        external_reference: payment.id,
        metadata: { payment_id: payment.id, user_id: context.userId, plan_id: pack.id, purchase_kind: "ai_package", ai_credits: pack.ai_credits },
        notification_url: origin ? `${origin}/api/public/webhooks/mercadopago` : undefined,
        back_urls: origin ? { success: returnUrl, pending: returnUrl, failure: `${origin}/creditos-ia` } : undefined,
        auto_return: "approved",
      }),
    });

    if (!response.ok) {
      console.error("Extra AI checkout failed", response.status, await response.text());
      return { configured: true as const, payment_id: payment.id, checkout_url: null };
    }
    const preference = (await response.json()) as { init_point?: string; sandbox_init_point?: string };
    return { configured: true as const, payment_id: payment.id, checkout_url: preference.init_point ?? preference.sandbox_init_point ?? null };
  });
