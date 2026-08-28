type Db = any;
export type AiQuotaState = { used: number; credit_limit: number; remaining: number; source: "rpc" | "fallback" };

function first<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

async function resolvePaidLimit(db: Db, userId: string): Promise<number> {
  const { data: subscription } = await db
    .from("subscriptions")
    .select("status,current_period_end,plans(ai_credits)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subscriptionLimit = Number(subscription?.plans?.ai_credits ?? 0);
  if (subscriptionLimit > 0 && (!subscription?.current_period_end || new Date(subscription.current_period_end) > new Date())) return subscriptionLimit;

  const { data: license } = await db
    .from("licenses")
    .select("status,expires_at,plans(ai_credits,kind)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("expires_at", { ascending: false })
    .limit(5);
  const active = (license ?? []).find((row: any) => row?.plans?.kind !== "ad_package" && (!row.expires_at || new Date(row.expires_at) > new Date()));
  return Number(active?.plans?.ai_credits ?? 0);
}

async function fallbackStatus(db: Db, userId: string): Promise<AiQuotaState> {
  const paidLimit = await resolvePaidLimit(db, userId);
  const creditLimit = paidLimit > 0 ? paidLimit : 10;
  const periodStart = paidLimit > 0 ? monthStart() : "1970-01-01";
  const { data: usage } = await db
    .from("ai_credit_usage")
    .select("used")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();
  const used = Number(usage?.used ?? 0);
  return { used, credit_limit: creditLimit, remaining: Math.max(creditLimit - used, 0), source: "fallback" };
}

export async function getAiQuota(userId: string): Promise<AiQuotaState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as Db;
  const { data, error } = await db.rpc("ai_credit_status", { p_user_id: userId });
  const row = first(data as any);
  if (!error && row && Number.isFinite(Number(row.credit_limit))) {
    return {
      used: Number(row.used ?? 0),
      credit_limit: Number(row.credit_limit ?? 0),
      remaining: Number(row.remaining ?? 0),
      source: "rpc",
    };
  }
  if (error) console.warn("[AI quota] usando fallback de compatibilidade:", error.message);
  return fallbackStatus(db, userId);
}

export async function consumeAiQuota(userId: string, amount = 1): Promise<{ ok: true; quota: AiQuotaState } | { ok: false; reason: string; quota?: AiQuotaState }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as Db;
  const status = await getAiQuota(userId);
  if (status.remaining < amount) return { ok: false, reason: `Créditos de IA esgotados (${status.used}/${status.credit_limit}).`, quota: status };

  const { data, error } = await db.rpc("consume_ai_credit", { p_user_id: userId, p_amount: amount });
  const row = first(data as any);
  if (!error && row?.allowed) {
    return {
      ok: true,
      quota: {
        used: Number(row.used ?? status.used + amount),
        credit_limit: Number(row.credit_limit ?? status.credit_limit),
        remaining: Number(row.remaining ?? Math.max(status.remaining - amount, 0)),
        source: "rpc",
      },
    };
  }

  const paidLimit = await resolvePaidLimit(db, userId);
  const periodStart = paidLimit > 0 ? monthStart() : "1970-01-01";
  const { data: current } = await db
    .from("ai_credit_usage")
    .select("used")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();
  const used = Number(current?.used ?? 0);
  const limit = paidLimit > 0 ? paidLimit : 10;
  if (used + amount > limit) return { ok: false, reason: `Créditos de IA esgotados (${used}/${limit}).` };

  const nextUsed = used + amount;
  const { error: upsertError } = await db
    .from("ai_credit_usage")
    .upsert({ user_id: userId, period_start: periodStart, used: nextUsed, updated_at: new Date().toISOString() }, { onConflict: "user_id,period_start" });
  if (upsertError) {
    console.error("[AI quota fallback consume]", upsertError.message);
    return { ok: false, reason: "A IA respondeu, mas não foi possível registrar o uso do crédito." };
  }
  return { ok: true, quota: { used: nextUsed, credit_limit: limit, remaining: Math.max(limit - nextUsed, 0), source: "fallback" } };
}
