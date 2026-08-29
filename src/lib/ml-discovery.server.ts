import type { SearchMlItem } from "@/lib/ml-search-production.functions";

/**
 * Descoberta de ANÚNCIOS PÚBLICOS REAIS do Mercado Livre.
 *
 * Diagnóstico (agosto/2026, validado em produção com token de app, de usuário e anônimo):
 * - GET /sites/MLB/search?q=... => 403 {"error":"forbidden"} em TODOS os casos.
 *   O endpoint de busca pública por palavra-chave foi descontinuado para aplicações de terceiros.
 * - GET /items/{id} e /items?ids=... de anúncios de OUTROS vendedores => 403 access_denied.
 * - GET /products/search (catálogo) => 200.
 * - GET /products/{catalog_id}/items => 200 e devolve as OFERTAS REAIS (item_id MLB, seller_id,
 *   preço, preço original, frete, condição, garantia) publicadas por vendedores reais.
 * - GET /users/{seller_id} => 200 (nickname do vendedor real).
 * - GET /highlights/MLB/category/{cat} => 200 (mais produtos com oferta ativa).
 *
 * Por isso a descoberta usa o catálogo apenas como ÍNDICE e devolve sempre anúncios MLB reais
 * (item_id de vendedores reais), nunca o registro genérico de catálogo.
 */

const ML_API = "https://api.mercadolibre.com";
const USER_AGENT = "ANUNCIO-ML/1.0";

type TokenKind = "user" | "app" | "anonymous";
type Attempt = { status: number | "network_error"; body: unknown; tokenKind: TokenKind };

export type DiscoveryOutcome = {
  ok: boolean;
  reason: string | null;
  items: SearchMlItem[];
  diagnostics: { statuses: number[]; products: number; offers: number };
};

const sellerCache = new Map<string, { value: string | null; expires: number }>();

async function tokensFor(userId: string) {
  const { getAppAccessToken, getValidMlAccessToken } = await import("@/lib/ml.server");
  const list: Array<{ token: string; kind: TokenKind }> = [];
  try {
    const user = await getValidMlAccessToken(userId);
    if (user.ok && user.accessToken) list.push({ token: user.accessToken, kind: "user" });
  } catch {}
  try {
    const app = await getAppAccessToken();
    if (app && !list.some((entry) => entry.token === app)) list.push({ token: app, kind: "app" });
  } catch {}
  return list;
}

function headersFor(token?: string) {
  const out: Record<string, string> = { Accept: "application/json", "User-Agent": USER_AGENT };
  if (token) out["Authorization"] = `Bearer ${token}`;
  return out;
}

