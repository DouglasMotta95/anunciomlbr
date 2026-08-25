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
        "id,email,full_name,created_at,last_seen_at,free_listings_used,free_listings_limit,licenses(id,code,status,expires_at,period,plans(id,name))",
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
    if (error) throw new Error("Falha ao listar clientes.");

    const now = Date.now();
    const clients = (rows ?? []).map((row) => {
      const licenses = (row.licenses ?? []) as Array<{
        id: string;
        code: string;
        status: string;
        expires_at: string | null;
        period: string;
        plans: { id: string; name: string } | null;
      }>;
      const active = licenses.find((l) => l.status === "active" && (!l.expires_at || new Date(l.expires_at).getTime() > now));
      const expired = licenses.find(
        (l) => l.status === "expired" || (l.status === "active" && l.expires_at && new Date(l.expires_at).getTime() <= now),
      );
      const isTrial = !active && !expired && (row.free_listings_used ?? 0) < (row.free_listings_limit ?? 0);
      let status: "ativo" | "inativo" | "expirado" | "teste" = "inativo";
      if (active) status = "ativo";
      else if (expired) status = "expirado";
      else if (isTrial) status = "teste";

      return {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        created_at: row.created_at,
        last_seen_at: row.last_seen_at,
        status,
        plan: active?.plans?.name ?? expired?.plans?.name ?? null,
        license_code: active?.code ?? expired?.code ?? null,
        license_expires_at: active?.expires_at ?? expired?.expires_at ?? null,
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
    const { error } = await supabaseAdmin.from("plans").update(patch).eq("id", id);
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
    const patch: Record<string, unknown> = { discount_percent: data.discount_percent };
    if (data.label) patch.label = data.label;
    const { error } = await supabaseAdmin.from("period_discounts").update(patch).eq("period", data.period);
    if (error) throw new Error("Falha ao atualizar período.");
    return { ok: true as const };
  });
