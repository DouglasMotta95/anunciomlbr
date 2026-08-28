import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MlItem } from "./ml.functions";

export * from "./ml.functions";

const ML_API = "https://api.mercadolibre.com";
const USER_AGENT = "ANUNCIO-ML/1.0";

type SearchResult = {
  ok: boolean;
  configured: true;
  reason: string | null;
  items: MlItem[];
};

type FetchAttempt = {
  response: Response | null;
  statuses: number[];
};

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("http://")) return `https://${value.slice("http://".length)}`;
  return value;
}

async function getReadTokens(userId: string): Promise<string[]> {
  const { getAppAccessToken, getValidMlAccessToken } = await import("@/lib/ml.server");
  const tokens: string[] = [];

  try {
    const userToken = await getValidMlAccessToken(userId);
    if (userToken.ok && userToken.accessToken) tokens.push(userToken.accessToken);
  } catch {
    // Continua com app token ou endpoint público quando possível.
  }

  try {
    const appToken = await getAppAccessToken();
    if (appToken && !tokens.includes(appToken)) tokens.push(appToken);
  } catch {
    // Continua com endpoint público quando possível.
  }

  return tokens;
}

function mergeHeaders(base: HeadersInit | undefined, token?: string): Headers {
  const headers = new Headers(base);
  headers.set("Accept", "application/json");
  headers.set("User-Agent", USER_AGENT);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  return headers;
}

async function fetchMl(url: string | URL, init: RequestInit, tokens: string[]): Promise<FetchAttempt> {
  const statuses: number[] = [];
  let last: Response | null = null;

  for (const token of tokens) {
    try {
      const response = await fetch(url, { ...init, headers: mergeHeaders(init.headers, token) });
      statuses.push(response.status);
      last = response;
      if (response.ok) return { response, statuses };
      if (response.status !== 401 && response.status !== 403) return { response, statuses };
    } catch {
      // Tenta a próxima credencial.
    }
  }

  try {
    const response = await fetch(url, { ...init, headers: mergeHeaders(init.headers) });
    statuses.push(response.status);
    last = response;
    return { response, statuses };
  } catch {
    return { response: last, statuses };
  }
}

