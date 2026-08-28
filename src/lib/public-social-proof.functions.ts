import { createServerFn } from "@tanstack/react-start";

/**
 * Métricas agregadas e não identificáveis usadas na landing.
 * Nenhum dado pessoal, token ou informação de cliente é exposto.
 */
export const getPublicSocialProof = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [usersResult, createdResult, publishedResult, connectedResult] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("listing_quota_claims").select("listing_id", { count: "exact", head: true }),
    supabaseAdmin
      .from("listing_quota_claims")
      .select("listing_id,listings!inner(published_at)", { count: "exact", head: true })
      .not("listings.published_at", "is", null),
    supabaseAdmin.from("ml_connections").select("user_id", { count: "exact", head: true }).eq("connected", true),
  ]);

  if (usersResult.error) console.error("public social proof users count failed", usersResult.error.message);
  if (createdResult.error) console.error("public social proof created count failed", createdResult.error.message);
  if (publishedResult.error) console.error("public social proof published count failed", publishedResult.error.message);
  if (connectedResult.error) console.error("public social proof connected count failed", connectedResult.error.message);

  return {
    users: usersResult.count ?? 0,
    createdListings: createdResult.count ?? 0,
    publishedListings: publishedResult.count ?? 0,
    connectedAccounts: connectedResult.count ?? 0,
  };
});
