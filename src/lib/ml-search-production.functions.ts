import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MlItem } from "./ml.functions";
import {
  getMercadoLivreItem,
  getMercadoLivreItemFromLink,
  searchMercadoLivreSeller,
} from "./ml-search-fixed.functions";

export { getMercadoLivreItem, getMercadoLivreItemFromLink, searchMercadoLivreSeller };

const ML_API = "https://api.mercadolibre.com";

export type SearchMlItem = MlItem & {
  description?: string | null;
  source_kind?: "marketplace" | "catalog_offer";
};

type SearchResult = {
  ok: boolean;
  configured: true;
  reason: string | null;
  items: SearchMlItem[];
};

type ProductSearchRow = {
  id?: string;
  name?: string;
  domain_id?: string;
  pictures?: Array<{ id?: string; url?: string; secure_url?: string }>;
};

type ProductDetail = ProductSearchRow & {
  status?: string;
  permalink?: string;
  family_name?: string;
  attributes?: unknown[];
  main_features?: unknown[];
  sold_quantity?: number;
  buy_box_winner?: CatalogOfferRow;
};

type CatalogOfferRow = {
  item_id?: string;
  seller_id?: number | string;
  price?: number;
  available_quantity?: number;
  sold_quantity?: number;
  category_id?: string;
  condition?: string;
  status?: string;
};

async function getTokens(userId: string): Promise<string[]> {
  const { getAppAccessToken, getValidMlAccessToken } = await import("@/lib/ml.server");
  const tokens: string[] = [];
  try {
    const user = await getValidMlAccessToken(userId);
    if (user.ok && user.accessToken) tokens.push(user.accessToken);
  } catch {}
  try {
    const app = await getAppAccessToken();
    if (app && !tokens.includes(app)) tokens.push(app);
  } catch {}
  return tokens;
}

async function mlFetch(url: string | URL, tokens: string[]): Promise<{ response: Response | null; statuses: number[] }> {
  const statuses: number[] = [];
  let last: Response | null = null;
  for (const token of tokens) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
      statuses.push(response.status);
      last = response;
      if (response.ok) return { response, statuses };
      if (![401, 403].includes(response.status)) break;
    } catch {}
  }
  return { response: last, statuses };
}

function imageUrls(raw: ProductDetail): string[] {
  return (raw.pictures ?? [])
    .map((picture) => picture.secure_url ?? picture.url ?? null)
    .filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url))
    .map((url) => (url.startsWith("http://") ? `https://${url.slice(7)}` : url));
}

async function sellerNickname(sellerId: string | number | undefined, tokens: string[]): Promise<string | null> {
  if (sellerId == null) return null;
  const attempt = await mlFetch(`${ML_API}/users/${encodeURIComponent(String(sellerId))}`, tokens);
  if (!attempt.response?.ok) return null;
  const data = (await attempt.response.json().catch(() => null)) as { nickname?: unknown } | null;
  return typeof data?.nickname === "string" && data.nickname.trim() ? data.nickname.trim() : null;
}

async function itemDescription(itemId: string, tokens: string[]): Promise<string | null> {
  const attempt = await mlFetch(`${ML_API}/items/${encodeURIComponent(itemId)}/description`, tokens);
  if (!attempt.response?.ok) return null;
  const data = (await attempt.response.json().catch(() => null)) as { plain_text?: unknown } | null;
  return typeof data?.plain_text === "string" && data.plain_text.trim() ? data.plain_text.trim() : null;
}