function mapSearchResult(raw: Record<string, unknown>): MlItem {
  const seller = raw["seller"] as { nickname?: string } | undefined;
  const price = typeof raw["price"] === "number" ? raw["price"] : null;
  return {
    id: String(raw["id"] ?? raw["item_id"] ?? ""),
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

async function getSellerNickname(sellerId: string, tokens: string[]): Promise<string | null> {
  const attempt = await fetchMl(`${ML_API}/users/${encodeURIComponent(sellerId)}`, {}, tokens);
  if (!attempt.response?.ok) return null;
  const raw = (await attempt.response.json().catch(() => null)) as { nickname?: unknown } | null;
  return typeof raw?.nickname === "string" && raw.nickname.trim() ? raw.nickname.trim() : null;
}

async function fetchItem(itemId: string, tokens: string[]): Promise<{ item: MlItem | null; statuses: number[] }> {
  const id = itemId.toUpperCase().replace("MLB-", "MLB");
  const attempt = await fetchMl(`${ML_API}/items/${encodeURIComponent(id)}?include_attributes=all`, {}, tokens);
  if (!attempt.response?.ok) return { item: null, statuses: attempt.statuses };

  const raw = (await attempt.response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return { item: null, statuses: attempt.statuses };
  const price = typeof raw["price"] === "number" ? raw["price"] : null;
  const pictures = Array.isArray(raw["pictures"])
    ? (raw["pictures"] as Array<{ secure_url?: string; url?: string }>)
    : [];
  const images = pictures
    .map((picture) => httpsUrl(picture.secure_url ?? picture.url))
    .filter((value): value is string => !!value);
  const sellerId = raw["seller_id"] != null ? String(raw["seller_id"]) : null;

  return {
    statuses: attempt.statuses,
    item: {
      id: String(raw["id"] ?? id),
      title: String(raw["title"] ?? ""),
      price_cents: price === null ? null : Math.round(price * 100),
      thumbnail: httpsUrl(raw["thumbnail"]) ?? images[0] ?? null,
      permalink: httpsUrl(raw["permalink"]),
      category: (raw["category_id"] as string) ?? null,
      seller: sellerId ? await getSellerNickname(sellerId, tokens) : null,
      condition: (raw["condition"] as string) ?? null,
      available_quantity: (raw["available_quantity"] as number) ?? null,
      sold_quantity: (raw["sold_quantity"] as number) ?? null,
      status: (raw["status"] as string) ?? null,
      images,
      attributes: Array.isArray(raw["attributes"]) ? (raw["attributes"] as unknown[]) : [],
    },
  };
}

async function enrichItems(items: MlItem[], tokens: string[], limit: number): Promise<MlItem[]> {
  const selected = items.filter((item) => !!item.id).slice(0, limit);
  const enriched = await Promise.all(
    selected.map(async (item) => {
      const detail = await fetchItem(item.id, tokens);
      return detail.item ? { ...item, ...detail.item } : item;
    }),
  );
  return enriched;
}

async function searchMarketplaceListings(query: string, limit: number, tokens: string[]) {
  const url = new URL(`${ML_API}/sites/MLB/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  const attempt = await fetchMl(url, {}, tokens);
  if (!attempt.response?.ok) return { items: [] as MlItem[], statuses: attempt.statuses, failed: true };
  const payload = (await attempt.response.json().catch(() => null)) as
    | { results?: Array<Record<string, unknown>> }
    | null;
  const mapped = (payload?.results ?? []).map(mapSearchResult).filter((item) => !!item.id);
  return { items: await enrichItems(mapped, tokens, limit), statuses: attempt.statuses, failed: false };
}

async function getCatalogListingIds(productId: string, tokens: string[], limit: number): Promise<{ ids: string[]; statuses: number[] }> {
  const url = new URL(`${ML_API}/products/${encodeURIComponent(productId)}/items`);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 100)));
  const attempt = await fetchMl(url, {}, tokens);
  if (!attempt.response?.ok) return { ids: [], statuses: attempt.statuses };
  const payload = (await attempt.response.json().catch(() => null)) as
    | { results?: Array<{ item_id?: unknown }> }
    | null;
  const ids = (payload?.results ?? [])
    .map((row) => (typeof row.item_id === "string" ? row.item_id : null))
    .filter((id): id is string => !!id && /^MLB-?\d+$/i.test(id));
  return { ids: Array.from(new Set(ids)), statuses: attempt.statuses };
}

async function searchCatalogProducts(query: string, limit: number, tokens: string[]) {
  const requested = Math.min(Math.max(limit, 1), 30);
  const url = new URL(`${ML_API}/products/search`);
  url.searchParams.set("status", "active");
  url.searchParams.set("site_id", "MLB");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(requested, 12)));

  const attempt = await fetchMl(url, {}, tokens);
  if (!attempt.response?.ok) return { items: [] as MlItem[], statuses: attempt.statuses, failed: true };
  const payload = (await attempt.response.json().catch(() => null)) as
    | { results?: Array<{ id?: string }> }
    | null;

  const productIds = (payload?.results ?? [])
    .map((product) => product.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .slice(0, 12);

  const listingIdGroups = await Promise.all(
    productIds.map((productId) => getCatalogListingIds(productId, tokens, Math.min(8, requested))),
  );
  const listingIds = Array.from(new Set(listingIdGroups.flatMap((group) => group.ids))).slice(0, requested);

  if (listingIds.length) {
    const items = await Promise.all(listingIds.map(async (id) => (await fetchItem(id, tokens)).item));
    return {
      items: items.filter((item): item is MlItem => !!item),
      statuses: [...attempt.statuses, ...listingIdGroups.flatMap((group) => group.statuses)],
      failed: false,
    };
  }

  // Fallback: alguns produtos de catálogo ainda retornam somente buy_box_winner.
  const details = await Promise.all(
    productIds.map(async (productId) => {
      const productAttempt = await fetchMl(`${ML_API}/products/${encodeURIComponent(productId)}`, {}, tokens);
      if (!productAttempt.response?.ok) return null;
      const raw = (await productAttempt.response.json().catch(() => null)) as Record<string, unknown> | null;
      const winner = raw?.["buy_box_winner"] as Record<string, unknown> | undefined;
      const itemId = typeof winner?.["item_id"] === "string" ? winner["item_id"] : null;
      return itemId ? (await fetchItem(itemId, tokens)).item : null;
    }),
  );

  return {
    items: details.filter((item): item is MlItem => !!item).slice(0, requested),
    statuses: [...attempt.statuses, ...listingIdGroups.flatMap((group) => group.statuses)],
    failed: false,
  };
}

async function searchSellerListings(query: string, limit: number, tokens: string[]) {
  const value = query.trim();
  if (/^\d+$/.test(value)) {
    const url = new URL(`${ML_API}/users/${encodeURIComponent(value)}/items/search`);
    url.searchParams.set("status", "active");
    url.searchParams.set("limit", String(Math.min(limit, 50)));
    const attempt = await fetchMl(url, {}, tokens);
    if (!attempt.response?.ok) return { items: [] as MlItem[], statuses: attempt.statuses, failed: true };
    const payload = (await attempt.response.json().catch(() => null)) as { results?: string[] } | null;
    const items = await Promise.all(
      (payload?.results ?? []).slice(0, limit).map(async (id) => (await fetchItem(id, tokens)).item),
    );
    return {
      items: items.filter((item): item is MlItem => !!item),
      statuses: attempt.statuses,
      failed: false,
    };
  }

  const url = new URL(`${ML_API}/sites/MLB/search`);
  url.searchParams.set("nickname", value.replace(/^@/, ""));
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  const attempt = await fetchMl(url, {}, tokens);
  if (!attempt.response?.ok) return { items: [] as MlItem[], statuses: attempt.statuses, failed: true };
  const payload = (await attempt.response.json().catch(() => null)) as
    | { results?: Array<Record<string, unknown>> }
    | null;
  const mapped = (payload?.results ?? []).map(mapSearchResult).filter((item) => !!item.id);
  return { items: await enrichItems(mapped, tokens, limit), statuses: attempt.statuses, failed: false };
}

function mergeResults(primary: MlItem[], secondary: MlItem[], limit: number): MlItem[] {
  const unique = new Map<string, MlItem>();
  for (const item of [...primary, ...secondary]) {
    if (item.id && !unique.has(item.id)) unique.set(item.id, item);
  }
  return Array.from(unique.values()).slice(0, limit);
}

function statusHint(statuses: number[]): string {
  const unique = Array.from(new Set(statuses));
  if (unique.includes(401)) return "A autorização de leitura do Mercado Livre foi recusada (401). Reconecte a conta se o erro continuar.";
  if (unique.includes(403)) return "O Mercado Livre bloqueou uma das modalidades de consulta (403). A busca tenta automaticamente os caminhos de catálogo, ID, link e vendedor disponíveis.";
  if (unique.includes(429)) return "O Mercado Livre limitou temporariamente as consultas. Aguarde alguns instantes e tente novamente.";
  if (unique.some((status) => status >= 500)) return "O Mercado Livre está indisponível no momento. Tente novamente em alguns minutos.";
  return "Não foi possível consultar o Mercado Livre agora.";
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

function normalizeLinkInput(raw: string): string | null {
  const trimmed = raw.trim();
  const embedded = trimmed.match(/https?:\/\/[^\s]+/i)?.[0];
  const candidate = embedded ?? trimmed;
  if (/^(?:www\.)?(?:produto\.|lista\.)?mercadolivre\.com\.br\//i.test(candidate)) return `https://${candidate}`;
  if (/^(?:www\.)?meli\.la\//i.test(candidate)) return `https://${candidate}`;
  return candidate;
}

async function resolveMlLink(rawLink: string): Promise<{ itemId: string | null; productId: string | null }> {
  const normalized = normalizeLinkInput(rawLink);
  if (!normalized) return { itemId: null, productId: null };
  let current: URL;
  try {
    current = new URL(normalized);
  } catch {
    return { itemId: null, productId: null };
  }
  if (!isAllowedMlHost(current.hostname)) return { itemId: null, productId: null };

  for (let hop = 0; hop < 5; hop += 1) {
    const directId = extractMlbId(`${current.pathname}${current.search}`);
    if (directId) {
      const productPath = /\/p\/MLB-?\d+/i.test(current.pathname);
      return productPath ? { itemId: null, productId: directId } : { itemId: directId, productId: null };
    }
    try {
      const response = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT },
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
  return finalId ? { itemId: finalId, productId: null } : { itemId: null, productId: null };
}

async function itemFromProduct(productId: string, tokens: string[]): Promise<MlItem | null> {
  const offers = await getCatalogListingIds(productId, tokens, 1);
  if (offers.ids[0]) return (await fetchItem(offers.ids[0], tokens)).item;

  const attempt = await fetchMl(`${ML_API}/products/${encodeURIComponent(productId)}`, {}, tokens);
  if (!attempt.response?.ok) return null;
  const raw = (await attempt.response.json().catch(() => null)) as Record<string, unknown> | null;
  const winner = raw?.["buy_box_winner"] as Record<string, unknown> | undefined;
  const itemId = typeof winner?.["item_id"] === "string" ? winner["item_id"] : null;
  return itemId ? (await fetchItem(itemId, tokens)).item : null;
}

export const searchMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(50).optional() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokens = await getReadTokens(context.userId);
    const limit = data.limit ?? 24;
    const [marketplace, catalog] = await Promise.all([
      searchMarketplaceListings(data.query, limit, tokens),
      searchCatalogProducts(data.query, limit, tokens),
    ]);
    const items = mergeResults(marketplace.items, catalog.items, limit);
    if (items.length > 0) return { ok: true, configured: true, reason: null, items };

    const statuses = [...marketplace.statuses, ...catalog.statuses];
    if (!marketplace.failed || !catalog.failed) {
      return {
        ok: true,
        configured: true,
        reason: statuses.includes(403)
          ? "A busca ampla do marketplace foi restringida, e o catálogo oficial não encontrou ofertas clonáveis para este termo. Tente uma descrição mais específica, um ID, link ou vendedor."
          : null,
        items: [],
      };
    }
    return { ok: false, configured: true, reason: statusHint(statuses), items: [] };
  });

export const searchMercadoLivreProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(30).optional() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokens = await getReadTokens(context.userId);
    const result = await searchCatalogProducts(data.query, data.limit ?? 24, tokens);
    if (!result.failed) return { ok: true, configured: true, reason: null, items: result.items };
    return { ok: false, configured: true, reason: statusHint(result.statuses), items: [] };
  });

export const searchMercadoLivreSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().min(2).max(120), limit: z.number().int().min(1).max(50).optional() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokens = await getReadTokens(context.userId);
    const result = await searchSellerListings(data.query, data.limit ?? 24, tokens);
    if (!result.failed) return { ok: true, configured: true, reason: null, items: result.items };
    return {
      ok: false,
      configured: true,
      reason: result.statuses.includes(404)
        ? "Vendedor não encontrado. Confira o nickname ou o ID numérico."
        : statusHint(result.statuses),
      items: [],
    };
  });

