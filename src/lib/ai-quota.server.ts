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
  const { data: license, error } = await db
    .from("licenses")
    .select("status,expires_at,plans(ai_credits,kind)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("expires_at", { ascending: false })
    .limit(20);
  if (error) {
    console.warn("[AI quota] não foi possível consultar licenças ativas:", error.message);
    return 0;
  }
  const active = (license ?? []).find(
    (row: any) => !["ad_package", "ai_package"].includes(row?.plans?.kind) && (!row.expires_at || new Date(row.expires_at) > new Date()),
  );
  return Number(active?.plans?.ai_credits ?? 0);
}

async function resolveExtraAi(db: Db, userId: string): Promise<{ total: number; used: number; remaining: number }> {
  const { data, error } = await db
    .from("licenses")
    .select("ai_credits_used,expires_at,plans(ai_credits,kind)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("expires_at", { ascending: true });
  if (error) return { total: 0, used: 0, remaining: 0 };
  let total = 0;
  let used = 0;
  for (const row of data ?? []) {
    if (row?.plans?.kind !== "ai_package") continue;
    if (row.expires_at && new Date(row.expires_at) <= new Date()) continue;
    const credits = Number(row?.plans?.ai_credits ?? 0);
    const consumed = Math.min(Number(row?.ai_credits_used ?? 0), credits);
    total += credits;
    used += consumed;
  }
  return { total, used, remaining: Math.max(total - used, 0) };
}

async function fallbackStatus(db: Db, userId: string): Promise<AiQuotaState> {
  const paidLimit = await resolvePaidLimit(db, userId);
  const baseLimit = paidLimit > 0 ? paidLimit : 10;
  const periodStart = paidLimit > 0 ? monthStart() : "1970-01-01";
  const [{ data: usage }, extra] = await Promise.all([
    db.from("ai_credit_usage").select("used").eq("user_id", userId).eq("period_start", periodStart).maybeSingle(),
    resolveExtraAi(db, userId),
  ]);
  const baseUsed = Number(usage?.used ?? 0);
  return {
    used: baseUsed + extra.used,
    credit_limit: baseLimit + extra.total,
    remaining: Math.max(baseLimit - baseUsed, 0) + extra.remaining,
    source: "fallback",
  };
}

function normalizedRpcQuota(row: any): AiQuotaState | null {
  if (!row || !Number.isFinite(Number(row.credit_limit))) return null;
  const creditLimit = Number(row.credit_limit ?? 0);
  const used = Number(row.used ?? 0);
  const remaining = Number(row.remaining ?? Math.max(creditLimit - used, 0));
  if (creditLimit < 0 || used < 0 || remaining < 0) return null;
  return { used, credit_limit: creditLimit, remaining, source: "rpc" };
}

export async function getAiQuota(userId: string): Promise<AiQuotaState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as Db;
  const [{ data, error }, fallback] = await Promise.all([
    db.rpc("ai_credit_status", { p_user_id: userId }),
    fallbackStatus(db, userId),
  ]);
  const rpcQuota = !error ? normalizedRpcQuota(first(data as any)) : null;

  // Bancos com uma versão antiga da RPC podem responder 0/0/0 para usuários do
  // teste grátis mesmo quando a regra atual concede 10 créditos vitalícios.
  // Nessa situação, a fonte compatível é mais completa e deve prevalecer.
  if (rpcQuota && (rpcQuota.credit_limit > 0 || fallback.credit_limit <= 0)) return rpcQuota;

  if (error) console.warn("[AI quota] usando fallback de compatibilidade:", error.message);
  else if (rpcQuota && rpcQuota.credit_limit === 0 && fallback.credit_limit > 0) {
    console.warn("[AI quota] RPC retornou limite zero incompatível com o direito atual; usando fallback.");
  }
  return fallback;
}

