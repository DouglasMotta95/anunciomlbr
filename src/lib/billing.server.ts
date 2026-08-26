import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveRefs } from "@/lib/admin-refs.server";
import { assertCapability } from "@/lib/permissions.server";

type Ctx = { supabase: any; userId: string };

export type BillingReportInput = {
  from: string;
  to: string;
  granularity: "day" | "week";
  planId?: string | undefined;
};

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Segunda-feira da semana da data (chave de agrupamento semanal). */
function weekKey(iso: string) {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Painel de faturamento: receita por dia/semana, churn e licenças ativas. */
export async function getBillingReport(data: BillingReportInput, context: Ctx) {
  await assertCapability(context, "admin.access");

  const fromIso = new Date(data.from).toISOString();
  const toIso = new Date(data.to).toISOString();

  let paymentsQuery = supabaseAdmin
    .from("payments")
    .select("id,amount_cents,status,plan_id,period,created_at,user_id")
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  if (data.planId) paymentsQuery = paymentsQuery.eq("plan_id", data.planId);

  let licensesQuery = supabaseAdmin
    .from("licenses")
    .select("id,status,plan_id,period,created_at,activated_at,expires_at,user_id,origin");
  if (data.planId) licensesQuery = licensesQuery.eq("plan_id", data.planId);

  const [{ data: payments, error: payErr }, { data: licenses, error: licErr }] = await Promise.all([
    paymentsQuery,
    licensesQuery,
  ]);
  if (payErr) throw new Error(`Falha ao ler pagamentos: ${payErr.message}`);
  if (licErr) throw new Error(`Falha ao ler licenças: ${licErr.message}`);

  const approved = ((payments ?? []) as any[]).filter((p) => p.status === "approved");
  const keyOf = data.granularity === "week" ? weekKey : dayKey;

  const buckets = new Map<string, { key: string; receita: number; pagamentos: number; licencas: number }>();
  const ensure = (key: string) => {
    if (!buckets.has(key)) buckets.set(key, { key, receita: 0, pagamentos: 0, licencas: 0 });
    return buckets.get(key)!;
  };

  for (const p of approved) {
    const b = ensure(keyOf(p.created_at));
    b.receita += (p.amount_cents ?? 0) / 100;
    b.pagamentos += 1;
  }

  const licensesInRange = ((licenses ?? []) as any[]).filter(
    (l) => l.created_at >= fromIso && l.created_at <= toIso,
  );
  for (const l of licensesInRange) {
    ensure(keyOf(l.created_at)).licencas += 1;
  }

  const series = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));

  const now = new Date();
  const all = (licenses ?? []) as any[];
  const activeNow = all.filter(
    (l) => l.status === "active" && (!l.expires_at || new Date(l.expires_at) > now),
  );

  // Churn do período: licenças que saíram (expiradas/canceladas/suspensas no intervalo)
  // sobre a base que estava ativa no início do período.
  const lost = all.filter(
    (l) =>
      ["expired", "cancelled", "suspended"].includes(l.status) &&
      l.expires_at &&
      l.expires_at >= fromIso &&
      l.expires_at <= toIso,
  );
  const baseStart = all.filter(
    (l) => l.created_at <= fromIso && (!l.expires_at || l.expires_at >= fromIso),
  ).length;
  const churnRate = baseStart > 0 ? (lost.length / baseStart) * 100 : 0;

  const receitaTotal = approved.reduce((sum, p) => sum + (p.amount_cents ?? 0) / 100, 0);
  const ticketMedio = approved.length ? receitaTotal / approved.length : 0;

  // Receita por plano no período
  const planTotals = new Map<string, { plan_id: string; receita: number; vendas: number }>();
  for (const p of approved) {
    const id = p.plan_id ?? "sem-plano";
    const row = planTotals.get(id) ?? { plan_id: id, receita: 0, vendas: 0 };
    row.receita += (p.amount_cents ?? 0) / 100;
    row.vendas += 1;
    planTotals.set(id, row);
  }
  const { planMap } = await resolveRefs(
    supabaseAdmin,
    Array.from(planTotals.values()).map((r) => ({ plan_id: r.plan_id })),
  );

  return {
    series,
    granularity: data.granularity,
    totals: {
      receitaTotal,
      pagamentosAprovados: approved.length,
      pagamentosTotais: (payments ?? []).length,
      ticketMedio,
      licencasAtivas: activeNow.length,
      licencasVendidas: licensesInRange.length,
      churnCount: lost.length,
      churnRate,
      baseInicial: baseStart,
    },
    byPlan: Array.from(planTotals.values())
      .map((r) => ({ ...r, plan_name: planMap.get(r.plan_id) ?? "Sem plano" }))
      .sort((a, b) => b.receita - a.receita),
  };
}

