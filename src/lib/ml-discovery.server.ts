import type { SearchMlItem } from "@/lib/ml-search-production.functions";
import { normalizeItemId, normalizeSearchTerm, normalizeSearchText } from "@/lib/ml-search-input";

const ML_API = "https://api.mercadolibre.com";
export const ML_PUBLIC_SEARCH_BASE = "https://lista.mercadolivre.com.br/";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type PublicCard = { id: string; title: string; price_cents: number | null; permalink: string | null; thumbnail: string | null };
type ApiItem = { id?: string; title?: string; price?: number; permalink?: string; thumbnail?: string; category_id?: string; seller_id?: string | number; condition?: string; available_quantity?: number; sold_quantity?: number; status?: string; pictures?: Array<{ secure_url?: string; url?: string }>; attributes?: unknown[] };
type SiteSearchBody = { paging?: { total?: number; offset?: number; limit?: number }; results?: ApiItem[] };

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
    const url = webUrl(typeof obj["url"] === "string" ? obj["url"] : typeof row["url"] === "string" ? row["url"] : null);
    const id = itemId(url) ?? itemId(typeof obj["sku"] === "string" ? obj["sku"] : null) ?? itemId(typeof obj["productID"] === "string" ? obj["productID"] : null);
    const title = typeof obj["name"] === "string" ? obj["name"].trim() : "";
    const offers = obj["offers"] && typeof obj["offers"] === "object" ? obj["offers"] as Record<string, unknown> : null;
    const rawImage = obj["image"];
    const image = Array.isArray(rawImage) ? rawImage[0] : rawImage;
    if (id && title && relevant(query, title)) cards.push({ id, title, price_cents: priceCents(offers?.["price"]), permalink: url, thumbnail: webUrl(typeof image === "string" ? image : null) });
    Object.values(row).forEach(visit);
  };
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(decode(match[1] ?? ""))); } catch {}
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
    cards.push({ id, title, price_cents: priceCents(block.match(/andes-money-amount__fraction[^>]*>([^<]+)/i)?.[1] ?? null), permalink: href, thumbnail: webUrl(block.match(/(?:data-src|src)=["'](https?:\/\/[^"']+)["']/i)?.[1] ?? null) });
  }
  return cards;
}

export function buildPublicSearchUrls(query: string) {
  const slug = normalizeSearchTerm(query);
  return slug ? [`${ML_PUBLIC_SEARCH_BASE}${slug}`, `${ML_PUBLIC_SEARCH_BASE}comprar-${slug}`] : [];
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
      const response = await fetch(`${ML_API}${path}`, { headers: { Accept: "application/json", "User-Agent": "ANUNCIO-ML/1.0", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(15000) });
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

function baseItem(id: string, title: string, price: number | null, permalink: string | null, thumbnail: string | null, verified: boolean): SearchMlItem {
  return { id, title, price_cents: price, thumbnail, permalink, category: null, seller: null, condition: null, available_quantity: null, sold_quantity: null, status: "active", images: thumbnail ? [thumbnail] : [], attributes: [], source_kind: "marketplace", seller_id: null, verified_item: verified };
}

function apiToItem(row: ApiItem, fallback?: PublicCard): SearchMlItem | null {
  const id = itemId(row.id) ?? fallback?.id ?? null;
  const title = row.title?.trim() || fallback?.title || "";
  if (!id || !title) return null;
  const thumbnail = webUrl(row.thumbnail) ?? fallback?.thumbnail ?? null;
  const images = (row.pictures ?? []).map((picture) => webUrl(picture.secure_url ?? picture.url)).filter((value): value is string => !!value);
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
    sold_quantity: typeof row.sold_quantity === "number" ? row.sold_quantity : null,
    status: row.status ?? "active",
    images: images.length ? images : thumbnail ? [thumbnail] : [],
    attributes: Array.isArray(row.attributes) ? row.attributes : [],
    source_kind: "marketplace",
    seller_id: row.seller_id != null ? String(row.seller_id) : null,
    verified_item: true,
  };
}

async function marketplaceApiSearch(query: string, desired: number, accessTokens: string[], statuses: number[]) {
  const all: SearchMlItem[] = [];
  const pageSize = 50;
  for (let offset = 0; offset < desired; offset += pageSize) {
    const limit = Math.min(pageSize, desired - offset);
    const body = await api(`/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`, accessTokens, statuses) as SiteSearchBody | null;
    const rows = Array.isArray(body?.results) ? body.results : [];
    for (const row of rows) {
      const item = apiToItem(row);
      if (item && relevant(query, item.title)) all.push(item);
    }
    if (rows.length < limit || all.length >= desired) break;
  }
  return Array.from(new Map(all.map((item) => [item.id, item])).values()).slice(0, desired);
}

async function publicSearch(query: string, desired: number) {
  const urls = buildPublicSearchUrls(query);
  let status: number | "network_error" | null = null;
  const all: PublicCard[] = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: "follow", headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": WEB_UA }, signal: AbortSignal.timeout(15000) });
      status = response.status;
      if (!response.ok) continue;
      const html = await response.text();
      all.push(...jsonLdCards(html, query), ...htmlCards(html, query));
      if (all.length >= desired) break;
    } catch {
      status = "network_error";
    }
  }
  return {
    status,
    cards: Array.from(new Map(all.map((card) => [card.id, card])).values())
      .sort((a, b) => relevanceScore(query, b.title) - relevanceScore(query, a.title))
      .slice(0, desired),
  };
}

