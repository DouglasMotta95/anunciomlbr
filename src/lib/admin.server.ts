import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveRefs } from "@/lib/admin-refs.server";

const PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

type AdminContext = { supabase: any; userId: string };

type AdminPeriodInput = {
  period: "7d" | "30d" | "90d" | "12m";
};

type ListClientsInput = {
  page: number;
  pageSize: number;
  search?: string | undefined;
  filter: "all" | "ativos" | "inativos" | "expirados" | "teste" | "pagantes";
};

type LicenseActionInput = {
  id: string;
  action: "activate" | "suspend" | "cancel" | "renew";
  months?: number | undefined;
};

type UpdatePlanInput = {
  id: string;
  name?: string | undefined;
  tagline?: string | null | undefined;
  price_monthly_cents?: number | undefined;
  listing_limit?: number | null | undefined;
  ai_credits?: number | null | undefined;
  features?: string[] | undefined;
  highlighted?: boolean | undefined;
  active?: boolean | undefined;
  sort_order?: number | undefined;
};

type UpdateDiscountInput = {
  period: "monthly" | "quarterly" | "semiannual" | "annual";
  discount_percent: number;
  label?: string | undefined;
};

type ListPaymentsInput = {
  page: number;
  pageSize: number;
  status: "all" | "approved" | "pending" | "rejected" | "cancelled";
};

type ListSubscriptionsInput = {
  page: number;
  pageSize: number;
  status: "all" | "available" | "active" | "expired" | "suspended" | "cancelled";
};

type ListActivityInput = {
  kind?: string | undefined;
};

type CreateCouponInput = {
  code: string;
  discount_percent: number;
  max_uses?: number | null | undefined;
  expires_at?: string | null | undefined;
};

type ToggleCouponInput = {
  code: string;
  active: boolean;
};

async function assertAdmin(context: AdminContext) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });

  if (error || isAdmin !== true) {
    throw new Error("Acesso administrativo negado.");
  }
}

function rangeFor(page: number, pageSize: number) {
  const from = page * pageSize;
  return { from, to: from + pageSize - 1 };
}

function cleanSearchTerm(value?: string) {
  const term = value?.trim();
  if (!term) return undefined;
  return term.replace(/[,%]/g, " ").replace(/\s+/g, " ").trim() || undefined;
}

function startDateForPeriod(period: AdminPeriodInput["period"]) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (period === "7d") date.setDate(date.getDate() - 6);
  if (period === "30d") date.setDate(date.getDate() - 29);
  if (period === "90d") date.setDate(date.getDate() - 89);
  if (period === "12m") {
    date.setDate(1);
    date.setMonth(date.getMonth() - 11);
  }
  return date;
}

function bucketKey(value: string | null | undefined, period: AdminPeriodInput["period"]) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (period === "12m") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return date.toISOString().slice(0, 10);
}

function emptyTimeline(period: AdminPeriodInput["period"]) {
  const start = startDateForPeriod(period);
  const rows: Array<{
    label: string;
    users: number;
    subscriptions: number;
    revenue_cents: number;
    publications: number;
    platform_usage: number;
    ai_usage: number;
  }> = [];

  if (period === "12m") {
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(start);
      d.setMonth(start.getMonth() + i);
      rows.push({
        label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        users: 0,
        subscriptions: 0,
        revenue_cents: 0,
        publications: 0,
        platform_usage: 0,
        ai_usage: 0,
      });
    }
    return rows;
  }

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    rows.push({
      label: d.toISOString().slice(0, 10),
      users: 0,
      subscriptions: 0,
      revenue_cents: 0,
      publications: 0,
      platform_usage: 0,
      ai_usage: 0,
    });
  }
  return rows;
}

