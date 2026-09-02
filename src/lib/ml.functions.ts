import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PUBLIC_CALLBACK = "https://anunciomlbr.lovable.app/api/public/ml/callback";
const ML_API = "https://api.mercadolibre.com";

export type MlSerializable =
  | string
  | number
  | boolean
  | null
  | MlSerializable[]
  | { [key: string]: MlSerializable };

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
  images: string[];
  attributes: MlSerializable[];
};

type SearchResult = {
  ok: boolean;
  configured: true;
  reason: string | null;
  items: MlItem[];
};

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

export function toMlSerializable(value: unknown): MlSerializable {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((entry) => toMlSerializable(entry));
  if (typeof value === "object") {
    const output: { [key: string]: MlSerializable } = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (
        entry === undefined ||
        typeof entry === "function" ||
        typeof entry === "symbol" ||
        typeof entry === "bigint"
      ) {
        continue;
      }
      output[key] = toMlSerializable(entry);
    }
    return output;
  }
  return null;
}

export function serializeMlArray(value: unknown): MlSerializable[] {
  return Array.isArray(value) ? value.map((entry) => toMlSerializable(entry)) : [];
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function getUserMlToken(userId: string) {
  const { getValidMlAccessToken } = await import("@/lib/ml.server");
  return getValidMlAccessToken(userId);
}

function mlHeaders(accessToken: string) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "ANUNCIO-ML/1.0",
  };
}

function mapSearchResult(raw: Record<string, unknown>): MlItem {
  const seller = raw["seller"] as Record<string, unknown> | undefined;
  const price = optionalNumber(raw["price"]);
  return {
    id: String(raw["id"] ?? ""),
    title: String(raw["title"] ?? ""),
    price_cents: price === null ? null : Math.round(price * 100),
    thumbnail: httpsUrl(raw["thumbnail"]),
    permalink: httpsUrl(raw["permalink"]),
    category: optionalString(raw["category_id"]),
    seller: optionalString(seller?.["nickname"]),
    condition: optionalString(raw["condition"]),
    available_quantity: optionalNumber(raw["available_quantity"]),
    sold_quantity: optionalNumber(raw["sold_quantity"]),
    status: optionalString(raw["status"]),
    images: [],
    attributes: [],
  };
}

async function getSellerNickname(sellerId: string, accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${ML_API}/users/${encodeURIComponent(sellerId)}`, {
      headers: mlHeaders(accessToken),
    });
    if (!response.ok) return null;
    const raw = (await response.json()) as Record<string, unknown>;
    const nickname = optionalString(raw["nickname"]);
    return nickname?.trim() || null;
  } catch {
    return null;
  }
}

async function fetchItem(itemId: string, accessToken: string): Promise<MlItem | null> {
  try {
    const response = await fetch(`${ML_API}/items/${encodeURIComponent(itemId)}`, {
      headers: mlHeaders(accessToken),
    });
    if (!response.ok) return null;

    const raw = (await response.json()) as Record<string, unknown>;
    const price = optionalNumber(raw["price"]);
    const pictures = Array.isArray(raw["pictures"])
      ? (raw["pictures"] as Array<Record<string, unknown>>)
      : [];
    const images = pictures
      .map((picture) => httpsUrl(picture["secure_url"] ?? picture["url"]))
      .filter((value): value is string => !!value);
    const sellerId = raw["seller_id"] != null ? String(raw["seller_id"]) : null;

    return {
      id: String(raw["id"] ?? itemId),
      title: String(raw["title"] ?? ""),
      price_cents: price === null ? null : Math.round(price * 100),
      thumbnail: httpsUrl(raw["thumbnail"]) ?? images[0] ?? null,
      permalink: httpsUrl(raw["permalink"]),
      category: optionalString(raw["category_id"]),
      seller: sellerId ? await getSellerNickname(sellerId, accessToken) : null,
      condition: optionalString(raw["condition"]),
      available_quantity: optionalNumber(raw["available_quantity"]),
      sold_quantity: optionalNumber(raw["sold_quantity"]),
      status: optionalString(raw["status"]),
      images,
      attributes: serializeMlArray(raw["attributes"]),
    };
  } catch {
    return null;
  }
}

async function enrichItems(items: MlItem[], accessToken: string, limit: number): Promise<MlItem[]> {
  const selected = items.filter((item) => !!item.id).slice(0, limit);
  return Promise.all(
    selected.map(async (item) => {
      const detail = await fetchItem(item.id, accessToken);
      return detail ?? item;
    }),
  );
}

async function searchCatalogProducts(
  query: string,
  limit: number,
  accessToken: string,
): Promise<MlItem[]> {
  const requested = Math.min(Math.max(limit, 1), 30);
  const url = new URL(`${ML_API}/products/search`);
  url.searchParams.set("status", "active");
  url.searchParams.set("site_id", "MLB");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(requested));

  const response = await fetch(url, { headers: mlHeaders(accessToken) });
  if (!response.ok) throw new Error(`ML products search responded ${response.status}`);
  const payload = (await response.json()) as { results?: Array<{ id?: string }> };

  const details = await Promise.all(
    (payload.results ?? []).slice(0, requested).map(async (product) => {
      if (!product.id) return null;
      try {
        const productResponse = await fetch(`${ML_API}/products/${encodeURIComponent(product.id)}`, {
          headers: mlHeaders(accessToken),
        });
        if (!productResponse.ok) return null;
        const raw = (await productResponse.json()) as Record<string, unknown>;
        const winner = raw["buy_box_winner"] as Record<string, unknown> | undefined;
        const itemId = optionalString(winner?.["item_id"]);
        return itemId ? fetchItem(itemId, accessToken) : null;
      } catch {
        return null;
      }
    }),
  );

  return details.filter((item): item is MlItem => !!item);
}

async function searchMarketplaceListings(
  query: string,
  limit: number,
  accessToken: string,
): Promise<MlItem[]> {
  const url = new URL(`${ML_API}/sites/MLB/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  const response = await fetch(url, { headers: mlHeaders(accessToken) });
  if (!response.ok) throw new Error(`ML marketplace search responded ${response.status}`);
  const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
  return enrichItems(
    (payload.results ?? []).map(mapSearchResult).filter((item) => !!item.id),
    accessToken,
    limit,
  );
}

