import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSubscriptionCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const [{ data: licenses }, { data: quota }, { data: payments }, { data: cancellation }, { getAiQuota }] = await Promise.all([
      db
        .from("licenses")
        .select("id,code,status,period,starts_at,expires_at,ads_quota,ads_used,plan_id,plans(id,name,tagline,price_monthly_cents,listing_limit,ai_credits,features,kind)")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .order("expires_at", { ascending: false })
        .limit(30),
      db.rpc("my_ad_quota"),
      db
        .from("payments")
        .select("id,status,amount_cents,period,created_at,provider_ref,plan_id")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(12),
      db
        .from("subscription_cancellation_requests")
        .select("id,status,requested_at")
        .eq("user_id", context.userId)
        .eq("status", "requested")
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      import("@/lib/ai-quota.server"),
    ]);

    const license = (licenses ?? []).find(
      (row: any) => !["ad_package", "ai_package"].includes(row?.plans?.kind) && (!row.expires_at || new Date(row.expires_at) > new Date()),
    ) ?? null;
    const q = Array.isArray(quota) ? quota[0] : quota;
    const plan = (license as any)?.plans ?? null;
    const ai = await getAiQuota(context.userId);

    return {
      license,
      plan,
      quota: {
        total: Number(q?.quota ?? q?.total ?? 0),
        used: Number(q?.used ?? 0),
        remaining: Number(q?.remaining ?? 0),
      },
      ai: {
        limit: ai.credit_limit,
        used: ai.used,
        remaining: ai.remaining,
      },
      payments: payments ?? [],
      cancellation: cancellation ?? null,
    };
  });
