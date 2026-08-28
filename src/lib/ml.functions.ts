import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PUBLIC_CALLBACK = "https://anunciomlbr.lovable.app/api/public/ml/callback";
const ML_API = "https://api.mercadolibre.com";

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

function mapSearchResult(raw: Record<string, unknown>): MlItem {
  const seller = raw["seller"] as { nickname?: string } | undefined;
  const price = typeof raw["price"] === "number" ? (raw["price"] as number) : null;
  return {
    id: String(raw["id"] ?? ""),
    title: String(raw["title"] ?? ""),
    price_cents: price === null ? null : Math.round(price * 100),
    thumbnail: httpsUrl(raw["thumbnail"]),
    permalink: httpsUrl(raw["permalink"]),
    category: (raw["category_id"] as string) ?? null,
    seller: seller?.nickname ?? null,
    condition: (raw["condition"] as string) ?? null,
    available_quantity: (raw["available_quantity"] as number) ?? null,
    sold_quantity: (raw["sold_quantity"] as number) ?? null,
    status: (raw["status"] as string) ?? null,
  };
}

async function getSellerNickname(sellerId: string, accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${ML_API}/users/${encodeURIComponent(sellerId)}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "ANUNCIO-ML/1.0",
      },
    });
    if (!response.ok) return null;
    const raw = (await response.json()) as { nickname?: unknown };
    return typeof raw.nickname === "string" && raw.nickname.trim() ? raw.nickname.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Usa o buscador oficial de produtos do Mercado Livre e converte os produtos de catálogo
 * em anúncios reais através do buy_box_winner. É o caminho principal para palavra-chave.
 */
async function searchCatalogProducts(query: string, limit: number, accessToken: string): Promise<MlItem[]> {
  const requested = Math.min(Math.max(limit, 1), 30);
  const catalogUrl = new URL(`${ML_API}/products/search`);
  catalogUrl.searchParams.set("status", "active");
  catalogUrl.searchParams.set("site_id", "MLB");
  catalogUrl.searchParams.set("q", query);
  catalogUrl.searchParams.set("limit", String(requested));

  const catalogResponse = await fetch(catalogUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ANUNCIO-ML/1.0",
    },
  });
  if (!catalogResponse.ok) throw new Error(`ML products search responded ${catalogResponse.status}`);

  const catalogPayload = (await catalogResponse.json()) as { results?: Array<{ id?: string }> };
  const productIds = (catalogPayload.results ?? [])
    .map((result) => result.id)
    .filter((id): id is string => !!id)
    .slice(0, requested);

  const sellerCache = new Map<string, Promise<string | null>>();
  const sellerName = (sellerId: string) => {
    const existing = sellerCache.get(sellerId);
    if (existing) return existing;
    const promise = getSellerNickname(sellerId, accessToken);
    sellerCache.set(sellerId, promise);
    return promise;
  };

  const details = await Promise.all(
    productIds.map(async (productId) => {
      try {
        const productResponse = await fetch(`${ML_API}/products/${encodeURIComponent(productId)}`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, "User-Agent": "ANUNCIO-ML/1.0" },
        });
        if (!productResponse.ok) return null;
        const product = (await productResponse.json()) as Record<string, unknown>;
        const winner = product["buy_box_winner"] as Record<string, unknown> | undefined;
        const itemId = typeof winner?.["item_id"] === "string" ? winner["item_id"] : null;
        if (!itemId) return null;

        const itemResponse = await fetch(`${ML_API}/items/${encodeURIComponent(itemId)}`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}`, "User-Agent": "ANUNCIO-ML/1.0" },
        });
        if (!itemResponse.ok) return null;
        const itemRaw = (await itemResponse.json()) as Record<string, unknown>;
        const price = typeof itemRaw["price"] === "number" ? itemRaw["price"] : null;
        const pictures = Array.isArray(itemRaw["pictures"])
          ? (itemRaw["pictures"] as Array<{ secure_url?: string; url?: string }>)
          : [];
        const images = pictures
          .map((picture) => httpsUrl(picture.secure_url ?? picture.url))
          .filter((value): value is string => !!value);
        const sellerId = itemRaw["seller_id"] != null ? String(itemRaw["seller_id"]) : null;

        return {
          id: String(itemRaw["id"] ?? itemId),
          title: String(itemRaw["title"] ?? product["name"] ?? ""),
          price_cents: price === null ? null : Math.round(price * 100),
          thumbnail: httpsUrl(itemRaw["thumbnail"]) ?? images[0] ?? null,
          permalink: httpsUrl(itemRaw["permalink"]) ?? httpsUrl(product["permalink"]),
          category: (itemRaw["category_id"] as string) ?? null,
          seller: sellerId ? await sellerName(sellerId) : null,
          condition: (itemRaw["condition"] as string) ?? null,
          available_quantity: (itemRaw["available_quantity"] as number) ?? null,
          sold_quantity: (itemRaw["sold_quantity"] as number) ?? null,
          status: (itemRaw["status"] as string) ?? null,
          images,
          attributes: Array.isArray(itemRaw["attributes"]) ? (itemRaw["attributes"] as unknown[]) : [],
        } satisfies MlItem;
      } catch {
        return null;
      }
    }),
  );

  return details.filter((item): item is MlItem => !!item);
}

/** Compatibilidade com a busca de listagens do marketplace quando a rota estiver disponível. */
async function searchMarketplaceListings(query: string, limit: number, accessToken: string): Promise<MlItem[]> {
  const url = new URL(`${ML_API}/sites/MLB/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ANUNCIO-ML/1.0",
    },
  });
  if (!response.ok) throw new Error(`ML marketplace search responded ${response.status}`);
  const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
  return (payload.results ?? []).map(mapSearchResult).filter((item) => !!item.id);
}