async function searchSellerListings(
  query: string,
  limit: number,
  accessToken: string,
): Promise<MlItem[]> {
  const value = query.trim();
  const url = new URL(`${ML_API}/sites/MLB/search`);
  if (/^\d+$/.test(value)) url.searchParams.set("seller_id", value);
  else url.searchParams.set("nickname", value.replace(/^@/, ""));
  url.searchParams.set("limit", String(Math.min(limit, 50)));

  const response = await fetch(url, { headers: mlHeaders(accessToken) });
  if (!response.ok) {
    if (/^\d+$/.test(value)) {
      const idsUrl = new URL(`${ML_API}/users/${encodeURIComponent(value)}/items/search`);
      idsUrl.searchParams.set("status", "active");
      idsUrl.searchParams.set("limit", String(Math.min(limit, 50)));
      const idsResponse = await fetch(idsUrl, { headers: mlHeaders(accessToken) });
      if (!idsResponse.ok) throw new Error(`ML seller search responded ${idsResponse.status}`);
      const idsPayload = (await idsResponse.json()) as { results?: string[] };
      const items = await Promise.all(
        (idsPayload.results ?? []).slice(0, limit).map((id) => fetchItem(id, accessToken)),
      );
      return items.filter((item): item is MlItem => !!item);
    }
    throw new Error(`ML seller nickname search responded ${response.status}`);
  }

  const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
  return enrichItems(
    (payload.results ?? []).map(mapSearchResult).filter((item) => !!item.id),
    accessToken,
    limit,
  );
}

function mergeSearchResults(primary: MlItem[], secondary: MlItem[], limit: number): MlItem[] {
  const unique = new Map<string, MlItem>();
  for (const item of [...primary, ...secondary]) {
    if (item.id && !unique.has(item.id)) unique.set(item.id, item);
  }
  return Array.from(unique.values()).slice(0, limit);
}

function extractMlbId(value: string): string | null {
  const match = value.toUpperCase().match(/MLB-?\d+/);
  return match ? match[0].replace("-", "") : null;
}

function isAllowedMlHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "meli.la" ||
    host === "mercadolivre.com.br" ||
    host.endsWith(".mercadolivre.com.br") ||
    host === "mercadolibre.com" ||
    host.endsWith(".mercadolibre.com")
  );
}

async function resolveMlLink(
  rawLink: string,
): Promise<{ itemId: string | null; productId: string | null }> {
  let current: URL;
  try {
    current = new URL(rawLink.trim());
  } catch {
    return { itemId: null, productId: null };
  }
  if (!isAllowedMlHost(current.hostname)) return { itemId: null, productId: null };

  for (let hop = 0; hop < 5; hop += 1) {
    const directId = extractMlbId(`${current.pathname}${current.search}`);
    if (directId) {
      const productPath = /\/p\/MLB-?\d+/i.test(current.pathname);
      return productPath
        ? { itemId: null, productId: directId }
        : { itemId: directId, productId: null };
    }
    try {
      const response = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "ANUNCIO-ML/1.0" },
      });
      const location = response.headers.get("location");
      if (!location) break;
      const next = new URL(location, current);
      if (!isAllowedMlHost(next.hostname)) break;
      current = next;
    } catch {
      break;
    }
  }

  const finalId = extractMlbId(`${current.pathname}${current.search}`);
  return finalId
    ? { itemId: finalId, productId: null }
    : { itemId: null, productId: null };
}

async function itemFromProduct(productId: string, accessToken: string): Promise<MlItem | null> {
  try {
    const response = await fetch(`${ML_API}/products/${encodeURIComponent(productId)}`, {
      headers: mlHeaders(accessToken),
    });
    if (!response.ok) return null;
    const raw = (await response.json()) as Record<string, unknown>;
    const winner = raw["buy_box_winner"] as Record<string, unknown> | undefined;
    const itemId = optionalString(winner?.["item_id"]);
    return itemId ? fetchItem(itemId, accessToken) : null;
  } catch {
    return null;
  }
}

