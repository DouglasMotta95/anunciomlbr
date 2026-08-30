import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const optionalText = z.string().trim().min(1).max(500).optional();

/** Registra um acesso ao site (público: visitantes sem conta também contam). */
export const trackVisit = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        visitor_id: z.string().trim().min(1).max(80),
        session_id: optionalText,
        path: optionalText,
        referrer: optionalText,
        utm_source: optionalText,
        utm_medium: optionalText,
        utm_campaign: optionalText,
        utm_term: optionalText,
        utm_content: optionalText,
        user_agent: optionalText,
        is_authenticated: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { recordVisit } = await import("@/lib/analytics.server");
    // Sempre prefere o User-Agent real da requisição (o cliente pode mentir).
    const realUserAgent = getRequestHeader("user-agent") ?? data.user_agent ?? null;
    return recordVisit(data, realUserAgent);
  });

/** Analytics reais de visitas (somente administradores). */
export const adminGetVisitAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getVisitAnalytics } = await import("@/lib/analytics.server");
    return getVisitAnalytics(context);
  });

/** Registra um evento real do funil (view_plan, start_checkout, purchase). */
export const trackFunnelEvent = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        visitor_id: z.string().trim().min(1).max(80),
        session_id: optionalText,
        event: z.enum(["view_plan", "start_checkout", "purchase"]),
        path: optionalText,
        referrer: optionalText,
        plan_code: optionalText,
        period: optionalText,
        amount_cents: z.number().int().min(0).max(100000000).optional(),
        coupon_code: optionalText,
        meta: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { recordFunnelEvent } = await import("@/lib/analytics.server");
    return recordFunnelEvent(data, getRequestHeader("user-agent") ?? null);
  });

/** Funil de conversão real (somente administradores). */
export const adminGetFunnelAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getFunnelAnalytics } = await import("@/lib/analytics.server");
    return getFunnelAnalytics(context);
  });