export async function getAdminMetrics(data: AdminPeriodInput, context: AdminContext) {
  await assertAdmin(context);

  const now = new Date().toISOString();
  const period = data.period ?? "30d";
  const since = startDateForPeriod(period).toISOString();

  const [
    usersTotal,
    licensesActive,
    licensesExpired,
    licensesCancelled,
    approvedPayments,
    allPayments,
    listingsTotal,
    listingsPublished,
    aiListings,
    mlConnected,
    trialsTotal,
    newUsers,
    activeSubscriptions,
    recentUsers,
    recentLicenses,
    periodPayments,
    recentListings,
    recentActivity,
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("licenses").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin
      .from("licenses")
      .select("id", { count: "exact", head: true })
      .or(`status.eq.expired,and(status.eq.active,expires_at.lt.${now})`),
    supabaseAdmin.from("licenses").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
    supabaseAdmin.from("payments").select("amount_cents,created_at").eq("status", "approved"),
    supabaseAdmin.from("payments").select("status", { count: "exact", head: false }),
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }).not("ai_score", "is", null),
    supabaseAdmin.from("ml_connections").select("user_id", { count: "exact", head: true }).eq("connected", true),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).lte("free_listings_used", 0),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabaseAdmin.from("licenses").select("id", { count: "exact", head: true }).eq("status", "active").not("user_id", "is", null),
    supabaseAdmin.from("profiles").select("created_at").gte("created_at", since),
    supabaseAdmin.from("licenses").select("created_at,status").gte("created_at", since),
    supabaseAdmin.from("payments").select("amount_cents,created_at,status").gte("created_at", since),
    supabaseAdmin.from("listings").select("created_at,published_at,status,ai_score").gte("created_at", since),
    supabaseAdmin.from("activity_events").select("created_at,kind").gte("created_at", since),
  ]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const newUsers7d = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  const revenueTotalCents = (approvedPayments.data ?? []).reduce(
    (sum: number, row: any) => sum + (row.amount_cents ?? 0),
    0,
  );

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const mrrCents = (approvedPayments.data ?? [])
    .filter((row: any) => new Date(row.created_at) >= startOfMonth)
    .reduce((sum: number, row: any) => sum + (row.amount_cents ?? 0), 0);

  const payingUsers = new Set(
    (
      await supabaseAdmin
        .from("licenses")
        .select("user_id")
        .eq("status", "active")
        .not("user_id", "is", null)
    ).data?.map((r: any) => r.user_id) ?? [],
  ).size;

  const failedPayments = (allPayments.data ?? []).filter((p: any) => p.status === "rejected").length;

  const timeline = emptyTimeline(period);
  const timelineMap = new Map(timeline.map((row) => [row.label, row]));
  for (const row of recentUsers.data ?? []) {
    const key = bucketKey((row as any).created_at, period);
    const bucket = key ? timelineMap.get(key) : undefined;
    if (bucket) bucket.users += 1;
  }
  for (const row of recentLicenses.data ?? []) {
    const key = bucketKey((row as any).created_at, period);
    const bucket = key ? timelineMap.get(key) : undefined;
    if (bucket && (row as any).status === "active") bucket.subscriptions += 1;
  }
  for (const row of periodPayments.data ?? []) {
    const key = bucketKey((row as any).created_at, period);
    const bucket = key ? timelineMap.get(key) : undefined;
    if (bucket && (row as any).status === "approved") bucket.revenue_cents += (row as any).amount_cents ?? 0;
  }
  for (const row of recentListings.data ?? []) {
    const key = bucketKey((row as any).published_at ?? (row as any).created_at, period);
    const bucket = key ? timelineMap.get(key) : undefined;
    if (!bucket) continue;
    if ((row as any).status === "active" || (row as any).published_at) bucket.publications += 1;
    if ((row as any).ai_score != null) bucket.ai_usage += 1;
  }
  for (const row of recentActivity.data ?? []) {
    const key = bucketKey((row as any).created_at, period);
    const bucket = key ? timelineMap.get(key) : undefined;
    if (!bucket) continue;
    bucket.platform_usage += 1;
    if (String((row as any).kind ?? "").toLowerCase().includes("ai")) bucket.ai_usage += 1;
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const { data: recentApprovedPayments } = await supabaseAdmin
    .from("payments")
    .select("amount_cents,created_at,status")
    .eq("status", "approved")
    .gte("created_at", sixMonthsAgo.toISOString());

  const monthly: Record<string, number> = {};
  for (const p of recentApprovedPayments ?? []) {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly[key] = (monthly[key] ?? 0) + (p.amount_cents ?? 0);
  }

  const revenueByMonth: { month: string; amount_cents: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    revenueByMonth.push({ month: key, amount_cents: monthly[key] ?? 0 });
  }

  return {
    users: usersTotal.count ?? 0,
    payingUsers,
    subscriptionsActive: activeSubscriptions.count ?? 0,
    licensesActive: licensesActive.count ?? 0,
    licensesExpired: licensesExpired.count ?? 0,
    licensesCancelled: licensesCancelled.count ?? 0,
    freeTrialUsers: trialsTotal.count ?? 0,
    revenueTotalCents,
    mrrCents,
    failedPayments,
    listingsTotal: listingsTotal.count ?? 0,
    listingsPublished: listingsPublished.count ?? 0,
    aiUsage: aiListings.count ?? 0,
    mlConnected: mlConnected.count ?? 0,
    revenueByMonth,
    growth: timeline,
    newUsers: newUsers.count ?? 0,
    newUsers7d: newUsers7d.count ?? 0,
    activeClients: payingUsers,
    inactiveClients: Math.max((usersTotal.count ?? 0) - payingUsers, 0),
  };
}