async function itemDetail(itemId: string, tokens: string[]): Promise<SearchMlItem | null> {
  const attempt = await mlFetch(`${ML_API}/items/${encodeURIComponent(itemId)}?include_attributes=all`, tokens);
  if (!attempt.response?.ok) return null;
  const raw = (await attempt.response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return null;
  const pictures = Array.isArray(raw["pictures"]) ? (raw["pictures"] as Array<{ secure_url?: string; url?: string }>) : [];
  const images = pictures
    .map((picture) => picture.secure_url ?? picture.url ?? null)
    .filter((url): url is string => typeof url === "string" && !!url)
    .map((url) => (url.startsWith("http://") ? `https://${url.slice(7)}` : url));
  const sellerId = raw["seller_id"] as string | number | undefined;
  const [seller, description] = await Promise.all([sellerNickname(sellerId, tokens), itemDescription(itemId, tokens)]);
  return {
    id: String(raw["id"] ?? itemId),
    title: String(raw["title"] ?? "Anúncio Mercado Livre"),
    price_cents: typeof raw["price"] === "number" ? Math.round((raw["price"] as number) * 100) : null,
    thumbnail: typeof raw["thumbnail"] === "string" ? String(raw["thumbnail"]).replace(/^http:\/\//, "https://") : images[0] ?? null,
    permalink: typeof raw["permalink"] === "string" ? String(raw["permalink"]).replace(/^http:\/\//, "https://") : null,
    category: typeof raw["category_id"] === "string" ? raw["category_id"] : null,
    seller,
    condition: typeof raw["condition"] === "string" ? raw["condition"] : null,
    available_quantity: typeof raw["available_quantity"] === "number" ? raw["available_quantity"] : null,
    sold_quantity: typeof raw["sold_quantity"] === "number" ? raw["sold_quantity"] : null,
    status: typeof raw["status"] === "string" ? raw["status"] : null,
    images,
    attributes: Array.isArray(raw["attributes"]) ? raw["attributes"] : [],
    description,
    source_kind: "marketplace",
  };
}

async function productDetail(productId: string, tokens: string[]): Promise<ProductDetail | null> {
  const attempt = await mlFetch(`${ML_API}/products/${encodeURIComponent(productId)}`, tokens);
  if (!attempt.response?.ok) return null;
  return (await attempt.response.json().catch(() => null)) as ProductDetail | null;
}

async function catalogOffers(product: ProductDetail, tokens: string[], limit: number): Promise<SearchMlItem[]> {
  if (!product.id) return [];
  const url = new URL(`${ML_API}/products/${encodeURIComponent(product.id)}/items`);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 20)));
  const attempt = await mlFetch(url, tokens);
  if (!attempt.response?.ok) return [];
  const data = (await attempt.response.json().catch(() => null)) as { results?: CatalogOfferRow[] } | null;
  const rows = (data?.results ?? []).filter((row) => typeof row.item_id === "string" && typeof row.price === "number").slice(0, limit);
  const productImages = imageUrls(product);
  const productTitle = String(product.name ?? product.family_name ?? "Anúncio Mercado Livre").trim().slice(0, 60);

  return Promise.all(rows.map(async (row) => {
    const id = String(row.item_id);
    const detailed = await itemDetail(id, tokens);
    if (detailed) return { ...detailed, source_kind: "catalog_offer" as const };
    const [seller, description] = await Promise.all([sellerNickname(row.seller_id, tokens), itemDescription(id, tokens)]);
    return {
      id,
      title: productTitle,
      price_cents: Math.round(Number(row.price) * 100),
      thumbnail: productImages[0] ?? null,
      permalink: null,
      category: row.category_id ?? null,
      seller,
      condition: row.condition ?? null,
      available_quantity: typeof row.available_quantity === "number" ? row.available_quantity : null,
      sold_quantity: typeof row.sold_quantity === "number" ? row.sold_quantity : null,
      status: row.status ?? "active",
      images: productImages,
      attributes: Array.isArray(product.attributes) ? product.attributes : Array.isArray(product.main_features) ? product.main_features : [],
      description,
      source_kind: "catalog_offer" as const,
    } satisfies SearchMlItem;
  }));
}

