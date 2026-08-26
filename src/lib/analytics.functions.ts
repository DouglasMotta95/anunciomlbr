import { createServerFn, getRequestHeader } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const optionalText = z.string().trim().min(1).max(500).optional();

/** Registra um acesso ao site (público: visitantes sem conta também contam). */
export const trackVisit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
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
        is_authenticated: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { recordVisit } = await import("@/lib/analytics.server");
    const userAgent = getRequestHeader("user-agent");
    return recordVisit(data, userAgent ?? null);
  });

/** Analytics reais de visitas (somente administradores). */
export const adminGetVisitAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getVisitAnalytics } = await import("@/lib/analytics.server");
    return getVisitAnalytics(context);
  });