export async function listAdminClients(data: ListClientsInput, context: AdminContext) {
  await assertAdmin(context);

  let query = supabaseAdmin
    .from("profiles")
    .select("id,email,full_name,created_at,last_seen_at,free_listings_used,free_listings_limit", { count: "exact" })
    .order("created_at", { ascending: false });

  const search = cleanSearchTerm(data.search);
  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { from, to } = rangeFor(data.page, data.pageSize);
  const { data: rows, error, count } = await query.range(from, to);
  if (error) throw new Error(`Falha ao listar clientes: ${error.message}`);

  const userIds = (rows ?? []).map((r: any) => r.id).filter(Boolean);
  const { data: licRows, error: licensesError } = userIds.length
    ? await supabaseAdmin.from("licenses").select("id,code,status,expires_at,period,user_id,plan_id").in("user_id", userIds)
    : { data: [] as any[], error: null };
  if (licensesError) throw new Error(`Falha ao listar licenças dos clientes: ${licensesError.message}`);

  const planIds = Array.from(new Set((licRows ?? []).map((l: any) => l.plan_id).filter(Boolean)));
  const { data: planRows, error: plansError } = planIds.length
    ? await supabaseAdmin.from("plans").select("id,name").in("id", planIds)
    : { data: [] as any[], error: null };
  if (plansError) throw new Error(`Falha ao listar planos dos clientes: ${plansError.message}`);

  const planMap = new Map((planRows ?? []).map((p: any) => [p.id, p.name as string]));
  const licByUser = new Map<string, any[]>();
  for (const l of licRows ?? []) {
    const list = licByUser.get(l.user_id as string) ?? [];
    list.push(l);
    licByUser.set(l.user_id as string, list);
  }

  const now = Date.now();
  const clients = (rows ?? []).map((row: any) => {
    const licenses = licByUser.get(row.id) ?? [];
    const active = licenses.find(
      (l) => l.status === "active" && (!l.expires_at || new Date(l.expires_at).getTime() > now),
    );
    const expired = licenses.find(
      (l) => l.status === "expired" || (l.status === "active" && l.expires_at && new Date(l.expires_at).getTime() <= now),
    );
    const isTrial = !active && !expired && (row.free_listings_used ?? 0) < (row.free_listings_limit ?? 0);
    let status: "ativo" | "inativo" | "expirado" | "teste" = "inativo";
    if (active) status = "ativo";
    else if (expired) status = "expirado";
    else if (isTrial) status = "teste";

    const lic = active ?? expired;
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      created_at: row.created_at,
      last_seen_at: row.last_seen_at,
      status,
      plan: lic?.plan_id ? planMap.get(lic.plan_id) ?? null : null,
      license_code: lic?.code ?? null,
      license_expires_at: lic?.expires_at ?? null,
    };
  });

  const filtered = clients.filter((c) => {
    if (data.filter === "ativos") return c.status === "ativo";
    if (data.filter === "inativos") return c.status === "inativo" || c.status === "expirado";
    if (data.filter === "expirados") return c.status === "expirado";
    if (data.filter === "teste") return c.status === "teste";
    if (data.filter === "pagantes") return c.status === "ativo";
    return true;
  });

  return { clients: filtered, total: count ?? clients.length };
}

export async function listAdminInactiveClients(context: AdminContext) {
  await assertAdmin(context);
  const now = new Date().toISOString();

  const [expiredLicenses, cancelledLicenses, failedPayments, profiles] = await Promise.all([
    supabaseAdmin
      .from("licenses")
      .select("id,user_id,code,expires_at,status")
      .or(`status.eq.expired,and(status.eq.active,expires_at.lt.${now})`)
      .not("user_id", "is", null),
    supabaseAdmin.from("licenses").select("id,user_id,code").eq("status", "cancelled").not("user_id", "is", null),
    supabaseAdmin.from("payments").select("id,user_id,amount_cents,created_at").eq("status", "rejected"),
    supabaseAdmin.from("profiles").select("id,email,full_name,free_listings_used,free_listings_limit"),
  ]);

  const activeUserIds = new Set(
    (
      await supabaseAdmin.from("licenses").select("user_id").eq("status", "active").gt("expires_at", now)
    ).data?.map((r: any) => r.user_id) ?? [],
  );

  const trialNotConverted = (profiles.data ?? []).filter(
    (p: any) => (p.free_listings_used ?? 0) >= (p.free_listings_limit ?? 0) && !activeUserIds.has(p.id),
  );

  return {
    trialNaoConvertido: trialNotConverted.map((p: any) => ({ id: p.id, email: p.email, full_name: p.full_name })),
    licencaExpirada: expiredLicenses.data ?? [],
    assinaturaCancelada: cancelledLicenses.data ?? [],
    pagamentoFalho: failedPayments.data ?? [],
  };
}