async function mlGet(
  path: string,
  tokens: Array<{ token: string; kind: TokenKind }>,
  statuses: number[],
): Promise<Attempt> {
  let last: Attempt = { status: "network_error", body: null, tokenKind: "anonymous" };
  for (const entry of tokens) {
    try {
      const response = await fetch(`${ML_API}${path}`, { headers: headersFor(entry.token) });
      statuses.push(response.status);
      const body = await response.json().catch(() => null);
      last = { status: response.status, body, tokenKind: entry.kind };
      if (response.ok) return last;
      if (![401, 403].includes(response.status)) return last;
    } catch {
      last = { status: "network_error", body: null, tokenKind: entry.kind };
    }
  }
  return last;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP_WORDS = new Set(["de", "da", "do", "das", "dos", "com", "para", "por", "e", "em", "o", "a"]);

function queryTokens(value: string) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

export function relevanceScore(query: string, title: string) {
  const q = normalize(query);
  const t = normalize(title);
  if (!q || !t) return 0;
  if (t.includes(q)) return 100;
  const tokens = queryTokens(query);
  if (!tokens.length) return 0;
  const matched = tokens.filter((token) => t.includes(token)).length;
  return Math.round((matched / tokens.length) * 100);
}

function isRelevant(query: string, title: string) {
  const tokens = queryTokens(query);
  const score = relevanceScore(query, title);
  if (tokens.length <= 1) return score >= 100;
  return score >= 60;
}

type ProductRow = {
  id?: string;
  name?: string;
  status?: string;
  pictures?: Array<{ url?: string; secure_url?: string }>;
  attributes?: unknown[];
  permalink?: string;
};

type OfferRow = {
  item_id?: string;
  seller_id?: number | string;
  price?: number;
  original_price?: number | null;
  category_id?: string;
  condition?: string;
  available_quantity?: number;
  sold_quantity?: number;
  official_store_id?: number | null;
  shipping?: { free_shipping?: boolean };
  warranty?: string;
};

function pictureUrls(product: ProductRow) {
  return (product.pictures ?? [])
    .map((picture) => picture.secure_url ?? picture.url ?? null)
    .filter((value): value is string => !!value)
    .map((value) => (value.startsWith("http://") ? `https://${value.slice(7)}` : value));
}

function itemPermalink(itemId: string) {
  const digits = itemId.replace(/^MLB/i, "");
  return `https://produto.mercadolivre.com.br/MLB-${digits}`;
}

async function sellerNickname(
  sellerId: string,
  tokens: Array<{ token: string; kind: TokenKind }>,
  statuses: number[],
) {
  const cached = sellerCache.get(sellerId);
  if (cached && cached.expires > Date.now()) return cached.value;
  const attempt = await mlGet(`/users/${sellerId}`, tokens, statuses);
  const body = attempt.body as { nickname?: unknown } | null;
  const value = typeof body?.nickname === "string" ? body.nickname : null;
  sellerCache.set(sellerId, { value, expires: Date.now() + 10 * 60 * 1000 });
  return value;
}

async function searchCatalogProducts(
  query: string,
  tokens: Array<{ token: string; kind: TokenKind }>,
  statuses: number[],
  pages: number,
) {
  const rows: ProductRow[] = [];
  for (let page = 0; page < pages; page += 1) {
    const params = new URLSearchParams({
      status: "active",
      site_id: "MLB",
      q: query,
      limit: "50",
      offset: String(page * 50),
    });
    const attempt = await mlGet(`/products/search?${params.toString()}`, tokens, statuses);
    if (attempt.status !== 200) break;
    const body = attempt.body as { results?: ProductRow[] } | null;
    const results = body?.results ?? [];
    rows.push(...results);
    if (results.length < 50) break;
  }
  return rows;
}

async function highlightProducts(
  query: string,
  tokens: Array<{ token: string; kind: TokenKind }>,
  statuses: number[],
) {
  const params = new URLSearchParams({ q: query, limit: "5" });
  const discovery = await mlGet(`/sites/MLB/domain_discovery/search?${params.toString()}`, tokens, statuses);
  const rows = Array.isArray(discovery.body) ? (discovery.body as Array<{ category_id?: unknown }>) : [];
  const categories = Array.from(
    new Set(rows.map((row) => (typeof row.category_id === "string" ? row.category_id : null)).filter((v): v is string => !!v)),
  ).slice(0, 3);

  const ids: string[] = [];
  for (const category of categories) {
    const attempt = await mlGet(`/highlights/MLB/category/${category}`, tokens, statuses);
    const body = attempt.body as { content?: Array<{ id?: string; type?: string }> } | null;
    for (const entry of body?.content ?? []) {
      if (entry.type === "PRODUCT" && entry.id) ids.push(entry.id);
    }
  }
  return Array.from(new Set(ids)).slice(0, 30);
}

async function loadProduct(
  productId: string,
  tokens: Array<{ token: string; kind: TokenKind }>,
  statuses: number[],
): Promise<ProductRow | null> {
  const attempt = await mlGet(`/products/${productId}`, tokens, statuses);
  if (attempt.status !== 200) return null;
  return attempt.body as ProductRow;
}

async function offersOf(
  productId: string,
  tokens: Array<{ token: string; kind: TokenKind }>,
  statuses: number[],
  limit: number,
): Promise<OfferRow[]> {
  const attempt = await mlGet(`/products/${productId}/items?limit=${limit}`, tokens, statuses);
  if (attempt.status !== 200) return [];
  const body = attempt.body as { results?: OfferRow[] } | null;
  return body?.results ?? [];
}

function toSearchItem(offer: OfferRow, product: ProductRow, seller: string | null): SearchMlItem | null {
  const id = typeof offer.item_id === "string" ? offer.item_id : null;
  if (!id || typeof offer.price !== "number") return null;
  const images = pictureUrls(product);
  return {
    id,
    title: String(product.name ?? "Anúncio Mercado Livre"),
    price_cents: Math.round(offer.price * 100),
    thumbnail: images[0] ?? null,
    permalink: itemPermalink(id),
    category: offer.category_id ?? null,
    seller,
    seller_id: offer.seller_id != null ? String(offer.seller_id) : null,
    condition: offer.condition ?? null,
    available_quantity: typeof offer.available_quantity === "number" ? offer.available_quantity : null,
    sold_quantity: typeof offer.sold_quantity === "number" ? offer.sold_quantity : null,
    status: "active",
    images,
    attributes: Array.isArray(product.attributes) ? (product.attributes as SearchMlItem["attributes"]) : [],
    source_kind: "catalog_offer",
    verified_item: true,
  };
}

async function mapWithConcurrency<T, R>(list: T[], size: number, worker: (value: T) => Promise<R>) {
  const out: R[] = [];
  for (let index = 0; index < list.length; index += size) {
    const chunk = list.slice(index, index + size);
    out.push(...(await Promise.all(chunk.map(worker))));
  }
  return out;
}

/** Descobre anúncios reais (item_id MLB de vendedores reais) para uma palavra-chave. */
export async function discoverPublicAds(
  userId: string,
  query: string,
  desired: number,
): Promise<DiscoveryOutcome> {
  const statuses: number[] = [];
  const tokens = await tokensFor(userId);
  if (!tokens.length) {
    return {
      ok: false,
      reason: "Conecte sua conta do Mercado Livre para buscar anúncios reais pela API oficial.",
      items: [],
      diagnostics: { statuses, products: 0, offers: 0 },
    };
  }

  const catalog = await searchCatalogProducts(query, tokens, statuses, desired > 40 ? 3 : 2);
  let candidates = catalog
    .filter((row) => !!row.id && isRelevant(query, String(row.name ?? "")))
    .map((row) => ({ id: String(row.id), name: String(row.name ?? ""), row }))
    .sort((a, b) => relevanceScore(query, b.name) - relevanceScore(query, a.name));

  if (candidates.length < 4) {
    const extraIds = await highlightProducts(query, tokens, statuses);
    const extras = await mapWithConcurrency(extraIds, 6, (id) => loadProduct(id, tokens, statuses));
    for (const extra of extras) {
      if (!extra?.id || !isRelevant(query, String(extra.name ?? ""))) continue;
      if (candidates.some((candidate) => candidate.id === extra.id)) continue;
      candidates.push({ id: String(extra.id), name: String(extra.name ?? ""), row: extra });
    }
    candidates = candidates.sort((a, b) => relevanceScore(query, b.name) - relevanceScore(query, a.name));
  }

  const productLimit = Math.min(Math.max(Math.ceil(desired / 3), 6), 18);
  const chosen = candidates.slice(0, productLimit);

  const perProduct = Math.min(Math.max(Math.ceil(desired / Math.max(chosen.length, 1)), 3), 20);
  const groups = await mapWithConcurrency(chosen, 4, async (candidate) => {
    const [product, offers] = await Promise.all([
      candidate.row.pictures?.length ? Promise.resolve(candidate.row) : loadProduct(candidate.id, tokens, statuses),
      offersOf(candidate.id, tokens, statuses, perProduct),
    ]);
    return { product: product ?? candidate.row, offers };
  });

  const sellerIds = Array.from(
    new Set(
      groups.flatMap((group) => group.offers.map((offer) => (offer.seller_id != null ? String(offer.seller_id) : null))).filter((v): v is string => !!v),
    ),
  ).slice(0, 40);
  const nicknames = new Map<string, string | null>();
  await mapWithConcurrency(sellerIds, 6, async (sellerId) => {
    nicknames.set(sellerId, await sellerNickname(sellerId, tokens, statuses));
  });

  const items: SearchMlItem[] = [];
  let offerCount = 0;
  for (const group of groups) {
    for (const offer of group.offers) {
      offerCount += 1;
      const sellerId = offer.seller_id != null ? String(offer.seller_id) : null;
      const item = toSearchItem(offer, group.product, sellerId ? (nicknames.get(sellerId) ?? null) : null);
      if (item) items.push(item);
    }
  }

  const unique = Array.from(new Map(items.map((item) => [item.id, item])).values())
    .sort((a, b) => {
      const diff = relevanceScore(query, b.title) - relevanceScore(query, a.title);
      if (diff) return diff;
      return (a.price_cents ?? 0) - (b.price_cents ?? 0);
    })
    .slice(0, desired);

  if (!unique.length) {
    const reason = statuses.includes(429)
      ? "O Mercado Livre limitou temporariamente as consultas. Aguarde alguns instantes e tente novamente."
      : statuses.includes(401)
        ? "A autorização do Mercado Livre precisa ser renovada. Reconecte sua conta em Integrações."
        : "Nenhum anúncio público real foi encontrado para este termo. Tente uma palavra-chave mais específica de produto (ex.: “iPhone 15 128GB”).";
    return { ok: false, reason, items: [], diagnostics: { statuses, products: chosen.length, offers: offerCount } };
  }

  return {
    ok: true,
    reason: "Anúncios reais de vendedores do Mercado Livre, validados pela API oficial.",
    items: unique,
    diagnostics: { statuses, products: chosen.length, offers: offerCount },
  };
}
