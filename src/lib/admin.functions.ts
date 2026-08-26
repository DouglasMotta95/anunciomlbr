import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createAdminCoupon,
  getAdminListingsMetrics,
  getAdminMetrics,
  getAdminWebhooksStatus,
  listAdminActivity,
  listAdminClients,
  listAdminCoupons,
  listAdminFreeTrials,
  listAdminInactiveClients,
  listAdminPayments,
  listAdminSubscriptions,
  runAdminLicenseAction,
  toggleAdminCoupon,
  updateAdminPeriodDiscount,
  updateAdminPlan,
} from "@/lib/admin.server";

/** Métricas gerais do painel administrativo (somente admin). */
export const adminGetMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getAdminMetrics(context));

/** Lista clientes com licença/plano/status para a tabela admin. */
export const adminListClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
        filter: z.enum(["all", "ativos", "inativos", "expirados", "teste", "pagantes"]).default("all"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => listAdminClients(data, context));

/** Clientes inativos agrupados por motivo. */
export const adminListInactiveClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listAdminInactiveClients(context));

/** Ações administrativas sobre uma licença (ativar/suspender/cancelar/renovar). */
export const adminLicenseAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["activate", "suspend", "cancel", "renew"]),
        months: z.number().int().min(1).max(24).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => runAdminLicenseAction(data, context));

/** Atualiza um plano existente (preço, features, destaque). */
export const adminUpdatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
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
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => updateAdminPlan(data, context));

/** Atualiza o desconto de um período de cobrança. */
export const adminUpdatePeriodDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        period: z.enum(["monthly", "quarterly", "semiannual", "annual"]),
        discount_percent: z.number().min(0).max(90),
        label: z.string().min(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => updateAdminPeriodDiscount(data, context));

/** Lista pagamentos com dados do cliente e plano (somente admin). */
export const adminListPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z.enum(["all", "approved", "pending", "rejected", "cancelled"]).default("all"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => listAdminPayments(data, context));

/** Lista licenças vinculadas a usuário com dados de cliente/plano. */
export const adminListSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(1).max(100).default(20),
        status: z.enum(["all", "available", "active", "expired", "suspended", "cancelled"]).default("all"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => listAdminSubscriptions(data, context));

/** Métricas de listings por status e jobs em lote recentes. */
export const adminGetListingsMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getAdminListingsMetrics(context));

/** Lista uso do plano gratuito por usuário. */
export const adminListFreeTrials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listAdminFreeTrials(context));

/** Contagem de notificações do ML processadas nas últimas 24h. */
export const adminGetWebhooksStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getAdminWebhooksStatus(context));

/** Lista os últimos 100 eventos de atividade (logs) do sistema. */
export const adminListActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ kind: z.string().optional() }).parse(data))
  .handler(async ({ data, context }) => listAdminActivity(data, context));

/** Lista cupons cadastrados. */
export const adminListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listAdminCoupons(context));

/** Cria um novo cupom de desconto. */
export const adminCreateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().min(3).max(40),
        discount_percent: z.number().min(1).max(90),
        max_uses: z.number().int().min(1).nullish(),
        expires_at: z.string().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => createAdminCoupon(data, context));

/** Ativa ou desativa um cupom. */
export const adminToggleCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().min(1),
        active: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => toggleAdminCoupon(data, context));
