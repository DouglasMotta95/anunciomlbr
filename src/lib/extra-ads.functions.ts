import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicOrigin(): string | null {
  const raw = process.env["APP_PUBLIC_URL"]?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const getExtraAdPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [packageResult, quotaResult] = await Promise.all([
      context.supabase
        .from("plans")
        .select("id, code, name, tagline, price_monthly_cents, ad_quota, badge, highlighted")
        .eq("active", true)
        .eq("kind", "ad_package")
        .order("sort_order"),
      context.supabase.rpc("my_ad_quota"),
    ]);
    if (packageResult.error) throw new Error("Não foi possível carregar os pacotes extras.");
    if (quotaResult.error) throw new Error("Não foi possível carregar seu saldo de anúncios.");
    const quota = Array.isArray(quotaResult.data) ? quotaResult.data[0] : quotaResult.data;
    return {
      eligible: true,
      quota: {
        total: quota?.quota ?? 0,
        used: quota?.used ?? 0,
        remaining: quota?.remaining ?? 0,
      },
      packages: packageResult.data ?? [],
    };
  });

export const createExtraAdsCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ package_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: pack, error: packError } = await context.supabase
      .from("plans")
      .select("id, code, name, price_monthly_cents, ad_quota, period_months, kind")
      .eq("id", data.package_id)
      .eq("active", true)
      .eq("kind", "ad_package")
      .maybeSingle();
    if (packError || !pack || !pack.ad_quota) throw new Error("Pacote de anúncios inválido.");

    const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim();
    const origin = publicOrigin();
    if (!accessToken || !origin) {
      return {
        configured: false as const,
        payment_id: null,
        checkout_url: null,
        reason: !accessToken
          ? "Mercado Pago ainda não está configurado no servidor."
          : "A URL pública do ANÚNCIO ML não está configurada para receber o pagamento.",
      };
    }

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
    if (paymentError || !payment) throw new Error("Não foi possível registrar a compra do pacote.");

    const returnUrl = `${origin}/creditos?payment_id=${payment.id}`;
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        items: [{ title: `ANÚNCIO ML — ${pack.name}`, quantity: 1, currency_id: "BRL", unit_price: pack.price_monthly_cents / 100 }],
        external_reference: payment.id,
        metadata: { payment_id: payment.id, user_id: context.userId, plan_id: pack.id, purchase_kind: "ad_package", ad_quota: pack.ad_quota },
        notification_url: `${origin}/api/public/webhooks/mercadopago`,
        back_urls: { success: returnUrl, pending: returnUrl, failure: `${origin}/creditos` },
        auto_return: "approved",
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Extra ads checkout failed", response.status, detail.slice(0, 500));
      return { configured: true as const, payment_id: payment.id, checkout_url: null, reason: "O Mercado Pago não conseguiu abrir o checkout agora." };
    }
    const preference = (await response.json()) as { id?: string; init_point?: string; sandbox_init_point?: string };
    if (preference.id) {
      await supabaseAdmin.from("payments").update({ provider_ref: preference.id }).eq("id", payment.id).eq("user_id", context.userId);
    }
    return { configured: true as const, payment_id: payment.id, checkout_url: preference.init_point ?? preference.sandbox_init_point ?? null, reason: null };
  });