export async function discoverPublicAds(userId: string, query: string, desired = 20): Promise<DiscoveryOutcome> {
  const statuses: number[] = [];
  const accessTokens = await tokens(userId);
  const official = await marketplaceApiSearch(query, desired, accessTokens, statuses);
  const result: SearchMlItem[] = [...official];
  let publicSearchStatus: number | "network_error" | null = null;
  let publicCandidates = 0;

  if (result.length < desired) {
    const pub = await publicSearch(query, desired - result.length);
    publicSearchStatus = pub.status;
    publicCandidates = pub.cards.length;
    const missing = pub.cards.filter((card) => !result.some((item) => item.id === card.id));
    if (missing.length) {
      for (let offset = 0; offset < missing.length; offset += 20) {
        const batch = missing.slice(offset, offset + 20);
        const body = await api(`/items?ids=${encodeURIComponent(batch.map((card) => card.id).join(","))}`, accessTokens, statuses);
        const rows = Array.isArray(body) ? body : [];
        const byId = new Map<string, ApiItem>();
        for (const entry of rows) {
          const row = entry && typeof entry === "object" && "body" in entry ? (entry as { body?: ApiItem }).body : entry as ApiItem;
          if (row?.id) byId.set(row.id.replace("-", ""), row);
        }
        for (const card of batch) {
          const verified = byId.get(card.id);
          result.push(verified ? apiToItem(verified, card)! : baseItem(card.id, card.title, card.price_cents, card.permalink, card.thumbnail, false));
          if (result.length >= desired) break;
        }
        if (result.length >= desired) break;
      }
    }
  }

  const items = Array.from(new Map(result.map((item) => [item.id, item])).values())
    .filter((item) => /^MLB\d+$/.test(item.id) && relevant(query, item.title))
    .sort((a, b) => relevanceScore(query, b.title) - relevanceScore(query, a.title))
    .slice(0, desired);

  const reason = official.length
    ? `Busca realizada nos anúncios do marketplace do Mercado Livre. ${items.length} resultado(s) compatível(is) retornado(s); vendas só são exibidas quando confirmadas pela API.`
    : items.length
      ? "A busca oficial de itens não respondeu para este termo; foram usados anúncios encontrados na página pública do Mercado Livre. Vendas só aparecem quando confirmadas pela API."
      : publicSearchStatus === 403
        ? "O Mercado Livre não liberou resultados da busca de itens nem a leitura da página pública para este termo. Tente novamente, use um link/ID MLB ou abra a busca diretamente no Mercado Livre."
        : "Nenhum anúncio do marketplace compatível foi recuperado para este termo.";

  console.info("[ML public discovery summary]", {
    strategy: "site_items_search_then_public_url",
    query_slug: normalizeSearchTerm(query),
    official_items: official.length,
    public_candidates: publicCandidates,
    final_results: items.length,
  });

  return {
    ok: items.length > 0,
    reason,
    items,
    diagnostics: { statuses, products: 0, offers: 0, publicSearchStatus, publicCandidates },
  };
}
