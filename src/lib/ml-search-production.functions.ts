import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseMlSearchInput } from "./ml-search-input";
import { serializeMlArray, type MlItem } from "./ml.functions";

const ML_API = "https://api.mercadolibre.com";
const USER_AGENT = "ANUNCIO-ML/1.0";

type TokenKind = "user" | "app";
type MlLogScope = "legacyMarketplaceSearch" | "officialCatalogSearch" | "fetchItemsBatch";

export type SearchMlItem = MlItem & {
  description?: string | null | undefined;
  source_kind?: "marketplace" | "catalog_offer" | undefined;
  seller_id?: string | null | undefined;
  verified_item?: boolean | undefined;
};

type SearchResult = {
  ok: boolean;
  configured: true;
  reason: string | null;
  items: SearchMlItem[];
};
type FetchAttempt = { response: Response | null; statuses: number[] };
type ProductSearchRow = {
  id?: string | undefined;
  name?: string | undefined;
  domain_id?: string | undefined;
  pictures?: Array<{ id?: string | undefined; url?: string | undefined; secure_url?: string | undefined }> | undefined;
};
type ProductDetail = ProductSearchRow & {
  family_name?: string | undefined;
  attributes?: unknown[] | undefined;
  main_features?: unknown[] | undefined;
  buy_box_winner?: CatalogOfferRow | undefined;
};
type CatalogOfferRow = {
  item_id?: string | undefined;
  seller_id?: string | number | undefined;
  price?: number | undefined;
  available_quantity?: number | undefined;
  sold_quantity?: number | undefined;
  category_id?: string | undefined;
  condition?: string | undefined;
  status?: string | undefined;
};

const sellerCache = new Map<string, { value: string | null; expires: number }>();
const tokenKinds = new Map<string, TokenKind>();

async function getTokens(userId: string): Promise<string[]> {
  const { getAppAccessToken, getValidMlAccessToken } = await import("@/lib/ml.server");
  const tokens: string[] = [];
  try {
    const user = await getValidMlAccessToken(userId);
    if (user.ok && user.accessToken) {
      tokens.push(user.accessToken);
      tokenKinds.set(user.accessToken, "user");
    }
  } catch {}
  try {
    const app = await getAppAccessToken();
    if (app && !tokens.includes(app)) {
      tokens.push(app);
      tokenKinds.set(app, "app");
    }
  } catch {}
  return tokens;
}

function headers(token?: string) {
  const out: Record<string, string> = { Accept: "application/json", "User-Agent": USER_AGENT };
  if (token) out["Authorization"] = `Bearer ${token}`;
  return out;
}

function logMlAttempt(scope: MlLogScope | undefined, url: string | URL, status: number | "network_error", tokenType: TokenKind | "anonymous") {
  if (!scope) return;
  console.info("[ML search diagnostic]", {
    scope,
    endpoint: String(url),
    status,
    token_type: tokenType,
  });
}

async function mlFetch(url: string | URL, tokens: string[], logScope?: MlLogScope): Promise<FetchAttempt> {
  const statuses: number[] = [];
  let last: Response | null = null;
  for (const token of tokens) {
    const tokenType = tokenKinds.get(token) ?? "user";
    try {
      const response = await fetch(url, { headers: headers(token), signal: AbortSignal.timeout(15_000) });
      statuses.push(response.status);
      last = response;
      logMlAttempt(logScope, url, response.status, tokenType);
      if (response.ok) return { response, statuses };
      if (![401, 403].includes(response.status)) return { response, statuses };
    } catch {
      logMlAttempt(logScope, url, "network_error", tokenType);
    }
  }
  try {
    const response = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(15_000) });
    statuses.push(response.status);
    last = response;
    logMlAttempt(logScope, url, response.status, "anonymous");
    return { response, statuses };
  } catch {
    logMlAttempt(logScope, url, "network_error", "anonymous");
    return { response: last, statuses };
  }
}


function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("http://") ? `https://${value.slice(7)}` : value;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function queryTokens(query: string) {
  const ignored = new Set(["de", "da", "do", "das", "dos", "com", "para", "por", "e", "em", "o", "a"]);
  return normalizeSearchText(query)
    .split(" ")
    .filter((token) => token.length >= 2 && !ignored.has(token));
}