async function discoverDomains(query: string, tokens: string[]): Promise<string[]> {
  const url = new URL(`${ML_API}/sites/MLB/domain_discovery/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "3");
  const attempt = await mlFetch(url, tokens);
  if (!attempt.response?.ok) return [];
  const rows = (await attempt.response.json().catch(() => [])) as Array<{ domain_id?: unknown }>;
  return rows.map((row) => (typeof row.domain_id === "string" ? row.domain_id : null)).filter((id): id is string => !!id);
}

async function searchProductsRaw(query: string, tokens: string[], limit: number, domainId?: string) {
  const url = new URL(`${ML_API}/products/search`);
  url.searchParams.set("status", "active");
  url.searchParams.set("site_id", "MLB");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(limit, 20)));
  if (domainId) url.searchParams.set("domain_id", domainId);
  const attempt = await mlFetch(url, tokens);
  if (!attempt.response?.ok) return { rows: [] as ProductSearchRow[], statuses: attempt.statuses, failed: true };
  const data = (await attempt.response.json().catch(() => null)) as { results?: ProductSearchRow[] } | null;
  return { rows: data?.results ?? [], statuses: attempt.statuses, failed: false };
}

function rankBySales(items: SearchMlItem[]): SearchMlItem[] {
  return [...items].sort((a, b) => (b.sold_quantity ?? -1) - (a.sold_quantity ?? -1));
}

async function officialCatalogSearch(query: string, tokens: string[], limit: number): Promise<{ items: SearchMlItem[]; statuses: number[]; failed: boolean }> {
  const direct = await searchProductsRaw(query, tokens, limit);
  let rows = direct.rows;
  const statuses = [...direct.statuses];
  if (!rows.length) {
    const domains = await discoverDomains(query, tokens);
    const domainSearches = await Promise.all(domains.map((domain) => searchProductsRaw(query, tokens, limit, domain)));
    rows = domainSearches.flatMap((result) => result.rows);
    statuses.push(...domainSearches.flatMap((result) => result.statuses));
  }

  const uniqueProducts = Array.from(new Map(rows.filter((row) => !!row.id).map((row) => [row.id!, row])).values()).slice(0, Math.min(limit, 12));
  const output: SearchMlItem[] = [];
  for (const product of uniqueProducts) {
    if (!product.id || output.length >= limit) break;
    const detail = (await productDetail(product.id, tokens)) ?? product;
    const offers = await catalogOffers(detail, tokens, Math.min(4, limit - output.length));
    output.push(...offers);
    if (!offers.length) {
      const winner = (detail as ProductDetail).buy_box_winner;
      if (winner?.item_id && typeof winner.price === "number") {
        const winnerItem = await itemDetail(winner.item_id, tokens);
        if (winnerItem) output.push({ ...winnerItem, source_kind: "catalog_offer" });
      }
    }
  }
  const unique = Array.from(new Map(output.map((item) => [item.id, item])).values());
  return { items: rankBySales(unique).slice(0, limit), statuses, failed: direct.failed && !unique.length };
}

async function legacyMarketplaceSearch(query: string, tokens: string[], limit: number): Promise<SearchMlItem[]> {
  const url = new URL(`${ML_API}/sites/MLB/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  const attempt = await mlFetch(url, tokens);
  if (!attempt.response?.ok) return [];
  const data = (await attempt.response.json().catch(() => null)) as { results?: Array<Record<string, unknown>> } | null;
  const ids = (data?.results ?? []).map((row) => typeof row["id"] === "string" ? String(row["id"]) : null).filter((id): id is string => !!id).slice(0, limit);
  const details = await Promise.all(ids.map((id) => itemDetail(id, tokens)));
  return rankBySales(details.filter((item): item is SearchMlItem => !!item));
}

function failureReason(statuses: number[]): string {
  if (statuses.includes(401)) return "A autorização do Mercado Livre expirou. Reconecte a conta e tente novamente.";
  if (statuses.includes(403)) return "O Mercado Livre restringiu esta consulta e não liberou ofertas completas para esta busca.";
  if (statuses.includes(429)) return "O Mercado Livre limitou temporariamente as consultas. Aguarde alguns instantes e tente novamente.";
  return "Não foi possível consultar anúncios completos do Mercado Livre agora.";
}

export const searchMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(50).optional() }).parse(data))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const limit = data.limit ?? 24;
    const tokens = await getTokens(context.userId);
    if (!tokens.length) return { ok: false, configured: true, reason: "Conecte sua conta do Mercado Livre para usar a busca.", items: [] };
    const [marketplace, catalog] = await Promise.all([
      legacyMarketplaceSearch(data.query, tokens, limit),
      officialCatalogSearch(data.query, tokens, limit),
    ]);
    const merged = rankBySales(Array.from(new Map([...marketplace, ...catalog.items].map((item) => [item.id, item])).values())).slice(0, limit);
    if (merged.length) {
      return {
        ok: true,
        configured: true,
        reason: marketplace.length ? null : "Resultados oficiais do Mercado Livre, ordenados pela quantidade de vendas informada pela API.",
        items: merged,
      };
    }
    return { ok: false, configured: true, reason: failureReason(catalog.statuses), items: [] };
  });

export const searchMercadoLivreProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(30).optional() }).parse(data))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokens = await getTokens(context.userId);
    if (!tokens.length) return { ok: false, configured: true, reason: "Conecte sua conta do Mercado Livre para usar a busca.", items: [] };
    const result = await officialCatalogSearch(data.query, tokens, data.limit ?? 24);
    return result.items.length
      ? { ok: true, configured: true, reason: "Resultados oficiais do Mercado Livre, ordenados pela quantidade de vendas informada pela API.", items: result.items }
      : { ok: false, configured: true, reason: failureReason(result.statuses), items: [] };
  });
