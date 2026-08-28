import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PUBLIC_CALLBACK = "https://anunciomlbr.lovable.app/api/public/ml/callback";

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("http://")) return `https://${value.slice("http://".length)}`;
  return value;
}

function maskClientId(value: string | undefined): string | null {
  const clientId = value?.trim();
  if (!clientId) return null;
  if (clientId.length <= 6) return `${clientId.slice(0, 2)}••••`;
  return `${clientId.slice(0, 4)}••••${clientId.slice(-4)}`;
}

export type MlItem = {
  id: string;
  title: string;
  price_cents: number | null;
  thumbnail: string | null;
  permalink: string | null;
  category: string | null;
  seller: string | null;
  condition: string | null;
  available_quantity: number | null;
  sold_quantity: number | null;
  status: string | null;
  images?: string[];
  attributes?: unknown[];
};

async function getUserMlToken(userId: string) {
  const { getValidMlAccessToken } = await import("@/lib/ml.server");
  return getValidMlAccessToken(userId);
}

/** Busca anúncios no catálogo público do Mercado Livre. A sessão do ANÚNCIO ML é obrigatória,
 * mas o endpoint público /sites/MLB/search não deve receber o token OAuth do vendedor. */
export const searchMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(50).optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(data.query)}&limit=${data.limit ?? 20}`;
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "ANUNCIO-ML/1.0" } });
      if (!response.ok) {
        return { ok: false as const, configured: true, reason: `Não foi possível buscar no Mercado Livre agora (código ${response.status}).`, items: [] as MlItem[] };
      }
      const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
      const items: MlItem[] = (payload.results ?? []).map((raw) => {
        const seller = raw["seller"] as { nickname?: string } | undefined;
        const price = typeof raw["price"] === "number" ? (raw["price"] as number) : null;
        return {
          id: String(raw["id"] ?? ""), title: String(raw["title"] ?? ""), price_cents: price === null ? null : Math.round(price * 100),
          thumbnail: httpsUrl(raw["thumbnail"]), permalink: httpsUrl(raw["permalink"]), category: (raw["category_id"] as string) ?? null,
          seller: seller?.nickname ?? null, condition: (raw["condition"] as string) ?? null, available_quantity: (raw["available_quantity"] as number) ?? null,
          sold_quantity: (raw["sold_quantity"] as number) ?? null, status: (raw["status"] as string) ?? null,
        };
      });
      return { ok: true as const, configured: true, items, reason: null };
    } catch (error) {
      console.error("ML search failed", error);
      return { ok: false as const, configured: true, reason: "Não foi possível consultar o Mercado Livre agora.", items: [] as MlItem[] };
    }
  });

export const getMlAuthorizationUrl = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const clientId = process.env["ML_CLIENT_ID"]?.trim();
  if (!clientId) { console.warn("ML OAuth start blocked: missing ML_CLIENT_ID"); return { configured: false as const, url: null, reason: "not_configured" as const }; }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ml_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const state = crypto.randomUUID();
  const { error } = await supabaseAdmin.from("ml_oauth_states").insert({ state, user_id: context.userId, expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
  if (error) { console.error("ML OAuth state persist failed", { code: error.code, message: error.message }); return { configured: true as const, url: null, reason: "state_error" as const }; }
  const url = new URL("https://auth.mercadolivre.com.br/authorization");
  url.searchParams.set("response_type", "code"); url.searchParams.set("client_id", clientId); url.searchParams.set("redirect_uri", PUBLIC_CALLBACK); url.searchParams.set("state", state);
  return { configured: true as const, url: url.toString(), reason: null };
});

export const getMlConnection = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data } = await context.supabase.from("ml_connections").select("*").eq("user_id", context.userId).maybeSingle();
  const clientId = process.env["ML_CLIENT_ID"]?.trim(); const hasClientSecret = !!process.env["ML_CLIENT_SECRET"]?.trim();
  return { configured: !!clientId && hasClientSecret, connection: data ?? null, diagnostics: { callback: PUBLIC_CALLBACK, clientIdMasked: maskClientId(clientId), hasClientId: !!clientId, hasClientSecret } };
});

export const syncMlListings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { syncUserListings } = await import("@/lib/ml.server"); return syncUserListings(context.userId);
});

export const disconnectMercadoLivre = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ml_tokens").delete().eq("user_id", context.userId);
  await supabaseAdmin.from("ml_connections").update({ connected: false, updated_at: new Date().toISOString() }).eq("user_id", context.userId);
  return { ok: true as const };
});

export const getMercadoLivreItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().trim().regex(/^MLB-?\d+$/i, "ID inválido. Use o formato MLB1234567890.") }).parse(data))
  .handler(async ({ data, context }) => {
    const tokenState = await getUserMlToken(context.userId);
    if (!tokenState.ok) return { ok: false as const, configured: true, reason: "Conecte sua conta do Mercado Livre antes de buscar anúncios.", items: [] as MlItem[] };
    const id = data.id.toUpperCase().replace("MLB-", "MLB");
    try {
      const response = await fetch(`https://api.mercadolibre.com/items/${id}`, { headers: { Authorization: `Bearer ${tokenState.accessToken}`, Accept: "application/json" } });
      if (response.status === 401 || response.status === 403) return { ok: false as const, configured: true, reason: "Sua autorização do Mercado Livre expirou. Reconecte sua conta.", items: [] as MlItem[] };
      if (response.status === 404) return { ok: true as const, configured: true, items: [] as MlItem[], reason: null };
      if (!response.ok) return { ok: false as const, configured: true, reason: `A API do Mercado Livre respondeu ${response.status}.`, items: [] as MlItem[] };
      const raw = (await response.json()) as Record<string, unknown>; const price = typeof raw["price"] === "number" ? raw["price"] as number : null;
      const pictures = Array.isArray(raw["pictures"]) ? raw["pictures"] as Array<{ secure_url?: string; url?: string }> : [];
      const images = pictures.map((picture) => httpsUrl(picture.secure_url ?? picture.url)).filter((value): value is string => !!value);
      const item: MlItem = { id: String(raw["id"] ?? id), title: String(raw["title"] ?? ""), price_cents: price === null ? null : Math.round(price * 100), thumbnail: httpsUrl(raw["thumbnail"]) ?? images[0] ?? null, permalink: httpsUrl(raw["permalink"]), category: (raw["category_id"] as string) ?? null, seller: raw["seller_id"] != null ? String(raw["seller_id"]) : null, condition: (raw["condition"] as string) ?? null, available_quantity: (raw["available_quantity"] as number) ?? null, sold_quantity: (raw["sold_quantity"] as number) ?? null, status: (raw["status"] as string) ?? null, images, attributes: Array.isArray(raw["attributes"]) ? raw["attributes"] as unknown[] : [] };
      return { ok: true as const, configured: true, items: [item], reason: null };
    } catch (error) {
      console.error("ML item lookup failed", error); return { ok: false as const, configured: true, reason: "Não foi possível consultar o Mercado Livre agora.", items: [] as MlItem[] };
    }
  });
