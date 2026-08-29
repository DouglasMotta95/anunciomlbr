import type { SearchMlItem } from "@/lib/ml-search-production.functions";
import { normalizeItemId, normalizeSearchTerm, normalizeSearchText } from "@/lib/ml-search-input";

const ML_API = "https://api.mercadolibre.com";
export const ML_PUBLIC_SEARCH_BASE = "https://lista.mercadolivre.com.br/";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type PublicCard = { id: string; title: string; price_cents: number | null; permalink: string | null; thumbnail: string | null };
type ApiItem = { id?: string; title?: string; price?: number; permalink?: string; thumbnail?: string; category_id?: string; seller_id?: string | number; condition?: string; available_quantity?: number; sold_quantity?: number; status?: string; pictures?: Array<{ secure_url?: string; url?: string }>; attributes?: unknown[] };
type Product = { id?: string; name?: string; pictures?: Array<{ secure_url?: string; url?: string }> };
type Offer = { item_id?: string; seller_id?: string | number; price?: number; category_id?: string; condition?: string; available_quantity?: number; sold_quantity?: number; status?: string };

export type DiscoveryOutcome = {
  ok: boolean;
  reason: string | null;
  items: SearchMlItem[];
  diagnostics: { statuses: number[]; products: number; offers: number; publicSearchStatus: number | "network_error" | null; publicCandidates: number };
};

const STOP = new Set(["de", "da", "do", "das", "dos", "com", "para", "por", "e", "em", "o", "a"]);
function words(value: string) { return normalizeSearchText(value).split(" ").filter((word) => word.length >= 2 && !STOP.has(word)); }

export function relevanceScore(query: string, title: string) {
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(title);
  if (!q || !t) return 0;
  if (t === q) return 120;
  if (t.startsWith(`${q} `) || t.includes(` ${q} `)) return 110;
  if (t.includes(q)) return 100;
  const terms = words(query);
  if (!terms.length) return 0;
  return Math.round((terms.filter((term) => t.includes(term)).length / terms.length) * 100);
}
function relevant(query: string, title: string) { return relevanceScore(query, title) >= (words(query).length <= 1 ? 100 : 55); }

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}
function strip(value: string) { return decode(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()); }
function webUrl(value?: string | null) {
  if (!value) return null;
  const normalized = decode(value);
  if (normalized.startsWith("//")) return `https:${normalized}`;
  if (normalized.startsWith("http://")) return `https://${normalized.slice(7)}`;
  return normalized.startsWith("https://") ? normalized : null;
}
function itemId(value?: string | null) { return value ? normalizeItemId(decode(value)) : null; }
function priceCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value * 100);
  if (typeof value !== "string") return null;
  const raw = strip(value).replace(/R\$/gi, "").replace(/\s/g, "");
  const normalized = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw)
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : null;
}

function jsonLdCards(html: string, query: string) {
  const cards: PublicCard[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const row = value as Record<string, unknown>;
    const rowItem = row["item"];
    const obj = (rowItem && typeof rowItem === "object" ? rowItem : row) as Record<string, unknown>;
    const objUrl = obj["url"];
    const rowUrl = row["url"];
    const url = webUrl(typeof objUrl === "string" ? objUrl : typeof rowUrl === "string" ? rowUrl : null);
    const sku = obj["sku"];
    const productId = obj["productID"];
    const id = itemId(url) ?? itemId(typeof sku === "string" ? sku : null) ?? itemId(typeof productId === "string" ? productId : null);
    const name = obj["name"];
    const title = typeof name === "string" ? name.trim() : "";
    const rawOffers = obj["offers"];
    const offers = rawOffers && typeof rawOffers === "object" ? rawOffers as Record<string, unknown> : null;
    const rawImage = obj["image"];
    const image = Array.isArray(rawImage) ? rawImage[0] : rawImage;
    if (id && title && relevant(query, title)) {
      cards.push({ id, title, price_cents: priceCents(offers?.["price"]), permalink: url, thumbnail: webUrl(typeof image === "string" ? image : null) });
    }
    Object.values(row).forEach(visit);
  };
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(decode(match[1] ?? ""))); } catch { /* malformed JSON-LD: continue with HTML extraction */ }
  }
  return cards;
}

