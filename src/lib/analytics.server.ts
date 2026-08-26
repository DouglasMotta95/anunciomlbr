import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AdminContext = { supabase: any; userId: string };

async function assertAdmin(context: AdminContext) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || isAdmin !== true) throw new Error("Acesso administrativo negado.");
}

/** Deriva a origem do acesso a partir de utm_source/referrer. */
export function deriveSource(referrer?: string | null, utmSource?: string | null) {
  const utm = utmSource?.trim().toLowerCase();
  if (utm) return utm;
  const ref = referrer?.trim().toLowerCase();
  if (!ref) return "direto";
  const host = (() => {
    try {
      return new URL(ref).hostname.replace(/^www\./, "");
    } catch {
      return ref;
    }
  })();
  if (host.includes("google")) return "google";
  if (host.includes("facebook") || host.includes("fb.")) return "facebook";
  if (host.includes("instagram")) return "instagram";
  if (host.includes("youtube")) return "youtube";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("whatsapp") || host.includes("wa.me")) return "whatsapp";
  if (host.includes("bing")) return "bing";
  if (host.includes("t.co") || host.includes("twitter") || host.includes("x.com")) return "twitter";
  if (host.includes("linkedin")) return "linkedin";
  return host || "direto";
}

export type TrackVisitInput = {
  visitor_id: string;
  session_id?: string | undefined;
  path?: string | undefined;
  referrer?: string | undefined;
  utm_source?: string | undefined;
  utm_medium?: string | undefined;
  utm_campaign?: string | undefined;
  utm_term?: string | undefined;
  utm_content?: string | undefined;
  is_authenticated?: boolean | undefined;
};

function trim(value: string | undefined | null, max = 300) {
  const v = value?.trim();
  if (!v) return null;
  return v.slice(0, max);
}

/**
 * Registra um acesso real (visitante logado ou não).
 * - Classifica bots/scanners pelo User-Agent real e pelo caminho pedido.
 * - Bloqueia flood (muitos hits do mesmo visitante em poucos minutos).
 * - Deduplica o mesmo visitante+página dentro da janela de 30 minutos.
 */
export async function recordVisit(data: TrackVisitInput, userAgent?: string | null) {
  const {
    classifyUserAgent,
    classifyPath,
    FLOOD_WINDOW_MINUTES,
    FLOOD_MAX_VISITS,
    DEDUPE_WINDOW_MINUTES,
  } = await import("@/lib/bot-detection.server");

  const visitorId = trim(data.visitor_id, 80) ?? "anon";
  const sessionId = trim(data.session_id, 80);
  const path = trim(data.path, 300) ?? "/";

  const uaVerdict = classifyUserAgent(userAgent);
  const pathVerdict = classifyPath(path);
  let isBot = uaVerdict.isBot || pathVerdict.isBot;
  let botReason = uaVerdict.reason ?? pathVerdict.reason;

  // Deduplicação: mesma pessoa, mesma página, dentro da janela → não cria nova visita.
  const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_MINUTES * 60_000).toISOString();
  const { data: dupe } = await supabaseAdmin
    .from("site_visits")
    .select("id")
    .eq("visitor_id", visitorId)
    .eq("path", path)
    .gte("created_at", dedupeSince)
    .limit(1);
  if (dupe && dupe.length > 0) return { ok: true, deduped: true, blocked: false };

  // Flood: volume impossível para um humano → marca como bot.
  if (!isBot) {
    const floodSince = new Date(Date.now() - FLOOD_WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .eq("visitor_id", visitorId)
      .gte("created_at", floodSince);
    if ((count ?? 0) >= FLOOD_MAX_VISITS) {
      isBot = true;
      botReason = "flood_de_requisicoes";
    }
  }

  const { error } = await supabaseAdmin.from("site_visits").insert({
    visitor_id: visitorId,
    session_id: sessionId,
    path,
    referrer: trim(data.referrer, 500),
    source: deriveSource(data.referrer, data.utm_source),
    utm_source: trim(data.utm_source, 120),
    utm_medium: trim(data.utm_medium, 120),
    utm_campaign: trim(data.utm_campaign, 120),
    utm_term: trim(data.utm_term, 120),
    utm_content: trim(data.utm_content, 120),
    user_agent: trim(userAgent, 400),
    is_authenticated: data.is_authenticated === true,
    is_bot: isBot,
    bot_reason: botReason,
  });
  if (error) return { ok: false, deduped: false, blocked: isBot };
  return { ok: true, deduped: false, blocked: isBot };
}


function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