export async function runAdminLicenseAction(data: LicenseActionInput, context: AdminContext) {
  await assertAdmin(context);

  if (data.action === "renew") {
    const { data: license } = await supabaseAdmin.from("licenses").select("*").eq("id", data.id).maybeSingle();
    if (!license) throw new Error("Licença não encontrada.");
    const months = data.months ?? PERIOD_MONTHS[license.period] ?? 1;
    const base = license.expires_at && new Date(license.expires_at) > new Date() ? new Date(license.expires_at) : new Date();
    base.setMonth(base.getMonth() + months);
    const { error } = await supabaseAdmin
      .from("licenses")
      .update({ status: "active", expires_at: base.toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(`Falha ao renovar licença: ${error.message}`);
    return { ok: true as const };
  }

  const statusMap = { activate: "active", suspend: "suspended", cancel: "cancelled" } as const;
  const status = statusMap[data.action as "activate" | "suspend" | "cancel"];
  const { error } = await supabaseAdmin.from("licenses").update({ status }).eq("id", data.id);
  if (error) throw new Error(`Falha ao atualizar licença: ${error.message}`);

  await supabaseAdmin.from("activity_events").insert({
    user_id: context.userId,
    kind: "admin_license_action",
    message: `Licença ${data.id} → ${data.action}`,
    meta: { license_id: data.id, action: data.action },
  });

  return { ok: true as const };
}

export async function updateAdminPlan(data: UpdatePlanInput, context: AdminContext) {
  await assertAdmin(context);
  const { id, ...patch } = data;
  const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as never;
  const { error } = await supabaseAdmin.from("plans").update(cleanPatch).eq("id", id);
  if (error) throw new Error(`Falha ao atualizar plano: ${error.message}`);
  return { ok: true as const };
}

export async function updateAdminPeriodDiscount(data: UpdateDiscountInput, context: AdminContext) {
  await assertAdmin(context);
  const patch = {
    discount_percent: data.discount_percent,
    ...(data.label ? { label: data.label } : {}),
  } as never;
  const { error } = await supabaseAdmin.from("period_discounts").update(patch).eq("period", data.period);
  if (error) throw new Error(`Falha ao atualizar período: ${error.message}`);
  return { ok: true as const };
}

export async function listAdminPayments(data: ListPaymentsInput, context: AdminContext) {
  await assertAdmin(context);

  let query = supabaseAdmin
    .from("payments")
    .select("id,created_at,amount_cents,status,period,provider,provider_ref,user_id,plan_id", { count: "exact" })
    .order("created_at", { ascending: false });

  if (data.status !== "all") {
    query = query.eq("status", data.status);
  }

  const { from, to } = rangeFor(data.page, data.pageSize);
  const { data: rows, error, count } = await query.range(from, to);
  if (error) throw new Error(`Falha ao listar pagamentos: ${error.message}`);

  const { emailMap, planMap } = await resolveRefs(supabaseAdmin, rows ?? []);

  const payments = (rows ?? []).map((row: any) => ({
    id: row.id,
    created_at: row.created_at,
    amount_cents: row.amount_cents,
    status: row.status,
    period: row.period,
    provider: row.provider,
    provider_ref: row.provider_ref,
    email: row.user_id ? emailMap.get(row.user_id) ?? null : null,
    plan: row.plan_id ? planMap.get(row.plan_id) ?? null : null,
  }));

  return { payments, total: count ?? payments.length };
}

export async function listAdminSubscriptions(data: ListSubscriptionsInput, context: AdminContext) {
  await assertAdmin(context);

  let query = supabaseAdmin
    .from("licenses")
    .select("id,code,status,period,created_at,expires_at,user_id,plan_id", { count: "exact" })
    .not("user_id", "is", null)
    .order("created_at", { ascending: false });

  if (data.status !== "all") {
    query = query.eq("status", data.status);
  }

  const { from, to } = rangeFor(data.page, data.pageSize);
  const { data: rows, error, count } = await query.range(from, to);
  if (error) throw new Error(`Falha ao listar assinaturas: ${error.message}`);

  const { emailMap, planMap } = await resolveRefs(supabaseAdmin, rows ?? []);

  const now = Date.now();
  const subscriptions = (rows ?? []).map((row: any) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    period: row.period,
    created_at: row.created_at,
    expires_at: row.expires_at,
    email: row.user_id ? emailMap.get(row.user_id) ?? null : null,
    plan: row.plan_id ? planMap.get(row.plan_id) ?? null : null,
    daysRemaining: row.expires_at ? Math.ceil((new Date(row.expires_at).getTime() - now) / 86_400_000) : null,
  }));

  return { subscriptions, total: count ?? subscriptions.length };
}

