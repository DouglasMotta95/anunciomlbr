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

/** Registra um acesso real (visitante logado ou não). */
export async function recordVisit(data: TrackVisitInput, userAgent?: string | null) {
  const { error } = await supabaseAdmin.from("site_visits").insert({
    visitor_id: trim(data.visitor_id, 80) ?? "anon",
    session_id: trim(data.session_id, 80),
    path: trim(data.path, 300) ?? "/",
    referrer: trim(data.referrer, 500),
    source: deriveSource(data.referrer, data.utm_source),
    utm_source: trim(data.utm_source, 120),
    utm_medium: trim(data.utm_medium, 120),
    utm_campaign: trim(data.utm_campaign, 120),
    utm_term: trim(data.utm_term, 120),
    utm_content: trim(data.utm_content, 120),
    user_agent: trim(userAgent, 400),
    is_authenticated: data.is_authenticated === true,
  });
  if (error) return { ok: false };
  return { ok: true };
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
