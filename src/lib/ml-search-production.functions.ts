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

type SearchResult = {
  ok: boolean;
  configured: true;
  reason: string | null;
  items: MlItem[];
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
  buy_box_winner?: {
    item_id?: string;
    seller_id?: number | string;
    price?: number;
    available_quantity?: number;
    sold_quantity?: number;
    category_id?: string;
    condition?: string;
  };
};

async function getTokens(userId: string): Promise<string[]> {
  const { getAppAccessToken, getValidMlAccessToken } = await import("@/lib/ml.server");
  const tokens: string[] = [];
  try {
    const user = await getValidMlAccessToken(userId);
    if (user.ok && user.accessToken) tokens.push(user.accessToken);
  } catch {
    // O token da aplicação ainda pode atender consultas de catálogo.
  }
  try {
    const app = await getAppAccessToken();
    if (app && !tokens.includes(app)) tokens.push(app);
  } catch {
    // Sem token de aplicação, mantém somente o token do vendedor.
  }
  return tokens;
}

async function mlFetch(url: string | URL, tokens: string[]): Promise<{ response: Response | null; statuses: number[] }> {
  const statuses: number[] = [];
  let last: Response | null = null;
  for (const token of tokens) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      statuses.push(response.status);
      last = response;
      if (response.ok) return { response, statuses };
      if (![401, 403].includes(response.status)) break;
    } catch {
      // Tenta a próxima credencial.
    }
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
  return typeof data?.nickname === "string" ? data.nickname : null;
}

async function itemDetail(itemId: string, tokens: string[]): Promise<MlItem | null> {
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
  return {
    id: String(raw["id"] ?? itemId),
    title: String(raw["title"] ?? "Anúncio Mercado Livre"),
    price_cents: typeof raw["price"] === "number" ? Math.round((raw["price"] as number) * 100) : null,
    thumbnail: typeof raw["thumbnail"] === "string" ? String(raw["thumbnail"]).replace(/^http:\/\//, "https://") : images[0] ?? null,
    permalink: typeof raw["permalink"] === "string" ? String(raw["permalink"]).replace(/^http:\/\//, "https://") : null,
    category: typeof raw["category_id"] === "string" ? raw["category_id"] : null,
    seller: await sellerNickname(sellerId, tokens),
    condition: typeof raw["condition"] === "string" ? raw["condition"] : null,
    available_quantity: typeof raw["available_quantity"] === "number" ? raw["available_quantity"] : null,
    sold_quantity: typeof raw["sold_quantity"] === "number" ? raw["sold_quantity"] : null,
    status: typeof raw["status"] === "string" ? raw["status"] : null,
    images,
    attributes: Array.isArray(raw["attributes"]) ? raw["attributes"] : [],
  };
}

async function catalogOffers(productId: string, tokens: string[], limit: number): Promise<MlItem[]> {
  const url = new URL(`${ML_API}/products/${encodeURIComponent(productId)}/items`);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 20)));
  const attempt = await mlFetch(url, tokens);
  if (!attempt.response?.ok) return [];
  const data = (await attempt.response.json().catch(() => null)) as { results?: Array<{ item_id?: unknown }> } | null;
  const ids = (data?.results ?? [])
    .map((row) => (typeof row.item_id === "string" ? row.item_id : null))
    .filter((id): id is string => !!id)
    .slice(0, limit);
  const details = await Promise.all(ids.map((id) => itemDetail(id, tokens)));
  return details.filter((item): item is MlItem => !!item);
}