function relevanceScore(query: string, item: Pick<SearchMlItem, "title">) {
  const normalizedQuery = normalizeSearchText(query);
  const title = normalizeSearchText(item.title);
  if (!normalizedQuery || !title) return 0;
  if (title.includes(normalizedQuery)) return 100;
  const tokens = queryTokens(query);
  if (!tokens.length) return 0;
  const matched = tokens.filter((token) => title.includes(token)).length;
  return Math.round((matched / tokens.length) * 100);
}

function isRelevant(query: string, item: Pick<SearchMlItem, "title">) {
  const tokens = queryTokens(query);
  const score = relevanceScore(query, item);
  if (tokens.length <= 1) return score === 100;
  return score >= 50;
}

function productImages(raw: ProductDetail): string[] {
  return (raw.pictures ?? []).map((picture) => safeUrl(picture.secure_url ?? picture.url)).filter((value): value is string => !!value);
}

async function sellerNickname(sellerId: string | number | null | undefined, tokens: string[]): Promise<string | null> {
  if (sellerId == null) return null;
  const key = String(sellerId);
  const cached = sellerCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const attempt = await mlFetch(`${ML_API}/users/${encodeURIComponent(key)}`, tokens);
  if (!attempt.response?.ok) {
    sellerCache.set(key, { value: null, expires: Date.now() + 60_000 });
    return null;
  }
  const data = (await attempt.response.json().catch(() => null)) as { nickname?: unknown } | null;
  const value = typeof data?.nickname === "string" && data.nickname.trim() ? data.nickname.trim() : null;
  sellerCache.set(key, { value, expires: Date.now() + 10 * 60_000 });
  return value;
}

async function mapItemRaw(raw: Record<string, unknown>, tokens: string[], sourceKind: SearchMlItem["source_kind"] = "marketplace"): Promise<SearchMlItem> {
  const pictures = Array.isArray(raw["pictures"]) ? (raw["pictures"] as Array<{ secure_url?: string; url?: string }>) : [];
  const images = pictures.map((picture) => safeUrl(picture.secure_url ?? picture.url)).filter((value): value is string => !!value);
  const sellerId = raw["seller_id"] != null ? String(raw["seller_id"]) : null;
  const sellerObj = raw["seller"] as { nickname?: unknown; id?: unknown } | undefined;
  const resolvedSellerId = sellerId ?? (sellerObj?.id != null ? String(sellerObj.id) : null);
  const seller = typeof sellerObj?.nickname === "string" ? sellerObj.nickname : await sellerNickname(resolvedSellerId, tokens);
  return {
    id: String(raw["id"] ?? raw["item_id"] ?? ""),
    title: String(raw["title"] ?? "Anúncio Mercado Livre"),
    price_cents: typeof raw["price"] === "number" ? Math.round(Number(raw["price"]) * 100) : null,
    thumbnail: safeUrl(raw["thumbnail"]) ?? images[0] ?? null,
    permalink: safeUrl(raw["permalink"]),
    category: typeof raw["category_id"] === "string" ? raw["category_id"] : null,
    seller: seller ?? null,
    seller_id: resolvedSellerId,
    condition: typeof raw["condition"] === "string" ? raw["condition"] : null,
    available_quantity: typeof raw["available_quantity"] === "number" ? raw["available_quantity"] : null,
    sold_quantity: typeof raw["sold_quantity"] === "number" ? raw["sold_quantity"] : null,
    status: typeof raw["status"] === "string" ? raw["status"] : null,
    images,
    attributes: serializeMlArray(raw["attributes"]),
    source_kind: sourceKind,
    verified_item: true,
  };
}