export type ExportInput = {
  from: string;
  to: string;
  dataset: "payments" | "licenses" | "renewals";
  planId?: string | undefined;
};

/** Dados tabulares (cabeçalho + linhas) para exportação em CSV/PDF. */
export async function getBillingExport(data: ExportInput, context: Ctx) {
  await assertCapability(context, "export.data");

  const fromIso = new Date(data.from).toISOString();
  const toIso = new Date(data.to).toISOString();

  if (data.dataset === "payments") {
    let q = supabaseAdmin
      .from("payments")
      .select("id,created_at,user_id,plan_id,period,amount_cents,status,provider,provider_ref")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false });
    if (data.planId) q = q.eq("plan_id", data.planId);
    const { data: rows, error } = await q;
    if (error) throw new Error(`Falha ao exportar pagamentos: ${error.message}`);
    const { emailMap, planMap } = await resolveRefs(supabaseAdmin, (rows ?? []) as any[]);
    return {
      title: "Histórico de pagamentos",
      columns: ["Data", "Cliente", "Plano", "Período", "Valor (R$)", "Status", "Provedor", "Referência"],
      rows: ((rows ?? []) as any[]).map((r) => [
        new Date(r.created_at).toLocaleString("pt-BR"),
        emailMap.get(r.user_id) ?? "—",
        r.plan_id ? planMap.get(r.plan_id) ?? "—" : "—",
        r.period,
        ((r.amount_cents ?? 0) / 100).toFixed(2),
        r.status,
        r.provider,
        r.provider_ref ?? "—",
      ]),
    };
  }

  if (data.dataset === "licenses") {
    let q = supabaseAdmin
      .from("licenses")
      .select("code,created_at,activated_at,expires_at,status,origin,period,user_id,plan_id,ads_quota,ads_used")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false });
    if (data.planId) q = q.eq("plan_id", data.planId);
    const { data: rows, error } = await q;
    if (error) throw new Error(`Falha ao exportar licenças: ${error.message}`);
    const { emailMap, planMap } = await resolveRefs(supabaseAdmin, (rows ?? []) as any[]);
    return {
      title: "Licenças vendidas / geradas",
      columns: ["Chave", "Criada em", "Cliente", "Plano", "Período", "Status", "Origem", "Validade", "Anúncios"],
      rows: ((rows ?? []) as any[]).map((r) => [
        r.code,
        new Date(r.created_at).toLocaleString("pt-BR"),
        r.user_id ? emailMap.get(r.user_id) ?? "—" : "Sem cliente",
        r.plan_id ? planMap.get(r.plan_id) ?? "—" : "—",
        r.period,
        r.status,
        r.origin,
        r.expires_at ? new Date(r.expires_at).toLocaleDateString("pt-BR") : "—",
        r.ads_quota === null ? "ilimitado" : `${r.ads_used}/${r.ads_quota}`,
      ]),
    };
  }

  const { data: rows, error } = await supabaseAdmin
    .from("admin_audit_logs")
    .select("created_at,actor_email,action,entity_id,target_email,details")
    .in("action", ["license_renew", "license_reset", "license_activate"])
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao exportar renovações: ${error.message}`);

  return {
    title: "Renovações e ajustes de licença",
    columns: ["Data", "Ação", "Executado por", "Cliente", "Licença", "Detalhes"],
    rows: ((rows ?? []) as any[]).map((r) => [
      new Date(r.created_at).toLocaleString("pt-BR"),
      r.action,
      r.actor_email ?? "—",
      r.target_email ?? "—",
      r.entity_id ?? "—",
      JSON.stringify(r.details ?? {}),
    ]),
  };
}

export type AuditListInput = {
  page: number;
  pageSize: number;
  action?: string | undefined;
  search?: string | undefined;
};

/** Logs de auditoria administrativa paginados. */
export async function listAuditLogs(data: AuditListInput, context: Ctx) {
  await assertCapability(context, "admin.access");

  const from = data.page * data.pageSize;
  let q = supabaseAdmin
    .from("admin_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + data.pageSize - 1);

  if (data.action && data.action !== "all") q = q.eq("action", data.action);
  const term = data.search?.trim();
  if (term) q = q.or(`target_email.ilike.%${term}%,actor_email.ilike.%${term}%,entity_id.ilike.%${term}%`);

  const { data: rows, count, error } = await q;
  if (error) throw new Error(`Falha ao listar auditoria: ${error.message}`);

  return { logs: (rows ?? []) as any[], total: count ?? 0 };
}
