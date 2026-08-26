import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Métricas gerais do painel administrativo (somente admin). */
export const adminGetMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date().toISOString();

    const [
      usersTotal,
      licensesActive,
      licensesExpired,
      licensesCancelled,
      approvedPayments,
      allPayments,
      listingsTotal,
      trialsTotal,
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
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .lte("free_listings_used", 0),
    ]);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const newUsers7d = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    const revenueTotalCents = (approvedPayments.data ?? []).reduce(
      (sum, row) => sum + (row.amount_cents ?? 0),
      0,
    );

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const mrrCents = (approvedPayments.data ?? [])
      .filter((row) => new Date(row.created_at) >= startOfMonth)
      .reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);

    const payingUsers = new Set(
      (
        await supabaseAdmin
          .from("licenses")
          .select("user_id")
          .eq("status", "active")
          .not("user_id", "is", null)
      ).data?.map((r) => r.user_id) ?? [],
    ).size;

    const failedPayments = (allPayments.data ?? []).filter((p) => p.status === "rejected").length;

    // Revenue by month (últimos 6 meses) para gráfico.
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const { data: recentPayments } = await supabaseAdmin
      .from("payments")
      .select("amount_cents,created_at,status")
      .eq("status", "approved")
      .gte("created_at", sixMonthsAgo.toISOString());

    const monthly: Record<string, number> = {};
    for (const p of recentPayments ?? []) {
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
      licensesActive: licensesActive.count ?? 0,
      licensesExpired: licensesExpired.count ?? 0,
      licensesCancelled: licensesCancelled.count ?? 0,
      freeTrialUsers: trialsTotal.count ?? 0,
      revenueTotalCents,
      mrrCents,
      failedPayments,
      listingsTotal: listingsTotal.count ?? 0,
      revenueByMonth,
      newUsers7d: newUsers7d.count ?? 0,
      activeClients: payingUsers,
      inactiveClients: Math.max((usersTotal.count ?? 0) - payingUsers, 0),
    };
  });

const listClientsSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  filter: z
    .enum(["all", "ativos", "inativos", "expirados", "teste", "pagantes"])
    .default("all"),
});

/** Lista clientes com licença/plano/status para a tabela admin. */
export const adminListClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listClientsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("profiles")
      .select(
        "id,email,full_name,created_at,last_seen_at,free_listings_used,free_listings_limit",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (data.search) {
      query = query.or(`email.ilike.%${data.search}%,full_name.ilike.%${data.search}%`);
    }

    const { data: rows, error, count } = await query.range(
      data.page * data.pageSize,
      data.page * data.pageSize + data.pageSize - 1,
    );
    if (error) throw new Error(`Falha ao listar clientes: ${error.message}`);

    const userIds = (rows ?? []).map((r) => r.id);
    const { data: licRows } = userIds.length
      ? await supabaseAdmin
          .from("licenses")
          .select("id,code,status,expires_at,period,user_id,plan_id")
          .in("user_id", userIds)
      : { data: [] as any[] };
    const planIds = Array.from(new Set((licRows ?? []).map((l: any) => l.plan_id).filter(Boolean)));
    const { data: planRows } = planIds.length
      ? await supabaseAdmin.from("plans").select("id,name").in("id", planIds)
      : { data: [] as any[] };
    const planMap = new Map((planRows ?? []).map((p: any) => [p.id, p.name as string]));
    const licByUser = new Map<string, any[]>();
    for (const l of licRows ?? []) {
      const list = licByUser.get(l.user_id as string) ?? [];
      list.push(l);
      licByUser.set(l.user_id as string, list);
    }

    const now = Date.now();
    const clients = (rows ?? []).map((row) => {
      const licenses = licByUser.get(row.id) ?? [];
      const active = licenses.find((l) => l.status === "active" && (!l.expires_at || new Date(l.expires_at).getTime() > now));
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
  });

/** Clientes inativos agrupados por motivo. */
export const adminListInactiveClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      ).data?.map((r) => r.user_id) ?? [],
    );

    const trialNotConverted = (profiles.data ?? []).filter(
      (p) => (p.free_listings_used ?? 0) >= (p.free_listings_limit ?? 0) && !activeUserIds.has(p.id),
    );

    return {
      trialNaoConvertido: trialNotConverted.map((p) => ({ id: p.id, email: p.email, full_name: p.full_name })),
      licencaExpirada: expiredLicenses.data ?? [],
      assinaturaCancelada: cancelledLicenses.data ?? [],
      pagamentoFalho: failedPayments.data ?? [],
    };
  });

const licenseActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["activate", "suspend", "cancel", "renew"]),
  months: z.number().int().min(1).max(24).optional(),
});

/** Ações administrativas sobre uma licença (ativar/suspender/cancelar/renovar). */
export const adminLicenseAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => licenseActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
      if (error) throw new Error("Falha ao renovar licença.");
      return { ok: true as const };
    }

    const statusMap = { activate: "active", suspend: "suspended", cancel: "cancelled" } as const;
    const status = statusMap[data.action as "activate" | "suspend" | "cancel"];
    const { error } = await supabaseAdmin.from("licenses").update({ status }).eq("id", data.id);
    if (error) throw new Error("Falha ao atualizar licença.");

    await supabaseAdmin.from("activity_events").insert({
      user_id: context.userId,
      kind: "admin_license_action",
      message: `Licença ${data.id} → ${data.action}`,
      meta: { license_id: data.id, action: data.action },
    });

    return { ok: true as const };
  });

const updatePlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  tagline: z.string().nullish(),
  price_monthly_cents: z.number().int().min(0).optional(),
  listing_limit: z.number().int().nullish(),
  ai_credits: z.number().int().nullish(),
  features: z.array(z.string()).optional(),
  highlighted: z.boolean().optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