async function fetchItemsBatch(ids: string[], tokens: string[]): Promise<SearchMlItem[]> {
  const unique = Array.from(new Set(ids.map((id) => id.toUpperCase().replace("MLB-", "MLB")).filter((id) => /^MLB\d+$/i.test(id))));
  const output: SearchMlItem[] = [];
  for (let index = 0; index < unique.length; index += 20) {
    const chunk = unique.slice(index, index + 20);
    const url = new URL(`${ML_API}/items`);
    url.searchParams.set("ids", chunk.join(","));
    url.searchParams.set("include_attributes", "all");
    const attempt = await mlFetch(url, tokens, "fetchItemsBatch");
    if (!attempt.response?.ok) continue;
    const rows = (await attempt.response.json().catch(() => [])) as Array<{ code?: number; body?: Record<string, unknown> }>;
    const mapped = await Promise.all(rows.filter((row) => row?.code === 200 && row.body).map((row) => mapItemRaw(row.body!, tokens)));
    output.push(...mapped.filter((item) => !!item.id));
  }
  return output;
}

async function fetchItem(itemId: string, tokens: string[]): Promise<{ item: SearchMlItem | null; statuses: number[] }> {
  const id = itemId.toUpperCase().replace("MLB-", "MLB");
  const direct = await mlFetch(`${ML_API}/items/${encodeURIComponent(id)}?include_attributes=all`, tokens);
  if (direct.response?.ok) {
    const raw = (await direct.response.json().catch(() => null)) as Record<string, unknown> | null;
    return { item: raw ? await mapItemRaw(raw, tokens) : null, statuses: direct.statuses };
  }
  const batch = await fetchItemsBatch([id], tokens);
  return { item: batch[0] ?? null, statuses: direct.statuses };
}

async function descriptionResult(itemId: string, tokens: string[]) {
  const attempt = await mlFetch(`${ML_API}/items/${encodeURIComponent(itemId)}/description`, tokens);
  if (attempt.response?.ok) {
    const data = (await attempt.response.json().catch(() => null)) as { plain_text?: unknown } | null;
    const description = typeof data?.plain_text === "string" && data.plain_text.trim() ? data.plain_text.trim() : null;
    return { description, reason: description ? null : "Este anúncio não possui descrição disponível." };
  }
  if (attempt.statuses.includes(404)) return { description: null, reason: "Este anúncio não possui descrição disponível." };
  return { description: null, reason: "Não foi possível carregar a descrição agora." };
}

async function productDetail(id: string, tokens: string[], logScope?: MlLogScope): Promise<ProductDetail | null> {
  const attempt = await mlFetch(`${ML_API}/products/${encodeURIComponent(id)}`, tokens, logScope);
  if (!attempt.response?.ok) return null;
  return (await attempt.response.json().catch(() => null)) as ProductDetail | null;
}

async function catalogOffers(product: ProductDetail, tokens: string[], limit: number, logScope?: MlLogScope): Promise<SearchMlItem[]> {
  if (!product.id) return [];
  const url = new URL(`${ML_API}/products/${encodeURIComponent(product.id)}/items`);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 100)));
  const attempt = await mlFetch(url, tokens, logScope);
  if (!attempt.response?.ok) return [];
  const data = (await attempt.response.json().catch(() => null)) as { results?: CatalogOfferRow[] } | null;
  const rows = (data?.results ?? []).filter((row) => typeof row.item_id === "string" && typeof row.price === "number").slice(0, limit);
  if (!rows.length) return [];
  const verified = await fetchItemsBatch(rows.map((row) => String(row.item_id)), tokens);
  const verifiedById = new Map(verified.map((item) => [item.id.toUpperCase(), item]));
  const images = productImages(product);
  const title = String(product.name ?? product.family_name ?? "Oferta de catálogo").trim().slice(0, 60);
  const sellerIds = Array.from(new Set(rows.map((row) => (row.seller_id != null ? String(row.seller_id) : null)).filter((value): value is string => !!value)));
  const sellerPairs = await Promise.all(sellerIds.map(async (id) => [id, await sellerNickname(id, tokens)] as const));
  const sellers = new Map(sellerPairs);
  const fallbackAttributes = serializeMlArray(Array.isArray(product.attributes) ? product.attributes : Array.isArray(product.main_features) ? product.main_features : []);
  return rows.map((row): SearchMlItem => {
    const id = String(row.item_id).toUpperCase().replace("MLB-", "MLB");
    const detail = verifiedById.get(id);
    if (detail) return { ...detail, source_kind: "catalog_offer", sold_quantity: detail.sold_quantity ?? (typeof row.sold_quantity === "number" ? row.sold_quantity : null), available_quantity: detail.available_quantity ?? (typeof row.available_quantity === "number" ? row.available_quantity : null), verified_item: true };
    return {
      id,
      title,
      price_cents: null,
      thumbnail: images[0] ?? null,
      permalink: null,
      category: row.category_id ?? null,
      seller: row.seller_id != null ? sellers.get(String(row.seller_id)) ?? null : null,
      seller_id: row.seller_id != null ? String(row.seller_id) : null,
      condition: row.condition ?? null,
      available_quantity: typeof row.available_quantity === "number" ? row.available_quantity : null,
      sold_quantity: typeof row.sold_quantity === "number" ? row.sold_quantity : null,
      status: row.status ?? "active",
      images,
      attributes: fallbackAttributes,
      source_kind: "catalog_offer",
      verified_item: false,
    };
  });
}

