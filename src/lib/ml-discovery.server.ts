import type { SearchMlItem } from "@/lib/ml-search-production.functions";

/**
 * Descoberta de ANÚNCIOS PÚBLICOS REAIS do Mercado Livre.
 *
 * Estratégia, em ordem:
 * 1) Busca pública do próprio marketplace (lista.mercadolivre.com.br/<termo>), equivalente à barra de busca.
 * 2) Extrai somente anúncios com item_id MLB, título/preço/link/imagem públicos.
 * 3) Tenta enriquecer/validar cada MLB pela API oficial quando o recurso estiver liberado.
 * 4) Se a página pública estiver indisponível no servidor, usa catálogo apenas como ÍNDICE para chegar
 *    às ofertas reais (/products/{catalog_id}/items), nunca devolvendo o produto genérico do catálogo.
 *
 * Não há bypass de CAPTCHA/anti-bot: se a página pública negar acesso, o fluxo cai para a API oficial.
 */

const ML_API = "https://api.mercadolibre.com";
const ML_LIST = "https://lista.mercadolivre.com.br";
const API_USER_AGENT = "ANUNCIO-ML/1.0";
const WEB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type TokenKind = "user" | "app" | "anonymous";
type Attempt = { status: number | "network_error"; body: unknown; tokenKind: TokenKind };

type PublicCard = {
  id: string;
  title: string;
  price_cents: number | null;
  permalink: string | null;
  thumbnail: string | null;
};

export type DiscoveryOutcome = {
  ok: boolean;
  reason: string | null;
  items: SearchMlItem[];
  diagnostics: {
    statuses: number[];
    products: number;
    offers: number;
    publicSearchStatus: number | "network_error" | null;
    publicCandidates: number;
  };
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
  const out: Record<string, string> = { Accept: "application/json", "User-Agent": API_USER_AGENT };
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
      console.info("[ML public discovery]", { endpoint: path, status: response.status, token_type: entry.kind });
      last = { status: response.status, body, tokenKind: entry.kind };
      if (response.ok) return last;
      if (![401, 403].includes(response.status)) return last;
    } catch {
      console.info("[ML public discovery]", { endpoint: path, status: "network_error", token_type: entry.kind });
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

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function slugifySearch(query: string) {
  return normalize(query).replace(/\s+/g, "-");
}

function normalizeItemId(value: string | null | undefined) {
  if (!value) return null;
  const match = value.toUpperCase().match(/MLB[-_ ]?(\d{6,})/);
  return match ? `MLB${match[1]}` : null;
}

function idFromUrl(url: string | null) {
  if (!url) return null;
  const decoded = decodeHtml(url);
  const itemParam = decoded.match(/[?&](?:item_id|itemId)=((?:MLB)[-_ ]?\d{6,})/i)?.[1];
  return normalizeItemId(itemParam ?? decoded);
}

function safeWebUrl(value: string | null | undefined) {
  if (!value) return null;
  const decoded = decodeHtml(value).replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  if (decoded.startsWith("//")) return `https:${decoded}`;
  if (/^https:\/\//i.test(decoded)) return decoded;
  if (/^http:\/\//i.test(decoded)) return `https://${decoded.slice(7)}`;
  return null;
}

function priceToCents(raw: string | number | null | undefined) {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw * 100);
  if (typeof raw !== "string") return null;
  const text = stripTags(raw).replace(/R\$/gi, "").replace(/\s/g, "");
  if (!text) return null;
  let normalized = text;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text)) normalized = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(,\d{1,2})$/.test(text)) normalized = text.replace(",", ".");
  else normalized = text.replace(/[^0-9.]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

function extractJsonLdCards(html: string, query: string) {
  const cards: PublicCard[] = [];
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    const row = value as Record<string, unknown>;
    const candidate = (row["item"] && typeof row["item"] === "object" ? row["item"] : row) as Record<string, unknown>;
    const url = safeWebUrl(typeof candidate["url"] === "string" ? candidate["url"] : typeof row["url"] === "string" ? row["url"] : null);
    const id = idFromUrl(url) ?? normalizeItemId(typeof candidate["sku"] === "string" ? candidate["sku"] : null);
    const title = typeof candidate["name"] === "string" ? candidate["name"].trim() : "";
    const offers = candidate["offers"] as Record<string, unknown> | undefined;
    const imageRaw = Array.isArray(candidate["image"]) ? candidate["image"][0] : candidate["image"];
    if (id && title && isRelevant(query, title)) {
      cards.push({
        id,
        title,
        price_cents: priceToCents(typeof offers?.["price"] === "number" || typeof offers?.["price"] === "string" ? (offers["price"] as number | string) : null),
        permalink: url,
        thumbnail: safeWebUrl(typeof imageRaw === "string" ? imageRaw : null),
      });
    }
    for (const child of Object.values(row)) visit(child);
  };

  for (const script of scripts) {
    try {
      visit(JSON.parse(decodeHtml(script[1] ?? "")) as unknown);
    } catch {}
  }
  return cards;
}