export const getMercadoLivreItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().trim().regex(/^MLB-?\d+$/i, "ID inválido. Use o formato MLB1234567890.") }).parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokens = await getReadTokens(context.userId);
    const result = await fetchItem(data.id, tokens);
    if (result.item) return { ok: true, configured: true, reason: null, items: [result.item] };
    return {
      ok: false,
      configured: true,
      reason: result.statuses.includes(404)
        ? "Esse ID não existe ou o anúncio não está mais disponível no Mercado Livre."
        : statusHint(result.statuses),
      items: [],
    };
  });

export const getMercadoLivreItemFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ link: z.string().trim().min(4).max(1000) }).parse(data))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const tokens = await getReadTokens(context.userId);
    const resolved = await resolveMlLink(data.link);
    if (!resolved.itemId && !resolved.productId) {
      return {
        ok: false,
        configured: true,
        reason: "Não conseguimos identificar um anúncio nesse link. Cole a URL do Mercado Livre ou o texto de compartilhamento que contenha a URL.",
        items: [],
      };
    }
    if (resolved.itemId) {
      const result = await fetchItem(resolved.itemId, tokens);
      if (result.item) return { ok: true, configured: true, reason: null, items: [result.item] };
      return { ok: false, configured: true, reason: statusHint(result.statuses), items: [] };
    }
    const item = await itemFromProduct(resolved.productId!, tokens);
    return item
      ? { ok: true, configured: true, reason: null, items: [item] }
      : { ok: false, configured: true, reason: "O produto foi identificado, mas o Mercado Livre não retornou um anúncio ativo para copiar.", items: [] };
  });
