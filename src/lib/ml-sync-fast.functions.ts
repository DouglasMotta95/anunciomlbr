import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncMercadoLivreCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncUserListingsFast } = await import("@/lib/ml-sync-fast.server");
    return syncUserListingsFast(context.userId);
  });