function productAsCloneBase(raw: ProductDetail, seller: string | null): MlItem | null {
  if (!raw.id) return null;
  const winner = raw.buy_box_winner;
  const images = imageUrls(raw);
  const title = String(raw.name ?? raw.family_name ?? "Produto de catálogo").trim().slice(0, 60);
  if (title.length < 3) return null;
  return {
    id: raw.id,
    title,
    price_cents: typeof winner?.price === "number" ? Math.round(winner.price * 100) : null,
    thumbnail: images[0] ?? null,
    permalink: typeof raw.permalink === "string" ? raw.permalink.replace(/^http:\/\//, "https://") : null,
    category: winner?.category_id ?? null,
    seller,
    condition: winner?.condition ?? "new",
    available_quantity: typeof winner?.available_quantity === "number" ? winner.available_quantity : 1,
    sold_quantity: typeof winner?.sold_quantity === "number" ? winner.sold_quantity : null,
    status: raw.status ?? "active",
    images,
    attributes: Array.isArray(raw.attributes) ? raw.attributes : Array.isArray(raw.main_features) ? raw.main_features : [],
  };
}

async function productDetail(productId: string, tokens: string[]): Promise<ProductDetail | null> {
  const attempt = await mlFetch(`${ML_API}/products/${encodeURIComponent(productId)}`, tokens);
  if (!attempt.response?.ok) return null;
  return (await attempt.response.json().catch(() => null)) as ProductDetail | null;
}

async function discoverDomains(query: string, tokens: string[]): Promise<string[]> {
  const url = new URL(`${ML_API}/sites/MLB/domain_discovery/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "3");
  const attempt = await mlFetch(url, tokens);
  if (!attempt.response?.ok) return [];
  const rows = (await attempt.response.json().catch(() => [])) as Array<{ domain_id?: unknown }>;
  return rows
    .map((row) => (typeof row.domain_id === "string" ? row.domain_id : null))
    .filter((id): id is string => !!id);
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

async function officialCatalogSearch(query: string, tokens: string[], limit: number): Promise<{ items: MlItem[]; statuses: number[]; failed: boolean }> {
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
  if (!uniqueProducts.length) return { items: [], statuses, failed: direct.failed };

  const output: MlItem[] = [];
  for (const product of uniqueProducts) {
    if (!product.id || output.length >= limit) break;
    const offers = await catalogOffers(product.id, tokens, Math.min(3, limit - output.length));
    if (offers.length) {
      output.push(...offers);
      continue;
    }

    // Este fallback é importante: algumas aplicações conseguem consultar o produto
    // de catálogo, mas não recebem as ofertas concorrentes em /products/{id}/items.
    // Nesse caso ainda mostramos a ficha oficial como base clonável, em vez de
    // transformar uma restrição da API em "nenhum resultado".
    const detail = (await productDetail(product.id, tokens)) ?? product;
    const winner = (detail as ProductDetail).buy_box_winner;
    let winnerItem: MlItem | null = null;
    if (winner?.item_id) winnerItem = await itemDetail(winner.item_id, tokens);
    if (winnerItem) {
      output.push(winnerItem);
      continue;
    }
    const nickname = await sellerNickname(winner?.seller_id, tokens);
    const base = productAsCloneBase(detail as ProductDetail, nickname);
    if (base) output.push(base);
  }

  const unique = Array.from(new Map(output.map((item) => [item.id, item])).values()).slice(0, limit);
  return { items: unique, statuses, failed: direct.failed && !unique.length };
}

async function legacyMarketplaceSearch(query: string, tokens: string[], limit: number): Promise<MlItem[]> {
  const url = new URL(`${ML_API}/sites/MLB/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  const attempt = await mlFetch(url, tokens);
  if (!attempt.response?.ok) return [];
  const data = (await attempt.response.json().catch(() => null)) as { results?: Array<Record<string, unknown>> } | null;
  const rows = data?.results ?? [];
  const items: MlItem[] = [];
  for (const row of rows.slice(0, limit)) {
    const id = typeof row["id"] === "string" ? row["id"] : null;
    if (!id) continue;
    const detail = await itemDetail(id, tokens);
    if (detail) items.push(detail);
  }
  return items;
}

function failureReason(statuses: number[]): string {
  if (statuses.includes(401)) return "A autorização do Mercado Livre expirou. Reconecte a conta e tente novamente.";
  if (statuses.includes(403)) return "O Mercado Livre restringiu a consulta para esta aplicação. A busca oficial de catálogo também não retornou uma base utilizável.";
  if (statuses.includes(429)) return "O Mercado Livre limitou temporariamente as consultas. Aguarde alguns instantes e tente novamente.";
  return "Não foi possível consultar o Mercado Livre agora.";
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
    const merged = Array.from(new Map([...marketplace, ...catalog.items].map((item) => [item.id, item])).values()).slice(0, limit);
    if (merged.length) {
      return {
        ok: true,
        configured: true,
        reason: marketplace.length ? null : "A busca ampla do marketplace está restrita; exibindo resultados obtidos pelos recursos oficiais de catálogo do Mercado Livre.",
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
      ? { ok: true, configured: true, reason: null, items: result.items }
      : { ok: false, configured: true, reason: failureReason(result.statuses), items: [] };
  });
