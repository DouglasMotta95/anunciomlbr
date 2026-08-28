import { createServerFn } from "@tanstack/react-start";

type PublicSocialProof = {
  users: number;
  createdListings: number;
  publishedListings: number;
  connectedAccounts: number;
};

let cached: { value: PublicSocialProof; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

/**
 * Métricas agregadas e não identificáveis usadas na landing.
 * Nenhum dado pessoal, token ou informação de cliente é exposto.
 * O cache curto evita quatro contagens no banco a cada visita à página pública.
 */
export const getPublicSocialProof = createServerFn({ method: "GET" }).handler(async () => {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

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

  const value: PublicSocialProof = {
    users: usersResult.count ?? 0,
    createdListings: createdResult.count ?? 0,
    publishedListings: publishedResult.count ?? 0,
    connectedAccounts: connectedResult.count ?? 0,
  };

  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
});