function mergeSearchResults(primary: MlItem[], secondary: MlItem[], limit: number): MlItem[] {
  const unique = new Map<string, MlItem>();
  for (const item of [...primary, ...secondary]) {
    if (item.id && !unique.has(item.id)) unique.set(item.id, item);
  }
  return Array.from(unique.values()).slice(0, limit);
}

/**
 * Busca por palavra-chave usando os recursos oficiais atuais do Mercado Livre.
 * products/search é o caminho principal documentado para q; /sites/MLB/search fica como
 * compatibilidade para ampliar o conjunto quando estiver habilitado para a aplicação.
 */
export const searchMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(50).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const tokenState = await getUserMlToken(context.userId);
    if (!tokenState.ok) {
      return {
        ok: false as const,
        configured: true,
        reason: "Conecte sua conta do Mercado Livre antes de buscar anúncios.",
        items: [] as MlItem[],
      };
    }

    const limit = data.limit ?? 24;
    const [catalogResult, marketplaceResult] = await Promise.allSettled([
      searchCatalogProducts(data.query, limit, tokenState.accessToken),
      searchMarketplaceListings(data.query, limit, tokenState.accessToken),
    ]);

    const catalogItems = catalogResult.status === "fulfilled" ? catalogResult.value : [];
    const marketplaceItems = marketplaceResult.status === "fulfilled" ? marketplaceResult.value : [];
    const items = mergeSearchResults(marketplaceItems, catalogItems, limit);

    if (items.length > 0) return { ok: true as const, configured: true, items, reason: null };

    if (catalogResult.status === "rejected") console.error("ML products search failed", catalogResult.reason);
    if (marketplaceResult.status === "rejected") console.error("ML marketplace search failed", marketplaceResult.reason);

    // Uma resposta vazia dos buscadores é resultado válido; não manda o cliente reconectar a conta.
    if (catalogResult.status === "fulfilled" || marketplaceResult.status === "fulfilled") {
      return { ok: true as const, configured: true, items: [] as MlItem[], reason: null };
    }

    return {
      ok: false as const,
      configured: true,
      reason: "O Mercado Livre não respondeu à busca agora. Sua conta continua conectada; tente novamente em instantes.",
      items: [] as MlItem[],
    };
  });

