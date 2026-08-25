import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IntegrationStatus = "connected" | "pending" | "error";

/**
 * Retorna apenas o estado (booleans) das integrações — nunca segredos.
 */
export const getIntegrationsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hasMlCredentials = !!process.env["ML_CLIENT_ID"] && !!process.env["ML_REDIRECT_URI"];
    const hasMercadoPagoToken = !!process.env["MERCADOPAGO_ACCESS_TOKEN"];
    const aiConfigured = !!process.env["LOVABLE_API_KEY"] || !!process.env["OPENAI_API_KEY"];

    const { data: mlConnection } = await context.supabase
      .from("ml_connections")
      .select("connected,last_sync_at,nickname")
      .eq("user_id", context.userId)
      .maybeSingle();

    const googleConnected = false; // sem integração de login Google implementada ainda

    return {
      mercadoLivre: {
        status: (mlConnection?.connected
          ? "connected"
          : hasMlCredentials
            ? "pending"
            : "pending") as IntegrationStatus,
        hasMlCredentials,
        connected: !!mlConnection?.connected,
        lastSyncAt: mlConnection?.last_sync_at ?? null,
        nickname: mlConnection?.nickname ?? null,
      },
      mercadoPago: {
        status: (hasMercadoPagoToken ? "connected" : "pending") as IntegrationStatus,
        hasMercadoPagoToken,
      },
      google: {
        status: (googleConnected ? "connected" : "pending") as IntegrationStatus,
        connected: googleConnected,
      },
      anuncioAi: {
        status: (aiConfigured ? "connected" : "pending") as IntegrationStatus,
        aiConfigured,
      },
    };
  });
