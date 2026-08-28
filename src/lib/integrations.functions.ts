import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IntegrationStatus = "connected" | "pending" | "error";

/** Retorna somente estados de integração. Nunca devolve tokens, secrets ou senhas. */
export const getIntegrationsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hasMlCredentials = !!process.env["ML_CLIENT_ID"] && !!process.env["ML_REDIRECT_URI"];
    const hasMercadoPagoToken = !!process.env["MERCADOPAGO_ACCESS_TOKEN"];
    const aiConfigured =
      !!process.env["GEMINI_API_KEY"] ||
      !!process.env["LOVABLE_API_KEY"] ||
      !!process.env["OPENAI_API_KEY"];

    const { data: mlConnection } = await context.supabase
      .from("ml_connections")
      .select("connected,last_sync_at,nickname")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokenRow } = await supabaseAdmin
      .from("ml_tokens")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    // O token permanece exclusivamente no backend. O cliente recebe apenas um booleano.
    const mlConnected = !!mlConnection && (mlConnection.connected || !!tokenRow);

    return {
      mercadoLivre: {
        status: (mlConnected ? "connected" : "pending") as IntegrationStatus,
        hasMlCredentials,
        connected: mlConnected,
        lastSyncAt: mlConnection?.last_sync_at ?? null,
        nickname: mlConnection?.nickname ?? null,
      },
      mercadoPago: {
        status: (hasMercadoPagoToken ? "connected" : "pending") as IntegrationStatus,
        hasMercadoPagoToken,
      },
      google: {
        status: "pending" as IntegrationStatus,
        connected: false,
      },
      anuncioAi: {
        status: (aiConfigured ? "connected" : "pending") as IntegrationStatus,
        aiConfigured,
      },
    };
  });
