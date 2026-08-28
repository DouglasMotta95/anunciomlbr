import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMercadoLivreConnectionState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: connection, error }, { getValidMlAccessToken }] = await Promise.all([
      context.supabase
        .from("ml_connections")
        .select("ml_user_id,nickname,connected,listings_count,last_sync_at,updated_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
      import("@/lib/ml.server"),
    ]);
    if (error) console.error("ML connection state lookup failed", error.message);
    const token = await getValidMlAccessToken(context.userId);
    const connected = token.ok === true;

    // Mantém o metadado sincronizado com a fonte real de autorização.
    if (connection && Boolean(connection.connected) !== connected) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ml_connections").update({ connected, updated_at: new Date().toISOString() }).eq("user_id", context.userId);
    }

    return {
      connection: {
        connected,
        ml_user_id: connection?.ml_user_id ?? null,
        nickname: connection?.nickname ?? null,
        listings_count: connection?.listings_count ?? 0,
        last_sync_at: connection?.last_sync_at ?? null,
      },
    };
  });

export const syncMercadoLivreCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncUserListingsFast } = await import("@/lib/ml-sync-fast.server");
    return syncUserListingsFast(context.userId);
  });