export async function getAdminListingsMetrics(context: AdminContext) {
  await assertAdmin(context);

  const [total, active, paused, closed, jobs] = await Promise.all([
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }).eq("status", "paused"),
    supabaseAdmin.from("listings").select("id", { count: "exact", head: true }).eq("status", "error"),
    supabaseAdmin
      .from("bulk_jobs")
      .select("id,kind,status,total,processed,failed,created_at,user_id")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const { emailMap } = await resolveRefs(supabaseAdmin, (jobs.data ?? []) as any[]);

  return {
    total: total.count ?? 0,
    active: active.count ?? 0,
    paused: paused.count ?? 0,
    closed: closed.count ?? 0,
    jobs: (jobs.data ?? []).map((j: any) => ({
      id: j.id,
      kind: j.kind,
      status: j.status,
      total: j.total,
      processed: j.processed,
      failed: j.failed,
      created_at: j.created_at,
      email: j.user_id ? emailMap.get(j.user_id) ?? null : null,
    })),
  };
}

export async function listAdminFreeTrials(context: AdminContext) {
  await assertAdmin(context);

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,full_name,free_listings_used,free_listings_limit,created_at,last_seen_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Falha ao listar testes gratuitos: ${error.message}`);

  const activeLicenseUserIds = new Set(
    (await supabaseAdmin.from("licenses").select("user_id").eq("status", "active")).data?.map((r: any) => r.user_id) ?? [],
  );

  const trials = (profiles ?? []).map((p: any) => ({
    ...p,
    converted: activeLicenseUserIds.has(p.id),
    exhausted: (p.free_listings_used ?? 0) >= (p.free_listings_limit ?? 0),
  }));

  return { trials };
}

export async function getAdminWebhooksStatus(context: AdminContext) {
  await assertAdmin(context);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [processed, received] = await Promise.all([
    supabaseAdmin.from("ml_notifications").select("id", { count: "exact", head: true }).eq("processed", true).gte("received_at", since),
    supabaseAdmin.from("ml_notifications").select("id", { count: "exact", head: true }).gte("received_at", since),
  ]);

  return {
    processedLast24h: processed.count ?? 0,
    receivedLast24h: received.count ?? 0,
  };
}

export async function listAdminActivity(data: ListActivityInput, context: AdminContext) {
  await assertAdmin(context);

  let query = supabaseAdmin
    .from("activity_events")
    .select("id,kind,message,meta,created_at,user_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (data.kind) {
    query = query.eq("kind", data.kind);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(`Falha ao listar logs: ${error.message}`);

  const { emailMap } = await resolveRefs(supabaseAdmin, (rows ?? []) as any[]);

  return {
    events: (rows ?? []).map((r: any) => ({
      id: r.id,
      kind: r.kind,
      message: r.message,
      created_at: r.created_at,
      email: r.user_id ? emailMap.get(r.user_id) ?? null : null,
    })),
  };
}

export async function listAdminCoupons(context: AdminContext) {
  await assertAdmin(context);

  const { data, error } = await supabaseAdmin.from("coupons").select("*").order("code", { ascending: true });
  if (error) throw new Error(`Falha ao listar cupons: ${error.message}`);
  return { coupons: data ?? [] };
}

export async function createAdminCoupon(data: CreateCouponInput, context: AdminContext) {
  await assertAdmin(context);

  const { error } = await supabaseAdmin.from("coupons").insert({
    code: data.code.toUpperCase().trim(),
    discount_percent: data.discount_percent,
    max_uses: data.max_uses ?? null,
    expires_at: data.expires_at ?? null,
    active: true,
    uses: 0,
  });
  if (error) throw new Error(`Falha ao criar cupom: ${error.message}`);
  return { ok: true as const };
}

export async function toggleAdminCoupon(data: ToggleCouponInput, context: AdminContext) {
  await assertAdmin(context);

  const { error } = await supabaseAdmin.from("coupons").update({ active: data.active }).eq("code", data.code);
  if (error) throw new Error(`Falha ao atualizar cupom: ${error.message}`);
  return { ok: true as const };
}
