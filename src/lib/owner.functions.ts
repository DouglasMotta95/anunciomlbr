import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Painel de faturamento (receita por dia/semana, churn, licenças ativas). */
export const ownerBillingReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        from: z.string(),
        to: z.string(),
        granularity: z.enum(["day", "week"]).default("day"),
        planId: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getBillingReport } = await import("@/lib/billing.server");
    return getBillingReport(data, context);
  });

/** Exportação de pagamentos, licenças e renovações (CSV/PDF gerados no cliente). */
export const ownerBillingExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        from: z.string(),
        to: z.string(),
        dataset: z.enum(["payments", "licenses", "renewals"]),
        planId: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getBillingExport } = await import("@/lib/billing.server");
    return getBillingExport(data, context);
  });

/** Logs de auditoria administrativa. */
export const ownerAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        page: z.number().min(0).default(0),
        pageSize: z.number().min(5).max(100).default(25),
        action: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { listAuditLogs } = await import("@/lib/billing.server");
    return listAuditLogs(data, context);
  });

/** Perfil e permissões do usuário logado. */
export const ownerMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getMyAdminAccess } = await import("@/lib/team.server");
    return getMyAdminAccess(context);
  });

/** Equipe administrativa e matriz de permissões. */
export const ownerListTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listAdminTeam } = await import("@/lib/team.server");
    return listAdminTeam(context);
  });

/** Define o perfil de acesso de um usuário (somente proprietário). */
export const ownerSetTeamRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        role: z.enum(["owner", "admin", "support", "viewer", "user"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setTeamRole } = await import("@/lib/team.server");
    return setTeamRole(data, context);
  });

/** Configuração dos alertas de vencimento. */
export const ownerGetAlertSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAlertSettings } = await import("@/lib/license-alerts.server");
    return getAlertSettings(context);
  });

export const ownerUpdateAlertSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        enabled: z.boolean().optional(),
        days: z.array(z.number().int().min(1).max(365)).optional(),
        subject_template: z.string().min(3).max(200).optional(),
        body_template: z.string().min(10).max(4000).optional(),
        from_name: z.string().min(2).max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { updateAlertSettings } = await import("@/lib/license-alerts.server");
    return updateAlertSettings(data, context);
  });

/** Dispara manualmente os alertas de vencimento. */
export const ownerRunAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ onlyDays: z.array(z.number().int().min(1).max(365)).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { triggerLicenseAlerts } = await import("@/lib/license-alerts.server");
    return triggerLicenseAlerts(data, context);
  });

/** Histórico de avisos enviados. */
export const ownerAlertHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ page: z.number().min(0).default(0), pageSize: z.number().min(5).max(100).default(25) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { listAlertHistory } = await import("@/lib/license-alerts.server");
    return listAlertHistory(data, context);
  });