async function discoverDomains(query: string, tokens: string[], logScope?: MlLogScope): Promise<string[]> {
  const url = new URL(`${ML_API}/sites/MLB/domain_discovery/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "3");
  const attempt = await mlFetch(url, tokens, logScope);
  if (!attempt.response?.ok) return [];
  const rows = (await attempt.response.json().catch(() => [])) as Array<{ domain_id?: unknown }>;
  return rows.map((row) => (typeof row.domain_id === "string" ? row.domain_id : null)).filter((value): value is string => !!value);
}

async function productSearchPage(query: string, tokens: string[], offset: number, domainId?: string, logScope?: MlLogScope) {
  const url = new URL(`${ML_API}/products/search`);
  url.searchParams.set("status", "active");
  url.searchParams.set("site_id", "MLB");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");
  url.searchParams.set("offset", String(offset));
  if (domainId) url.searchParams.set("domain_id", domainId);
  const attempt = await mlFetch(url, tokens, logScope);
  if (!attempt.response?.ok) return { rows: [] as ProductSearchRow[], statuses: attempt.statuses, failed: true };
  const data = (await attempt.response.json().catch(() => null)) as { results?: ProductSearchRow[] } | null;
  return { rows: data?.results ?? [], statuses: attempt.statuses, failed: false };
}

function rankBySales(items: SearchMlItem[]) {
  return [...items].sort((a, b) => Number(b.verified_item !== false) - Number(a.verified_item !== false) || (b.sold_quantity ?? -1) - (a.sold_quantity ?? -1));
}

async function officialCatalogSearch(query: string, tokens: string[], limit: number): Promise<{ items: SearchMlItem[]; statuses: number[]; failed: boolean }> {
  const desired = Math.min(Math.max(limit, 1), 200);
  const productTarget = Math.min(50, Math.max(8, Math.ceil(desired / 4)));
  let rows: ProductSearchRow[] = [];
  const statuses: number[] = [];
  let failed = true;
  for (let offset = 0; offset < productTarget; offset += 20) {
    const page = await productSearchPage(query, tokens, offset, undefined, "officialCatalogSearch");
    statuses.push(...page.statuses);
    failed = failed && page.failed;
    if (page.rows.length) rows.push(...page.rows);
    if (page.rows.length < 20 || rows.length >= productTarget) break;
  }
  if (rows.length < productTarget) {
    const domains = await discoverDomains(query, tokens, "officialCatalogSearch");
    for (const domain of domains) {
      const page = await productSearchPage(query, tokens, 0, domain, "officialCatalogSearch");
      statuses.push(...page.statuses);
      failed = failed && page.failed;
      rows.push(...page.rows);
      if (rows.length >= productTarget) break;
    }
  }
  const products = Array.from(new Map(rows.filter((row) => !!row.id && isRelevant(query, { title: String(row.name ?? "") })).map((row) => [row.id!, row])).values()).slice(0, productTarget);
  const output: SearchMlItem[] = [];
  for (let index = 0; index < products.length && output.length < desired; index += 4) {
    const batch = products.slice(index, index + 4);
    const batchResults = await Promise.all(batch.map(async (product) => {
      const detail = (await productDetail(product.id!, tokens, "officialCatalogSearch")) ?? product;
      return catalogOffers(detail, tokens, Math.min(6, desired - output.length), "officialCatalogSearch");
    }));
    output.push(...batchResults.flat());
  }
  const unique = Array.from(new Map(output.filter((item) => isRelevant(query, item)).map((item) => [item.id, item])).values());
  return { items: rankBySales(unique).slice(0, desired), statuses, failed: failed && !unique.length };
}

async function legacyMarketplaceSearch(query: string, tokens: string[], limit: number): Promise<SearchMlItem[]> {
  const desired = Math.min(limit, 50);
  const url = new URL(`${ML_API}/sites/MLB/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(desired));
  const attempt = await mlFetch(url, tokens, "legacyMarketplaceSearch");
  if (!attempt.response?.ok) return [];
  const data = (await attempt.response.json().catch(() => null)) as { results?: Array<Record<string, unknown>> } | null;
  const mapped = await Promise.all((data?.results ?? []).slice(0, desired).map((row) => mapItemRaw(row, tokens, "marketplace")));
  return rankBySales(mapped.filter((item) => !!item.id && isRelevant(query, item)));
}