async function consumeFallback(
  db: Db,
  userId: string,
  amount: number,
): Promise<{ ok: true; quota: AiQuotaState } | { ok: false; reason: string; quota?: AiQuotaState }> {
  const paidLimit = await resolvePaidLimit(db, userId);
  const periodStart = paidLimit > 0 ? monthStart() : "1970-01-01";
  const [{ data: current }, extra] = await Promise.all([
    db.from("ai_credit_usage").select("used").eq("user_id", userId).eq("period_start", periodStart).maybeSingle(),
    resolveExtraAi(db, userId),
  ]);
  const baseUsed = Number(current?.used ?? 0);
  const baseLimit = paidLimit > 0 ? paidLimit : 10;
  const baseRemaining = Math.max(baseLimit - baseUsed, 0);

  // O fallback só grava o consumo da franquia base. Pacotes extras dependem da
  // RPC nova para consumo FIFO, então não fingimos que conseguimos consumi-los.
  if (amount > baseRemaining) {
    const totalLimit = baseLimit + extra.total;
    const totalUsed = baseUsed + extra.used;
    return {
      ok: false,
      reason:
        extra.remaining > 0
          ? "Seu saldo extra de IA existe, mas o banco ainda precisa da atualização de créditos para consumi-lo corretamente."
          : `Créditos de IA esgotados (${totalUsed}/${totalLimit}). Compre créditos extras de IA ou faça upgrade do plano.`,
      quota: {
        used: totalUsed,
        credit_limit: totalLimit,
        remaining: baseRemaining + extra.remaining,
        source: "fallback",
      },
    };
  }

  const nextUsed = baseUsed + amount;
  const { error: upsertError } = await db
    .from("ai_credit_usage")
    .upsert(
      { user_id: userId, period_start: periodStart, used: nextUsed, updated_at: new Date().toISOString() },
      { onConflict: "user_id,period_start" },
    );
  if (upsertError) {
    console.error("[AI quota fallback consume]", upsertError.message);
    return { ok: false, reason: "A IA respondeu, mas não foi possível registrar o uso do crédito." };
  }

  return {
    ok: true,
    quota: {
      used: nextUsed + extra.used,
      credit_limit: baseLimit + extra.total,
      remaining: Math.max(baseLimit - nextUsed, 0) + extra.remaining,
      source: "fallback",
    },
  };
}

export async function consumeAiQuota(
  userId: string,
  amount = 1,
): Promise<{ ok: true; quota: AiQuotaState } | { ok: false; reason: string; quota?: AiQuotaState }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as Db;
  const status = await getAiQuota(userId);
  if (status.remaining < amount) {
    return {
      ok: false,
      reason: `Créditos de IA esgotados (${status.used}/${status.credit_limit}). Compre créditos extras em “Créditos de IA” ou faça upgrade do plano.`,
      quota: status,
    };
  }

  const { data, error } = await db.rpc("consume_ai_credit", { p_user_id: userId, p_amount: amount });
  const row = first(data as any);
  const rpcLimit = Number(row?.credit_limit ?? 0);

  if (!error && row?.allowed === true && rpcLimit > 0) {
    return {
      ok: true,
      quota: {
        used: Number(row.used ?? status.used + amount),
        credit_limit: rpcLimit,
        remaining: Number(row.remaining ?? Math.max(status.remaining - amount, 0)),
        source: "rpc",
      },
    };
  }

  // Uma RPC antiga pode negar o consumo com 0/0 mesmo quando getAiQuota já
  // confirmou um saldo válido do teste grátis. Nesse caso, não tratamos a
  // negativa incompatível como saldo esgotado: usamos a trilha compatível.
  if (status.source === "fallback" || error || rpcLimit <= 0) {
    if (error) console.warn("[AI quota consume] usando fallback:", error.message);
    return consumeFallback(db, userId, amount);
  }

  if (row?.allowed === false) {
    return {
      ok: false,
      reason: `Créditos de IA esgotados (${Number(row.used ?? status.used)}/${rpcLimit}). Compre créditos extras em “Créditos de IA” ou faça upgrade do plano.`,
      quota: {
        used: Number(row.used ?? status.used),
        credit_limit: rpcLimit,
        remaining: Number(row.remaining ?? 0),
        source: "rpc",
      },
    };
  }

  return consumeFallback(db, userId, amount);
}