export const searchMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        query: z.string().trim().min(1).max(120),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokenState = await getUserMlToken(context.userId);
    if (!tokenState.ok) {
      return {
        ok: false,
        configured: true,
        reason: "Conecte sua conta do Mercado Livre antes de buscar anúncios.",
        items: [],
      };
    }

    const limit = data.limit ?? 24;
    const [marketplaceResult, catalogResult] = await Promise.allSettled([
      searchMarketplaceListings(data.query, limit, tokenState.accessToken),
      searchCatalogProducts(data.query, limit, tokenState.accessToken),
    ]);
    const marketplaceItems =
      marketplaceResult.status === "fulfilled" ? marketplaceResult.value : [];
    const catalogItems = catalogResult.status === "fulfilled" ? catalogResult.value : [];
    const items = mergeSearchResults(marketplaceItems, catalogItems, limit);
    if (items.length) return { ok: true, configured: true, reason: null, items };

    if (marketplaceResult.status === "rejected") {
      console.error("ML marketplace search failed", marketplaceResult.reason);
    }
    if (catalogResult.status === "rejected") {
      console.error("ML products search failed", catalogResult.reason);
    }
    if (marketplaceResult.status === "fulfilled" || catalogResult.status === "fulfilled") {
      return { ok: true, configured: true, reason: null, items: [] };
    }
    return {
      ok: false,
      configured: true,
      reason: "O Mercado Livre não respondeu à busca agora. Sua conta continua conectada.",
      items: [],
    };
  });

export const searchMercadoLivreProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        query: z.string().trim().min(1).max(120),
        limit: z.number().int().min(1).max(30).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokenState = await getUserMlToken(context.userId);
    if (!tokenState.ok) {
      return {
        ok: false,
        configured: true,
        reason: "Conecte sua conta do Mercado Livre antes de buscar produtos.",
        items: [],
      };
    }
    try {
      const items = await searchCatalogProducts(
        data.query,
        data.limit ?? 24,
        tokenState.accessToken,
      );
      return { ok: true, configured: true, reason: null, items };
    } catch (error) {
      console.error("ML product search failed", error);
      return {
        ok: false,
        configured: true,
        reason: "Não foi possível consultar produtos do Mercado Livre agora.",
        items: [],
      };
    }
  });

export const searchMercadoLivreSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        query: z.string().trim().min(2).max(120),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokenState = await getUserMlToken(context.userId);
    if (!tokenState.ok) {
      return {
        ok: false,
        configured: true,
        reason: "Conecte sua conta do Mercado Livre antes de buscar vendedores.",
        items: [],
      };
    }
    try {
      const items = await searchSellerListings(data.query, data.limit ?? 24, tokenState.accessToken);
      return { ok: true, configured: true, reason: null, items };
    } catch (error) {
      console.error("ML seller search failed", error);
      return {
        ok: false,
        configured: true,
        reason:
          "Não encontramos esse vendedor. Informe o nickname exato ou o ID numérico do vendedor.",
        items: [],
      };
    }
  });

export const getMercadoLivreItemFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ link: z.string().trim().url().max(600) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokenState = await getUserMlToken(context.userId);
    if (!tokenState.ok) {
      return {
        ok: false,
        configured: true,
        reason: "Conecte sua conta do Mercado Livre antes de abrir links.",
        items: [],
      };
    }
    const resolved = await resolveMlLink(data.link);
    if (!resolved.itemId && !resolved.productId) {
      return {
        ok: false,
        configured: true,
        reason: "Não conseguimos identificar um anúncio nesse link do Mercado Livre.",
        items: [],
      };
    }
    const item = resolved.itemId
      ? await fetchItem(resolved.itemId, tokenState.accessToken)
      : resolved.productId
        ? await itemFromProduct(resolved.productId, tokenState.accessToken)
        : null;
    return item
      ? { ok: true, configured: true, reason: null, items: [item] }
      : { ok: true, configured: true, reason: null, items: [] };
  });

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
      connection: data ? toMlSerializable(data) : null,
      diagnostics: {
        callback: PUBLIC_CALLBACK,
        clientIdMasked: maskClientId(clientId),
        hasClientId: !!clientId,
        hasClientSecret,
      },
    };
  });

export const syncMlListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncUserListings } = await import("@/lib/ml.server");
    const result = await syncUserListings(context.userId);
    return toMlSerializable(result);
  });

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

export const getMercadoLivreItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: z
          .string()
          .trim()
          .regex(/^MLB-?\d+$/i, "ID inválido. Use o formato MLB1234567890."),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokenState = await getUserMlToken(context.userId);
    if (!tokenState.ok) {
      return {
        ok: false,
        configured: true,
        reason: "Conecte sua conta do Mercado Livre antes de buscar anúncios.",
        items: [],
      };
    }
    const id = data.id.toUpperCase().replace("MLB-", "MLB");
    const item = await fetchItem(id, tokenState.accessToken);
    return item
      ? { ok: true, configured: true, reason: null, items: [item] }
      : { ok: true, configured: true, reason: null, items: [] };
  });