async function sellerSearch(query: string, tokens: string[], limit: number): Promise<{ items: SearchMlItem[]; statuses: number[]; failed: boolean }> {
  const desired = Math.min(Math.max(limit, 1), 200);
  const value = query.trim().replace(/^@/, "");
  const statuses: number[] = [];
  const ids: string[] = [];
  if (/^\d+$/.test(value)) {
    for (let offset = 0; offset < desired; offset += 50) {
      const url = new URL(`${ML_API}/users/${encodeURIComponent(value)}/items/search`);
      url.searchParams.set("status", "active");
      url.searchParams.set("limit", String(Math.min(50, desired - offset)));
      url.searchParams.set("offset", String(offset));
      const attempt = await mlFetch(url, tokens);
      statuses.push(...attempt.statuses);
      if (!attempt.response?.ok) return { items: [], statuses, failed: true };
      const data = (await attempt.response.json().catch(() => null)) as { results?: string[] } | null;
      const page = data?.results ?? [];
      ids.push(...page);
      if (page.length < 50) break;
    }
  } else {
    const url = new URL(`${ML_API}/sites/MLB/search`);
    url.searchParams.set("nickname", value);
    url.searchParams.set("limit", String(Math.min(50, desired)));
    const attempt = await mlFetch(url, tokens);
    statuses.push(...attempt.statuses);
    if (!attempt.response?.ok) return { items: [], statuses, failed: true };
    const data = (await attempt.response.json().catch(() => null)) as { results?: Array<Record<string, unknown>> } | null;
    const mapped = await Promise.all((data?.results ?? []).map((row) => mapItemRaw(row, tokens, "marketplace")));
    return { items: rankBySales(mapped).slice(0, desired), statuses, failed: false };
  }
  const items = await fetchItemsBatch(ids.slice(0, desired), tokens);
  return { items: rankBySales(items), statuses, failed: false };
}

function userMessage(statuses: number[], empty = false) {
  if (statuses.includes(429)) return "O Mercado Livre limitou temporariamente as consultas. Aguarde alguns instantes e tente novamente.";
  if (statuses.includes(401)) return "Não foi possível validar a autorização do Mercado Livre agora.";
  if (statuses.includes(403)) return empty ? "A API do Mercado Livre não liberou anúncios verificáveis para este termo. Tente também pelo link ou ID MLB de um anúncio." : "Não foi possível consultar esse tipo de anúncio agora.";
  return empty ? "Não encontramos anúncios verificáveis e realmente relacionados a este termo." : "Não foi possível consultar o Mercado Livre agora.";
}

function extractMlbId(value: string) {
  const match = value.toUpperCase().match(/MLB-?\d+/);
  return match ? match[0].replace("-", "") : null;
}