/** Monta a URL oficial de autorização OAuth do Mercado Livre. */
export const getMlAuthorizationUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = process.env["ML_CLIENT_ID"]?.trim();
    if (!clientId) {
      console.warn("ML OAuth start blocked: missing ML_CLIENT_ID");
      return { configured: false as const, url: null, reason: "not_configured" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ml_oauth_states").delete().lt("expires_at", new Date().toISOString());

    const state = crypto.randomUUID();
    const { error } = await supabaseAdmin.from("ml_oauth_states").insert({
      state,
      user_id: context.userId,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    if (error) {
      console.error("ML OAuth state persist failed", { code: error.code, message: error.message });
      return { configured: true as const, url: null, reason: "state_error" as const };
    }

    const url = new URL("https://auth.mercadolivre.com.br/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", PUBLIC_CALLBACK);
    url.searchParams.set("state", state);
    return { configured: true as const, url: url.toString(), reason: null };
  });

/** Estado da conexão do usuário com o Mercado Livre + diagnóstico OAuth não sensível. */
export const getMlConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ml_connections")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const clientId = process.env["ML_CLIENT_ID"]?.trim();
    const hasClientSecret = !!process.env["ML_CLIENT_SECRET"]?.trim();
    const configured = !!clientId && hasClientSecret;
    return {
      configured,
      connection: data ?? null,
      diagnostics: {
        callback: PUBLIC_CALLBACK,
        clientIdMasked: maskClientId(clientId),
        hasClientId: !!clientId,
        hasClientSecret,
      },
    };
  });

/** Dispara a sincronização dos anúncios da conta ML conectada. */
export const syncMlListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncUserListings } = await import("@/lib/ml.server");
    return syncUserListings(context.userId);
  });

/** Desconecta a conta do Mercado Livre e apaga os tokens guardados. */
export const disconnectMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ml_tokens").delete().eq("user_id", context.userId);
    await supabaseAdmin
      .from("ml_connections")
      .update({ connected: false, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true as const };
  });

/** Busca um anúncio pelo ID MLB usando a conexão do usuário. */
export const getMercadoLivreItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().trim().regex(/^MLB-?\d+$/i, "ID inválido. Use o formato MLB1234567890.") }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const tokenState = await getUserMlToken(context.userId);
    if (!tokenState.ok) {
      return {
        ok: false as const,
        configured: true,
        reason: "Conecte sua conta do Mercado Livre antes de buscar anúncios.",
        items: [] as MlItem[],
      };
    }

    const id = data.id.toUpperCase().replace("MLB-", "MLB");
    try {
      const response = await fetch(`${ML_API}/items/${id}`, {
        headers: { Authorization: `Bearer ${tokenState.accessToken}`, Accept: "application/json" },
      });
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false as const,
          configured: true,
          reason: "Sua autorização do Mercado Livre expirou. Reconecte sua conta.",
          items: [] as MlItem[],
        };
      }
      if (response.status === 404) {
        return { ok: true as const, configured: true, items: [] as MlItem[], reason: null };
      }
      if (!response.ok) {
        return {
          ok: false as const,
          configured: true,
          reason: `A API do Mercado Livre respondeu ${response.status}.`,
          items: [] as MlItem[],
        };
      }

      const raw = (await response.json()) as Record<string, unknown>;
      const price = typeof raw["price"] === "number" ? (raw["price"] as number) : null;
      const pictures = Array.isArray(raw["pictures"])
        ? (raw["pictures"] as Array<{ secure_url?: string; url?: string }>)
        : [];
      const images = pictures
        .map((picture) => httpsUrl(picture.secure_url ?? picture.url))
        .filter((value): value is string => !!value);
      const thumbnail = httpsUrl(raw["thumbnail"]) ?? images[0] ?? null;
      const attributes = Array.isArray(raw["attributes"]) ? (raw["attributes"] as unknown[]) : [];

      const item: MlItem = {
        id: String(raw["id"] ?? id),
        title: String(raw["title"] ?? ""),
        price_cents: price === null ? null : Math.round(price * 100),
        thumbnail,
        permalink: httpsUrl(raw["permalink"]),
        category: (raw["category_id"] as string) ?? null,
        seller: raw["seller_id"] != null ? String(raw["seller_id"]) : null,
        condition: (raw["condition"] as string) ?? null,
        available_quantity: (raw["available_quantity"] as number) ?? null,
        sold_quantity: (raw["sold_quantity"] as number) ?? null,
        status: (raw["status"] as string) ?? null,
        images,
        attributes,
      };
      return { ok: true as const, configured: true, items: [item], reason: null };
    } catch (error) {
      console.error("ML item lookup failed", error);
      return {
        ok: false as const,
        configured: true,
        reason: "Não foi possível consultar o Mercado Livre agora.",
        items: [] as MlItem[],
      };
    }
  });