/** Métricas reais de visitas para o painel administrativo. */
export async function getVisitAnalytics(context: AdminContext) {
  await assertAdmin(context);

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 29);

  const [recent, totals] = await Promise.all([
    supabaseAdmin
      .from("site_visits")
      .select("created_at, visitor_id, source, utm_campaign")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .limit(50000),
    supabaseAdmin.from("site_visits").select("visitor_id", { count: "exact" }).limit(50000),
  ]);

  if (recent.error) throw new Error("Falha ao carregar analytics.");
  const rows = recent.data ?? [];

  const todayKey = new Date().toISOString().slice(0, 10);
  const day7 = new Date();
  day7.setUTCHours(0, 0, 0, 0);
  day7.setUTCDate(day7.getUTCDate() - 6);
  const key7 = day7.toISOString().slice(0, 10);

  const timelineMap = new Map<string, { date: string; visits: number; visitors: Set<string> }>();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    timelineMap.set(key, { date: key, visits: 0, visitors: new Set() });
  }

  const sources = new Map<string, number>();
  const campaigns = new Map<string, number>();
  const uniq30 = new Set<string>();
  const uniq7 = new Set<string>();
  const uniqToday = new Set<string>();
  let today = 0;
  let last7 = 0;

  for (const row of rows) {
    const key = dayKey(row.created_at as string);
    const bucket = timelineMap.get(key);
    if (bucket) {
      bucket.visits += 1;
      bucket.visitors.add(row.visitor_id as string);
    }
    uniq30.add(row.visitor_id as string);
    if (key >= key7) {
      last7 += 1;
      uniq7.add(row.visitor_id as string);
    }
    if (key === todayKey) {
      today += 1;
      uniqToday.add(row.visitor_id as string);
    }
    const src = (row.source as string) || "direto";
    sources.set(src, (sources.get(src) ?? 0) + 1);
    const camp = row.utm_campaign as string | null;
    if (camp) campaigns.set(camp, (campaigns.get(camp) ?? 0) + 1);
  }

  const allVisitors = new Set<string>((totals.data ?? []).map((r: any) => r.visitor_id as string));

  return {
    today,
    last7,
    last30: rows.length,
    total: totals.count ?? rows.length,
    uniqueToday: uniqToday.size,
    unique7: uniq7.size,
    unique30: uniq30.size,
    uniqueTotal: allVisitors.size,
    timeline: [...timelineMap.values()].map((b) => ({
      date: b.date,
      visits: b.visits,
      visitors: b.visitors.size,
    })),
    sources: [...sources.entries()]
      .map(([source, visits]) => ({ source, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10),
    campaigns: [...campaigns.entries()]
      .map(([campaign, visits]) => ({ campaign, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10),
  };
}

export type FunnelEventInput = {
  visitor_id: string;
  session_id?: string | undefined;
  event: "view_plan" | "start_checkout" | "purchase";
  path?: string | undefined;
  referrer?: string | undefined;
  plan_code?: string | undefined;
  period?: string | undefined;
  amount_cents?: number | undefined;
  coupon_code?: string | undefined;
  meta?: Record<string, unknown> | undefined;
};

/** Grava um evento do funil de conversão. */
export async function recordFunnelEvent(data: FunnelEventInput) {
  const { error } = await supabaseAdmin.from("analytics_events").insert({
    visitor_id: trim(data.visitor_id, 80) ?? "anon",
    session_id: trim(data.session_id, 80),
    event: data.event,
    path: trim(data.path, 300),
    source: deriveSource(data.referrer, null),
    plan_code: trim(data.plan_code, 60),
    period: trim(data.period, 30),
    amount_cents: data.amount_cents ?? null,
    coupon_code: trim(data.coupon_code, 40),
    meta: (data.meta ?? {}) as never,
  });
  return { ok: !error };
}

/** Métricas do funil view_plan → start_checkout → purchase. */
export async function getFunnelAnalytics(context: AdminContext) {
  await assertAdmin(context);

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 29);

  const { data, error } = await supabaseAdmin
    .from("analytics_events")
    .select("created_at, event, plan_code, amount_cents, visitor_id, source")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(50000);
  if (error) throw new Error("Falha ao carregar funil.");

  const rows = data ?? [];
  const counts = { view_plan: 0, start_checkout: 0, purchase: 0 } as Record<string, number>;
  const timelineMap = new Map<
    string,
    { date: string; view_plan: number; start_checkout: number; purchase: number }
  >();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    timelineMap.set(d.toISOString().slice(0, 10), {
      date: d.toISOString().slice(0, 10),
      view_plan: 0,
      start_checkout: 0,
      purchase: 0,
    });
  }
  const plans = new Map<string, { plan: string; view_plan: number; start_checkout: number; purchase: number }>();
  let revenueCents = 0;

  for (const row of rows) {
    const event = row.event as string;
    counts[event] = (counts[event] ?? 0) + 1;
    const bucket = timelineMap.get(dayKey(row.created_at as string)) as
      | Record<string, number>
      | undefined;
    if (bucket && typeof bucket[event] === "number") {
      bucket[event] = (bucket[event] ?? 0) + 1;
    }
    const planCode = (row.plan_code as string | null) ?? "—";
    const planBucket = (plans.get(planCode) ?? {
      plan: planCode,
      view_plan: 0,
      start_checkout: 0,
      purchase: 0,
    }) as unknown as Record<string, number> & { plan: string };
    planBucket[event] = (planBucket[event] ?? 0) + 1;
    plans.set(planCode, planBucket as unknown as { plan: string; view_plan: number; start_checkout: number; purchase: number });
    if (event === "purchase") revenueCents += Number(row.amount_cents ?? 0);
  }

  const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

  return {
    viewPlan: counts["view_plan"] ?? 0,
    startCheckout: counts["start_checkout"] ?? 0,
    purchase: counts["purchase"] ?? 0,
    revenueCents,
    viewToCheckoutRate: rate(counts["start_checkout"] ?? 0, counts["view_plan"] ?? 0),
    checkoutToPurchaseRate: rate(counts["purchase"] ?? 0, counts["start_checkout"] ?? 0),
    overallRate: rate(counts["purchase"] ?? 0, counts["view_plan"] ?? 0),
    timeline: [...timelineMap.values()],
    plans: [...plans.values()].sort((a, b) => b.purchase - a.purchase || b.view_plan - a.view_plan),
  };
}