function htmlCards(html: string, query: string) {
  const cards: PublicCard[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = webUrl(match[1]);
    const id = itemId(href) ?? itemId(match[0]);
    if (!href || !id) continue;
    const block = match[0];
    const titleAttr = block.match(/(?:title|aria-label)=["']([^"']{3,220})["']/i)?.[1];
    const titleNode = block.match(/class=["'][^"']*(?:ui-search-item__title|poly-component__title)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1];
    const title = strip(titleAttr ?? titleNode ?? match[2] ?? "").slice(0, 220);
    if (!title || !relevant(query, title)) continue;
    const fraction = block.match(/andes-money-amount__fraction[^>]*>([^<]+)/i)?.[1];
    const image = block.match(/(?:data-src|src)=["'](https?:\/\/[^"']+)["']/i)?.[1];
    cards.push({ id, title, price_cents: priceCents(fraction ?? null), permalink: href, thumbnail: webUrl(image) });
  }
  for (const match of html.matchAll(/MLB[-_ ]?\d{6,}/gi)) {
    const id = itemId(match[0]);
    if (!id) continue;
    const start = Math.max(0, (match.index ?? 0) - 1200);
    const end = Math.min(html.length, (match.index ?? 0) + 1800);
    const context = html.slice(start, end);
    const href = webUrl(context.match(/href=["']([^"']*MLB[^"']+)["']/i)?.[1] ?? null);
    const title = strip(context.match(/(?:title|aria-label)=["']([^"']{3,220})["']/i)?.[1] ?? context.match(/(?:ui-search-item__title|poly-component__title)[^>]*>([^<]+)/i)?.[1] ?? "").slice(0, 220);
    if (!title || !relevant(query, title)) continue;
    cards.push({ id, title, price_cents: priceCents(context.match(/andes-money-amount__fraction[^>]*>([^<]+)/i)?.[1] ?? null), permalink: href, thumbnail: webUrl(context.match(/(?:data-src|src)=["'](https?:\/\/[^"']+)["']/i)?.[1] ?? null) });
  }
  return cards;
}

export function buildPublicSearchUrls(query: string) {
  const slug = normalizeSearchTerm(query);
  return slug ? [`${ML_PUBLIC_SEARCH_BASE}${slug}`, `${ML_PUBLIC_SEARCH_BASE}comprar-${slug}`] : [];
}

async function publicSearch(query: string, desired: number) {
  const urls = buildPublicSearchUrls(query);
  let status: number | "network_error" | null = null;
  const all: PublicCard[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: "follow", headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": WEB_UA } });
      status = response.status;
      console.info("[ML public marketplace]", { strategy: "public_search_url", endpoint: url, status: response.status });
      if (!response.ok) continue;
      const html = await response.text();
      const found = [...jsonLdCards(html, query), ...htmlCards(html, query)];
      all.push(...found);
      console.info("[ML public marketplace]", { strategy: "public_search_url", endpoint: url, candidates: found.length, mlb_ids: new Set(found.map((card) => card.id)).size });
      if (all.length >= desired) break;
    } catch {
      status = "network_error";
      console.info("[ML public marketplace]", { strategy: "public_search_url", endpoint: url, status: "network_error" });
    }
  }
  const cards = Array.from(new Map(all.map((card) => [card.id, card])).values())
    .sort((a, b) => relevanceScore(query, b.title) - relevanceScore(query, a.title))
    .slice(0, Math.max(desired, 40));
  return { status, cards };
}

async function tokens(userId: string) {
  const { getAppAccessToken, getValidMlAccessToken } = await import("@/lib/ml.server");
  const result: string[] = [];
  try { const user = await getValidMlAccessToken(userId); if (user.ok && user.accessToken) result.push(user.accessToken); } catch {}
  try { const app = await getAppAccessToken(); if (app && !result.includes(app)) result.push(app); } catch {}
  return result;
}

async function api(path: string, accessTokens: string[], statuses: number[]) {
  for (const token of [...accessTokens, ""]) {
    try {
      const response = await fetch(`${ML_API}${path}`, { headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      statuses.push(response.status);
      const body = await response.json().catch(() => null);
      console.info("[ML public discovery]", { endpoint: path, status: response.status, token_type: token ? "authenticated" : "anonymous" });
      if (response.ok) return body;
      if (![401, 403].includes(response.status)) break;
    } catch {
      console.info("[ML public discovery]", { endpoint: path, status: "network_error" });
    }
  }
  return null;
}

function baseItem(id: string, title: string, price: number | null, permalink: string | null, thumbnail: string | null, source: "marketplace" | "catalog_offer", verified: boolean): SearchMlItem {
  return { id, title, price_cents: price, thumbnail, permalink, category: null, seller: null, condition: null, available_quantity: null, sold_quantity: null, status: "active", images: thumbnail ? [thumbnail] : [], attributes: [], source_kind: source, seller_id: null, verified_item: verified };
}

function apiToItem(row: ApiItem, fallback?: PublicCard): SearchMlItem | null {
  const id = itemId(row.id) ?? fallback?.id ?? null;
  const title = row.title?.trim() || fallback?.title || "";
  if (!id || !title) return null;
  const thumbnail = webUrl(row.thumbnail) ?? fallback?.thumbnail ?? null;
  return {
    id,
    title,
    price_cents: priceCents(row.price) ?? fallback?.price_cents ?? null,
    thumbnail,
    permalink: webUrl(row.permalink) ?? fallback?.permalink ?? null,
    category: row.category_id ?? null,
    seller: null,
    condition: row.condition ?? null,
    available_quantity: row.available_quantity ?? null,
    sold_quantity: row.sold_quantity ?? null,
    status: row.status ?? "active",
    images: (row.pictures ?? []).map((picture) => webUrl(picture.secure_url ?? picture.url)).filter((value): value is string => !!value),
    attributes: [],
    source_kind: "marketplace",
    seller_id: row.seller_id != null ? String(row.seller_id) : null,
    verified_item: true,
  };
}

export async function discoverPublicAds(userId: string, query: string, desired = 20): Promise<DiscoveryOutcome> {
  const statuses: number[] = [];
  const accessTokens = await tokens(userId);
  const pub = await publicSearch(query, desired);
  const result: SearchMlItem[] = [];

  if (pub.cards.length) {
    for (let offset = 0; offset < pub.cards.length; offset += 20) {
      const batch = pub.cards.slice(offset, offset + 20);
      const body = await api(`/items?ids=${encodeURIComponent(batch.map((card) => card.id).join(","))}`, accessTokens, statuses);
      const rows = Array.isArray(body) ? body : [];
      const byId = new Map<string, ApiItem>();
      for (const entry of rows) {
        const row = entry && typeof entry === "object" && "body" in entry ? (entry as { body?: ApiItem }).body : entry as ApiItem;
        if (row?.id) byId.set(row.id.replace("-", ""), row);
      }
      for (const card of batch) result.push(apiToItem(byId.get(card.id) ?? {}, card) ?? baseItem(card.id, card.title, card.price_cents, card.permalink, card.thumbnail, "marketplace", false));
    }
  }

  let productCount = 0;
  let offerCount = 0;
  let fallbackUsed = false;
  if (result.length < desired) {
    fallbackUsed = true;
    const productBody = await api(`/products/search?status=active&site_id=MLB&q=${encodeURIComponent(query)}&limit=20`, accessTokens, statuses) as { results?: Product[] } | null;
    const products = Array.isArray(productBody?.results) ? productBody.results : [];
    productCount = products.length;
    for (const product of products) {
      if (!product.id || !product.name || !relevant(query, product.name)) continue;
      const offerBody = await api(`/products/${encodeURIComponent(product.id)}/items`, accessTokens, statuses) as { results?: Offer[] } | Offer[] | null;
      const offers = Array.isArray(offerBody) ? offerBody : Array.isArray(offerBody?.results) ? offerBody.results : [];
      offerCount += offers.length;
      const picture = webUrl(product.pictures?.[0]?.secure_url ?? product.pictures?.[0]?.url ?? null);
      for (const offer of offers) {
        const id = itemId(offer.item_id);
        if (!id || result.some((item) => item.id === id)) continue;
        const item = baseItem(id, product.name, priceCents(offer.price), `https://produto.mercadolivre.com.br/MLB-${id.slice(3)}`, picture, "catalog_offer", true);
        item.seller_id = offer.seller_id != null ? String(offer.seller_id) : null;
        item.category = offer.category_id ?? null;
        item.condition = offer.condition ?? null;
        item.available_quantity = offer.available_quantity ?? null;
        item.sold_quantity = offer.sold_quantity ?? null;
        item.status = offer.status ?? "active";
        result.push(item);
        if (result.length >= desired) break;
      }
      if (result.length >= desired) break;
    }
  }

  const items = result
    .filter((item) => /^MLB\d+$/.test(item.id) && relevant(query, item.title))
    .sort((a, b) => relevanceScore(query, b.title) - relevanceScore(query, a.title))
    .slice(0, desired);

  console.info("[ML public discovery summary]", {
    strategy: "public_search_url_first",
    query_slug: normalizeSearchTerm(query),
    public_candidates: pub.cards.length,
    mlb_ids: new Set(pub.cards.map((card) => card.id)).size,
    catalog_products: productCount,
    catalog_offers: offerCount,
    final_results: items.length,
    fallback_used: fallbackUsed,
  });

  const reason = items.length
    ? "Anúncios reais encontrados a partir dos links públicos do Mercado Livre e enriquecidos pela API quando disponível."
    : pub.status === 403
      ? "O Mercado Livre bloqueou a leitura da página pública pelo servidor e a API oficial não retornou ofertas compatíveis para este termo."
      : "Nenhum anúncio público compatível foi recuperado para este termo.";

  return { ok: items.length > 0, reason, items, diagnostics: { statuses, products: productCount, offers: offerCount, publicSearchStatus: pub.status, publicCandidates: pub.cards.length } };
}