type ResolvedLink = {
  itemId: string | null;
  productId: string | null;
  sellerId: string | null;
  sellerNickname: string | null;
  searchQuery: string | null;
};

const EMPTY_LINK: ResolvedLink = { itemId: null, productId: null, sellerId: null, sellerNickname: null, searchQuery: null };

function fromParsed(parsed: ReturnType<typeof parseMlSearchInput>): ResolvedLink | null {
  if (parsed.itemId) return { ...EMPTY_LINK, itemId: parsed.itemId };
  if (parsed.productId) return { ...EMPTY_LINK, productId: parsed.productId };
  if (parsed.sellerId || parsed.sellerNickname) return { ...EMPTY_LINK, sellerId: parsed.sellerId, sellerNickname: parsed.sellerNickname };
  if (parsed.type === "search_url" && parsed.searchQuery) return { ...EMPTY_LINK, searchQuery: parsed.searchQuery };
  return null;
}

function canonicalFromHtml(html: string): string | null {
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
  const refresh = html.match(/http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"';]+)/i)?.[1];
  const jsRedirect = html.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i)?.[1];
  const ogUrl = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1];
  return canonical ?? refresh ?? jsRedirect ?? ogUrl ?? null;
}

async function resolveLink(raw: string): Promise<ResolvedLink> {
  const initial = parseMlSearchInput(raw);
  const direct = fromParsed(initial);
  if (direct) return direct;
  if (!initial.normalizedUrl) return EMPTY_LINK;

  let current: URL;
  try { current = new URL(initial.normalizedUrl); } catch { return EMPTY_LINK; }

  for (let hop = 0; hop < 5; hop += 1) {
    let response: Response;
    try {
      response = await fetch(current.toString(), {
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      break;
    }
    const location = response.headers.get("location");
    let next: string | null = location;
    if (!next && response.status >= 200 && response.status < 300) {
      const html = await response.text().catch(() => "");
      next = canonicalFromHtml(html) ?? extractMlbId(html.slice(0, 20_000));
    }
    if (!next) break;
    const parsed = parseMlSearchInput(next.startsWith("http") || /^\/\//.test(next) ? next : new URL(next, current).toString());
    const resolved = fromParsed(parsed);
    if (resolved) return resolved;
    if (!parsed.normalizedUrl) break;
    try { current = new URL(parsed.normalizedUrl); } catch { break; }
  }

  const finalParsed = parseMlSearchInput(current.toString());
  return fromParsed(finalParsed) ?? EMPTY_LINK;
}


export const searchMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(200).optional() }).parse(data))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const limit = data.limit ?? 20;
    const tokens = await getTokens(context.userId);
    if (!tokens.length) return { ok: false, configured: true, reason: "Conecte sua conta do Mercado Livre para usar a busca.", items: [] };
    const [marketplace, catalog] = await Promise.all([
      legacyMarketplaceSearch(data.query, tokens, Math.min(limit, 50)),
      officialCatalogSearch(data.query, tokens, limit),
    ]);
    const merged = rankBySales(Array.from(new Map([...marketplace, ...catalog.items]
      .filter((item) => item.verified_item !== false && item.price_cents != null && isRelevant(data.query, item))
      .map((item) => [item.id, item])).values())).slice(0, limit);
    if (merged.length) return {
      ok: true,
      configured: true,
      reason: marketplace.length ? null : "Resultados oficiais e verificáveis do Mercado Livre. Itens sem correspondência real com sua busca foram removidos.",
      items: merged,
    };
    return { ok: false, configured: true, reason: userMessage(catalog.statuses, true), items: [] };
  });

export const searchMercadoLivreProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(200).optional() }).parse(data))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokens = await getTokens(context.userId);
    if (!tokens.length) return { ok: false, configured: true, reason: "Conecte sua conta do Mercado Livre para usar a busca.", items: [] };
    const result = await officialCatalogSearch(data.query, tokens, data.limit ?? 20);
    const verified = result.items.filter((item) => item.verified_item !== false && item.price_cents != null && isRelevant(data.query, item));
    return verified.length ? { ok: true, configured: true, reason: "Resultados oficiais e verificáveis do Mercado Livre.", items: verified } : { ok: false, configured: true, reason: userMessage(result.statuses, true), items: [] };
  });

