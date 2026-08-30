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

export const getExtraAiPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const [{ getAiQuota }, packagesResult] = await Promise.all([
      import("@/lib/ai-quota.server"),
      db
        .from("plans")
        .select("id,code,name,tagline,price_monthly_cents,ai_credits,badge,highlighted")
        .eq("active", true)
        .eq("kind", "ai_package")
        .order("sort_order"),
    ]);
    if (packagesResult.error) throw new Error("Não foi possível carregar os pacotes de IA.");
    const quota = await getAiQuota(context.userId);
    return {
      eligible: true,
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
  .validator((data: unknown) => z.object({ package_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: pack, error: packError } = await db
      .from("plans")
      .select("id,code,name,price_monthly_cents,ai_credits,period_months,kind")
      .eq("id", data.package_id)
      .eq("active", true)
      .eq("kind", "ai_package")
      .maybeSingle();
    if (packError || !pack || !pack.ai_credits) throw new Error("Pacote de IA inválido.");

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
        raw: { purchase_kind: "ai_package", ai_credits: pack.ai_credits, package_code: pack.code } as never,
      })
      .select("id")
      .single();
    if (paymentError || !payment) throw new Error("Não foi possível registrar a compra dos créditos de IA.");

    const returnUrl = `${origin}/creditos-ia?payment_id=${payment.id}`;
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        items: [{ title: `ANÚNCIO ML — ${pack.name}`, quantity: 1, currency_id: "BRL", unit_price: pack.price_monthly_cents / 100 }],
        external_reference: payment.id,
        metadata: { payment_id: payment.id, user_id: context.userId, plan_id: pack.id, purchase_kind: "ai_package", ai_credits: pack.ai_credits },
        notification_url: `${origin}/api/public/webhooks/mercadopago`,
        back_urls: { success: returnUrl, pending: returnUrl, failure: `${origin}/creditos-ia` },
        auto_return: "approved",
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Extra AI checkout failed", response.status, detail.slice(0, 500));
      return { configured: true as const, payment_id: payment.id, checkout_url: null, reason: "O Mercado Pago não conseguiu abrir o checkout agora." };
    }
    const preference = (await response.json()) as { id?: string; init_point?: string; sandbox_init_point?: string };
    if (preference.id) {
      await supabaseAdmin.from("payments").update({ provider_ref: preference.id }).eq("id", payment.id).eq("user_id", context.userId);
    }
    return { configured: true as const, payment_id: payment.id, checkout_url: preference.init_point ?? preference.sandbox_init_point ?? null, reason: null };
  });