function extractHtmlCards(html: string, query: string) {
  const cards: PublicCard[] = [];
  const blocks = Array.from(html.matchAll(/<(?:li|div)[^>]+class=["'][^"']*(?:ui-search-layout__item|poly-card)[^"']*["'][^>]*>([\s\S]*?)(?=<\/(?:li|div)>)/gi)).map((match) => match[0]);
  const sources = blocks.length ? blocks : [html];

  for (const block of sources) {
    const hrefMatch = block.match(/href=["']([^"']+)["']/i);
    const href = safeWebUrl(hrefMatch?.[1] ?? null);
    const id = idFromUrl(href) ?? normalizeItemId(block);
    if (!id) continue;

    const titleMatch = block.match(/class=["'][^"']*(?:ui-search-item__title|poly-component__title)[^"']*["'][^>]*>([\s\S]*?)<\//i)
      ?? block.match(/(?:title|aria-label)=["']([^"']{3,180})["']/i);
    const title = stripTags(titleMatch?.[1] ?? "").slice(0, 180);
    if (!title || !isRelevant(query, title)) continue;

    const fraction = block.match(/class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] ?? null;
    const cents = block.match(/class=["'][^"']*andes-money-amount__cents[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] ?? null;
    let price_cents = priceToCents(fraction);
    if (price_cents != null && cents) {
      const parsedCents = Number(stripTags(cents).replace(/\D/g, "").slice(0, 2));
      if (Number.isFinite(parsedCents)) price_cents += parsedCents;
    }

    const img = block.match(/(?:data-src|src)=["'](https?:\/\/[^"']+)["']/i)?.[1] ?? null;
    cards.push({ id, title, price_cents, permalink: href, thumbnail: safeWebUrl(img) });
    if (blocks.length === 0 && cards.length >= 80) break;
  }
  return cards;
}

async function searchPublicMarketplace(query: string, desired: number) {
  const slug = slugifySearch(query);
  if (!slug) return { status: null as number | "network_error" | null, cards: [] as PublicCard[], url: null as string | null };
  const url = `${ML_LIST}/${encodeURIComponent(slug).replace(/%2D/g, "-")}`;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
        "Cache-Control": "no-cache",
        "User-Agent": WEB_USER_AGENT,
      },
    });
    console.info("[ML public marketplace]", { endpoint: url, status: response.status });
    if (!response.ok) return { status: response.status, cards: [] as PublicCard[], url };
    const html = await response.text();
    const merged = [...extractJsonLdCards(html, query), ...extractHtmlCards(html, query)];
    const cards = Array.from(new Map(merged.map((card) => [card.id, card])).values())
      .sort((a, b) => {
        const diff = relevanceScore(query, b.title) - relevanceScore(query, a.title);
        if (diff) return diff;
        return Number(b.price_cents != null) - Number(a.price_cents != null);
      })
      .slice(0, Math.max(desired * 2, 40));
    return { status: response.status, cards, url };
  } catch {
    console.info("[ML public marketplace]", { endpoint: url, status: "network_error" });
    return { status: "network_error" as const, cards: [] as PublicCard[], url };
  }
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

type ItemApiRow = {
  id?: string;
  title?: string;
  price?: number;
  permalink?: string;
  thumbnail?: string;
  category_id?: string;
  seller_id?: number | string;
  condition?: string;
  available_quantity?: number;
  sold_quantity?: number;
  status?: string;
  pictures?: Array<{ secure_url?: string; url?: string }>;
  attributes?: SearchMlItem["attributes"];
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

async function fetchItemsByIds(
  ids: string[],
  tokens: Array<{ token: string; kind: TokenKind }>,
  statuses: number[],
) {
  const unique = Array.from(new Set(ids.map((id) => normalizeItemId(id)).filter((id): id is string => !!id)));
  const output = new Map<string, SearchMlItem>();
  for (let index = 0; index < unique.length; index += 20) {
    const chunk = unique.slice(index, index + 20);
    const attempt = await mlGet(`/items?ids=${encodeURIComponent(chunk.join(","))}&include_attributes=all`, tokens, statuses);
    if (attempt.status !== 200 || !Array.isArray(attempt.body)) continue;
    for (const row of attempt.body as Array<{ code?: number; body?: ItemApiRow }>) {
      if (row.code !== 200 || !row.body) continue;
      const raw = row.body;
      const id = normalizeItemId(raw.id);
      if (!id || !raw.title) continue;
      const sellerId = raw.seller_id != null ? String(raw.seller_id) : null;
      const images = (raw.pictures ?? [])
        .map((picture) => safeWebUrl(picture.secure_url ?? picture.url ?? null))
        .filter((value): value is string => !!value);
      const seller = sellerId ? await sellerNickname(sellerId, tokens, statuses) : null;
      output.set(id, {
        id,
        title: raw.title,
        price_cents: typeof raw.price === "number" ? Math.round(raw.price * 100) : null,
        thumbnail: safeWebUrl(raw.thumbnail ?? null) ?? images[0] ?? null,
        permalink: safeWebUrl(raw.permalink ?? null) ?? itemPermalink(id),
        category: raw.category_id ?? null,
        seller,
        seller_id: sellerId,
        condition: raw.condition ?? null,
        available_quantity: typeof raw.available_quantity === "number" ? raw.available_quantity : null,
        sold_quantity: typeof raw.sold_quantity === "number" ? raw.sold_quantity : null,
        status: raw.status ?? null,
        images,
        attributes: Array.isArray(raw.attributes) ? raw.attributes : [],
        source_kind: "marketplace",
        verified_item: true,
      });
    }
  }
  return output;
}

function publicCardToItem(card: PublicCard): SearchMlItem {
  return {
    id: card.id,
    title: card.title,
    price_cents: card.price_cents,
    thumbnail: card.thumbnail,
    permalink: card.permalink ?? itemPermalink(card.id),
    category: null,
    seller: null,
    seller_id: null,
    condition: null,
    available_quantity: null,
    sold_quantity: null,
    status: "active",
    images: card.thumbnail ? [card.thumbnail] : [],
    attributes: [],
    source_kind: "marketplace",
    verified_item: false,
  };
}

async function searchCatalogProducts(
  query: string,
  tokens: Array<{ token: string; kind: TokenKind }>,
  statuses: number[],
  pages: number,
) {
  const rows: ProductRow[] = [];
  for (let page = 0; page < pages; page += 1) {
    const params = new URLSearchParams({ status: "active", site_id: "MLB", q: query, limit: "50", offset: String(page * 50) });
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
  const categories = Array.from(new Set(rows.map((row) => (typeof row.category_id === "string" ? row.category_id : null)).filter((v): v is string => !!v))).slice(0, 3);
  const ids: string[] = [];
  for (const category of categories) {
    const attempt = await mlGet(`/highlights/MLB/category/${category}`, tokens, statuses);
    const body = attempt.body as { content?: Array<{ id?: string; type?: string }> } | null;
    for (const entry of body?.content ?? []) if (entry.type === "PRODUCT" && entry.id) ids.push(entry.id);
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
  const id = normalizeItemId(offer.item_id);
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

async function catalogFallback(
  query: string,
  desired: number,
  tokens: Array<{ token: string; kind: TokenKind }>,
  statuses: number[],
) {
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

  const sellerIds = Array.from(new Set(groups.flatMap((group) => group.offers.map((offer) => (offer.seller_id != null ? String(offer.seller_id) : null))).filter((v): v is string => !!v))).slice(0, 40);
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
  return { items, productCount: chosen.length, offerCount };
}

/** Descobre anúncios públicos reais para uma palavra-chave, priorizando a mesma URL da busca do marketplace. */
export async function discoverPublicAds(userId: string, query: string, desired: number): Promise<DiscoveryOutcome> {
  const statuses: number[] = [];
  const tokens = await tokensFor(userId);
  if (!tokens.length) {
    return {
      ok: false,
      reason: "Conecte sua conta do Mercado Livre para buscar anúncios reais.",
      items: [],
      diagnostics: { statuses, products: 0, offers: 0, publicSearchStatus: null, publicCandidates: 0 },
    };
  }

  const publicSearch = await searchPublicMarketplace(query, desired);
  if (publicSearch.cards.length) {
    const apiById = await fetchItemsByIds(publicSearch.cards.map((card) => card.id), tokens, statuses);
    const items = publicSearch.cards.map((card) => apiById.get(card.id) ?? publicCardToItem(card));
    const unique = Array.from(new Map(items.map((item) => [item.id, item])).values())
      .filter((item) => isRelevant(query, item.title))
      .sort((a, b) => {
        const diff = relevanceScore(query, b.title) - relevanceScore(query, a.title);
        if (diff) return diff;
        return Number(b.verified_item === true) - Number(a.verified_item === true);
      })
      .slice(0, desired);

    if (unique.length) {
      return {
        ok: true,
        reason: "Resultados encontrados pela busca pública do Mercado Livre; anúncios MLB enriquecidos pela API oficial quando permitido.",
        items: unique,
        diagnostics: {
          statuses,
          products: 0,
          offers: unique.length,
          publicSearchStatus: publicSearch.status,
          publicCandidates: publicSearch.cards.length,
        },
      };
    }
  }

  const fallback = await catalogFallback(query, desired, tokens, statuses);
  const unique = Array.from(new Map(fallback.items.map((item) => [item.id, item])).values())
    .filter((item) => isRelevant(query, item.title))
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
        : publicSearch.status === 403
          ? "A página pública do Mercado Livre bloqueou a consulta pelo servidor e a API oficial não retornou ofertas compatíveis para este termo."
          : "Nenhum anúncio público real foi encontrado para este termo agora.";
    return {
      ok: false,
      reason,
      items: [],
      diagnostics: {
        statuses,
        products: fallback.productCount,
        offers: fallback.offerCount,
        publicSearchStatus: publicSearch.status,
        publicCandidates: publicSearch.cards.length,
      },
    };
  }

  return {
    ok: true,
    reason: "Anúncios reais de vendedores do Mercado Livre encontrados por ofertas oficiais do marketplace.",
    items: unique,
    diagnostics: {
      statuses,
      products: fallback.productCount,
      offers: fallback.offerCount,
      publicSearchStatus: publicSearch.status,
      publicCandidates: publicSearch.cards.length,
    },
  };
}