export const searchMercadoLivreSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(200).optional() }).parse(data))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokens = await getTokens(context.userId);
    if (!tokens.length) return { ok: false, configured: true, reason: "Conecte sua conta do Mercado Livre para usar a busca.", items: [] };
    const result = await sellerSearch(data.query, tokens, data.limit ?? 20);
    return result.items.length ? { ok: true, configured: true, reason: null, items: result.items } : { ok: false, configured: true, reason: userMessage(result.statuses, true), items: [] };
  });

export const getMercadoLivreItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().trim().regex(/^MLB-?\d+$/i, "ID inválido. Use MLB1234567890.") }).parse(data))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokens = await getTokens(context.userId);
    if (!tokens.length) return { ok: false, configured: true, reason: "Conecte sua conta do Mercado Livre para consultar o anúncio.", items: [] };
    const result = await fetchItem(data.id, tokens);
    return result.item ? { ok: true, configured: true, reason: null, items: [result.item] } : { ok: false, configured: true, reason: userMessage(result.statuses, false), items: [] };
  });

export const getMercadoLivreItemDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().trim().regex(/^MLB-?\d+$/i) }).parse(data))
  .handler(async ({ data, context }) => {
    const tokens = await getTokens(context.userId);
    if (!tokens.length) return { ok: false as const, description: null, reason: "Conecte sua conta do Mercado Livre." };
    const result = await descriptionResult(data.id.toUpperCase().replace("MLB-", "MLB"), tokens);
    return { ok: !!result.description, description: result.description, reason: result.reason };
  });

export const getMercadoLivreItemFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ link: z.string().trim().min(4).max(1000), limit: z.number().int().min(1).max(200).optional() }).parse(data))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokens = await getTokens(context.userId);
    if (!tokens.length) return { ok: false, configured: true, reason: "Conecte sua conta do Mercado Livre para consultar o link.", items: [] };
    const limit = data.limit ?? 20;
    const resolved = await resolveLink(data.link);

    if (resolved.itemId) {
      const result = await fetchItem(resolved.itemId, tokens);
      if (result.item) return { ok: true, configured: true, reason: null, items: [result.item] };
      if (result.statuses.includes(404)) return { ok: false, configured: true, reason: "Esse anúncio não existe mais ou foi removido do Mercado Livre.", items: [] };
      return { ok: false, configured: true, reason: userMessage(result.statuses, false), items: [] };
    }

    if (resolved.productId) {
      const detail = await productDetail(resolved.productId, tokens);
      if (detail) {
        const items = await catalogOffers(detail, tokens, limit);
        const verified = items.filter((item) => item.verified_item !== false && item.price_cents != null);
        if (verified.length) return { ok: true, configured: true, reason: "Anúncios reais vinculados à página de produto desse link.", items: rankBySales(verified).slice(0, limit) };
      }
    }

    if (resolved.sellerId || resolved.sellerNickname) {
      const seller = await sellerSearch(resolved.sellerId ?? resolved.sellerNickname!, tokens, limit);
      if (seller.items.length) return { ok: true, configured: true, reason: "Anúncios do vendedor identificado nesse link.", items: seller.items.slice(0, limit) };
      return { ok: false, configured: true, reason: userMessage(seller.statuses, true), items: [] };
    }

    if (resolved.searchQuery) {
      const { discoverPublicAds } = await import("@/lib/ml-discovery.server");
      const discovery = await discoverPublicAds(context.userId, resolved.searchQuery, limit);
      if (discovery.items.length) return { ok: true, configured: true, reason: `Resultados para "${resolved.searchQuery}" interpretados a partir do link de busca.`, items: discovery.items };
      return { ok: false, configured: true, reason: discovery.reason ?? userMessage([], true), items: [] };
    }

    return { ok: false, configured: true, reason: "Não conseguimos identificar anúncio, vendedor ou termo de busca nesse link. Confira se o endereço está completo.", items: [] };
  });