/** Atualiza um plano existente (preço, features, destaque). */
export const adminUpdatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updatePlanSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as never;
    const { error } = await supabaseAdmin.from("plans").update(cleanPatch).eq("id", id);
    if (error) throw new Error("Falha ao atualizar plano.");
    return { ok: true as const };
  });

const updateDiscountSchema = z.object({
  period: z.enum(["monthly", "quarterly", "semiannual", "annual"]),
  discount_percent: z.number().min(0).max(90),
  label: z.string().min(1).optional(),
});

/** Atualiza o desconto de um período de cobrança. */
export const adminUpdatePeriodDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateDiscountSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = {
      discount_percent: data.discount_percent,
      ...(data.label ? { label: data.label } : {}),
    } as never;
    const { error } = await supabaseAdmin.from("period_discounts").update(patch).eq("period", data.period);
    if (error) throw new Error("Falha ao atualizar período.");
    return { ok: true as const };
  });

// ===================== PAGAMENTOS =====================

const listPaymentsSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(["all", "approved", "pending", "rejected", "cancelled"]).default("all"),
});

/** Lista pagamentos com dados do cliente e plano (somente admin). */
export const adminListPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listPaymentsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveRefs } = await import("@/lib/admin-refs.server");

    let query = supabaseAdmin
      .from("payments")
      .select("id,created_at,amount_cents,status,period,provider,provider_ref,user_id,plan_id", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    if (data.status !== "all") {
      query = query.eq("status", data.status);
    }

    const { data: rows, error, count } = await query.range(
      data.page * data.pageSize,
      data.page * data.pageSize + data.pageSize - 1,
    );
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
  });

// ===================== ASSINATURAS (LICENÇAS COM CLIENTE) =====================

const listSubscriptionsSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(["all", "available", "active", "expired", "suspended", "cancelled"]).default("all"),
});

/** Lista licenças vinculadas a usuário com dados de cliente/plano. */
export const adminListSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listSubscriptionsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { resolveRefs } = await import("@/lib/admin-refs.server");

    let query = supabaseAdmin
      .from("licenses")
      .select("id,code,status,period,created_at,expires_at,user_id,plan_id", {
        count: "exact",
      })
      .not("user_id", "is", null)
      .order("created_at", { ascending: false });

    if (data.status !== "all") {
      query = query.eq("status", data.status);
    }

    const { data: rows, error, count } = await query.range(
      data.page * data.pageSize,
      data.page * data.pageSize + data.pageSize - 1,
    );
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
  });

// ===================== ANÚNCIOS PROCESSADOS =====================

/** Métricas de listings por status e jobs em lote recentes. */
export const adminGetListingsMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    const { resolveRefs } = await import("@/lib/admin-refs.server");
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
  });

// ===================== TESTES GRATUITOS =====================

/** Lista uso do plano gratuito por usuário. */
export const adminListFreeTrials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,free_listings_used,free_listings_limit,created_at,last_seen_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Falha ao listar testes gratuitos.");

    const activeLicenseUserIds = new Set(
      (await supabaseAdmin.from("licenses").select("user_id").eq("status", "active")).data?.map(
        (r) => r.user_id,
      ) ?? [],
    );

    const trials = (profiles ?? []).map((p) => ({
      ...p,
      converted: activeLicenseUserIds.has(p.id),
      exhausted: (p.free_listings_used ?? 0) >= (p.free_listings_limit ?? 0),
    }));

    return { trials };
  });

// ===================== INTEGRAÇÕES (WEBHOOKS ML) =====================

/** Contagem de notificações do ML processadas nas últimas 24h. */
export const adminGetWebhooksStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [processed, received] = await Promise.all([
      supabaseAdmin
        .from("ml_notifications")
        .select("id", { count: "exact", head: true })
        .eq("processed", true)
        .gte("received_at", since),
      supabaseAdmin
        .from("ml_notifications")
        .select("id", { count: "exact", head: true })
        .gte("received_at", since),
    ]);

    return {
      processedLast24h: processed.count ?? 0,
      receivedLast24h: received.count ?? 0,
    };
  });

// ===================== LOGS =====================

const listActivitySchema = z.object({
  kind: z.string().optional(),
});

/** Lista os últimos 100 eventos de atividade (logs) do sistema. */
export const adminListActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listActivitySchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    const { resolveRefs } = await import("@/lib/admin-refs.server");
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
  });

// ===================== CUPONS =====================

/** Lista cupons cadastrados. */
export const adminListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .order("code", { ascending: true });
    if (error) throw new Error("Falha ao listar cupons.");
    return { coupons: data ?? [] };
  });

const createCouponSchema = z.object({
  code: z.string().min(3).max(40),
  discount_percent: z.number().min(1).max(90),
  max_uses: z.number().int().min(1).nullish(),
  expires_at: z.string().nullish(),
});

/** Cria um novo cupom de desconto. */
export const adminCreateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createCouponSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("coupons").insert({
      code: data.code.toUpperCase().trim(),
      discount_percent: data.discount_percent,
      max_uses: data.max_uses ?? null,
      expires_at: data.expires_at ?? null,
      active: true,
      uses: 0,
    });
    if (error) throw new Error("Falha ao criar cupom. Verifique se o código já existe.");
    return { ok: true as const };
  });

const toggleCouponSchema = z.object({
  code: z.string().min(1),
  active: z.boolean(),
});

/** Ativa ou desativa um cupom. */
export const adminToggleCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => toggleCouponSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("coupons").update({ active: data.active }).eq("code", data.code);
    if (error) throw new Error("Falha ao atualizar cupom.");
    return { ok: true as const };
  });
