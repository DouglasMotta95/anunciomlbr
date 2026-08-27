import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getExtraAdPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: mainLicense } = await context.supabase
      .from("licenses")
      .select("id, expires_at, plans!inner(kind)")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .neq("plans.kind", "ad_package")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    const { data: packages, error } = await context.supabase
      .from("plans")
      .select("id, code, name, tagline, price_monthly_cents, ad_quota, badge, highlighted")
      .eq("active", true)
      .eq("kind", "ad_package")
      .order("sort_order");
    if (error) throw new Error("Não foi possível carregar os pacotes extras.");

    const { data: quotaData } = await context.supabase.rpc("my_ad_quota");
    const quota = Array.isArray(quotaData) ? quotaData[0] : quotaData;

    return {
      eligible: !!mainLicense,
      quota: {
        total: quota?.quota ?? 0,
        used: quota?.used ?? 0,
        remaining: quota?.remaining ?? 0,
      },
      packages: packages ?? [],
    };
  });

export const createExtraAdsCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ package_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: mainLicense } = await context.supabase
      .from("licenses")
      .select("id, plans!inner(kind)")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .neq("plans.kind", "ad_package")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (!mainLicense) throw new Error("Pacotes extras estão disponíveis apenas para clientes com plano ativo.");

    const { data: pack, error: packError } = await context.supabase
      .from("plans")
      .select("id, code, name, price_monthly_cents, ad_quota, period_months, kind")
      .eq("id", data.package_id)
      .eq("active", true)
      .eq("kind", "ad_package")
      .maybeSingle();
    if (packError || !pack || !pack.ad_quota) throw new Error("Pacote de anúncios inválido.");

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
        raw: { purchase_kind: "ad_package", ad_quota: pack.ad_quota, package_code: pack.code } as never,
      })
      .select("id")
      .single();
    if (paymentError) throw new Error("Não foi possível registrar a compra do pacote.");

    const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];
    if (!accessToken) return { configured: false as const, payment_id: payment.id, checkout_url: null };

    const origin = process.env["APP_PUBLIC_URL"] ?? "";
    const returnUrl = origin ? `${origin}/creditos?payment_id=${payment.id}` : undefined;
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        items: [{ title: `ANÚNCIO ML — ${pack.name}`, quantity: 1, currency_id: "BRL", unit_price: pack.price_monthly_cents / 100 }],
        external_reference: payment.id,
        metadata: { payment_id: payment.id, user_id: context.userId, plan_id: pack.id, purchase_kind: "ad_package", ad_quota: pack.ad_quota },
        notification_url: origin ? `${origin}/api/public/webhooks/mercadopago` : undefined,
        back_urls: origin ? { success: returnUrl, pending: returnUrl, failure: `${origin}/creditos` } : undefined,
        auto_return: "approved",
      }),
    });

    if (!response.ok) {
      console.error("Extra ads checkout failed", response.status, await response.text());
      return { configured: true as const, payment_id: payment.id, checkout_url: null };
    }
    const preference = (await response.json()) as { init_point?: string; sandbox_init_point?: string };
    return { configured: true as const, payment_id: payment.id, checkout_url: preference.init_point ?? preference.sandbox_init_point ?? null };
  });
