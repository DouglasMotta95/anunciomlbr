import type { SearchMlItem } from "@/lib/ml-search-production.functions";
import { normalizeItemId, normalizeSearchTerm, normalizeSearchText } from "@/lib/ml-search-input";

const ML_API = "https://api.mercadolibre.com";
export const ML_PUBLIC_SEARCH_BASE = "https://lista.mercadolivre.com.br/";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type PublicCard = { id: string; title: string; permalink: string | null };
type ApiItem = {
  id?: string;
  site_id?: string;
  title?: string;
  price?: number;
  permalink?: string;
  thumbnail?: string;
  category_id?: string;
  seller_id?: string | number;
  condition?: string;
  available_quantity?: number;
  sold_quantity?: number;
  status?: string;
  pictures?: Array<{ secure_url?: string; url?: string }>;
};
type SiteSearchBody = { results?: ApiItem[] };
type Candidate = { id: string; permalink?: string | null };

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

const STOP = new Set(["de", "da", "do", "das", "dos", "com", "para", "por", "e", "em", "o", "a"]);
function words(value: string) {
  return normalizeSearchText(value).split(" ").filter((word) => word.length >= 2 && !STOP.has(word));
}

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
function relevant(query: string, title: string) {
  return relevanceScore(query, title) >= (words(query).length <= 1 ? 100 : 60);
}

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}
function strip(value: string) {
  return decode(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}
function webUrl(value?: string | null) {
  if (!value) return null;
  const normalized = decode(value);
  if (normalized.startsWith("//")) return `https:${normalized}`;
  if (normalized.startsWith("http://")) return `https://${normalized.slice(7)}`;
  return normalized.startsWith("https://") ? normalized : null;
}
function itemId(value?: string | null) {
  return value ? normalizeItemId(decode(value)) : null;
}
function priceCents(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}
function isMercadoLivrePermalink(value?: string | null) {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br") || host === "mercadolivre.com" || host.endsWith(".mercadolivre.com");
  } catch {
    return false;
  }
}

/** Evidência de anúncio: o MLB precisa estar no pathname da própria URL real do ML. */
export function itemIdFromRealMlUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!isMercadoLivrePermalink(url.toString())) return null;
    const id = normalizeItemId(url.pathname);
    return id && /^MLB\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function cleanRealMlPermalink(value?: string | null) {
  const url = webUrl(value);
  if (!url || !itemIdFromRealMlUrl(url)) return null;
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function jsonLdCards(html: string, query: string) {
  const cards: PublicCard[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const row = value as Record<string, unknown>;
    const rowItem = row["item"];
    const obj = (rowItem && typeof rowItem === "object" ? rowItem : row) as Record<string, unknown>;
    const url = cleanRealMlPermalink(typeof obj["url"] === "string" ? obj["url"] : typeof row["url"] === "string" ? row["url"] : null);
    const id = itemIdFromRealMlUrl(url);
    const title = typeof obj["name"] === "string" ? obj["name"].trim() : "";
    if (id && url && title && relevant(query, title)) cards.push({ id, title, permalink: url });
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
    const href = cleanRealMlPermalink(match[1]);
    const id = itemIdFromRealMlUrl(href);
    if (!href || !id) continue;
    const block = match[0];
    const titleAttr = block.match(/(?:title|aria-label)=["']([^"']{3,220})["']/i)?.[1];
    const titleNode = block.match(/class=["'][^"']*(?:ui-search-item__title|poly-component__title)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1];
    const title = strip(titleAttr ?? titleNode ?? match[2] ?? "").slice(0, 220);
    if (title && relevant(query, title)) cards.push({ id, title, permalink: href });
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
  try {
    const user = await getValidMlAccessToken(userId);
    if (user.ok && user.accessToken) result.push(user.accessToken);
  } catch {}
  try {
    const app = await getAppAccessToken();
    if (app && !result.includes(app)) result.push(app);
  } catch {}
  return result;
}

async function api(path: string, accessTokens: string[], statuses: number[]) {
  for (const token of [...accessTokens, ""]) {
    try {
      const response = await fetch(`${ML_API}${path}`, {
        headers: { Accept: "application/json", "User-Agent": "ANUNCIO-ML/1.0", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: AbortSignal.timeout(15_000),
      });
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

function apiToItem(row: ApiItem, fallbackPermalink?: string | null): SearchMlItem | null {
  const id = itemId(row.id);
  const title = row.title?.trim() ?? "";
  const permalink = cleanRealMlPermalink(row.permalink) ?? cleanRealMlPermalink(fallbackPermalink);
  const permalinkId = itemIdFromRealMlUrl(permalink);
  const price = priceCents(row.price);
  if (!id || !/^MLB\d+$/.test(id) || permalinkId !== id || row.site_id && row.site_id !== "MLB" || !title || !price || !permalink) return null;
  if (row.status && row.status !== "active") return null;
  const thumbnail = webUrl(row.thumbnail);
  const images = (row.pictures ?? []).map((picture) => webUrl(picture.secure_url ?? picture.url)).filter((value): value is string => !!value);
  return {
    id,
    title,
    price_cents: price,
    thumbnail,
    permalink,
    category: row.category_id ?? null,
    seller: null,
    condition: row.condition ?? null,
    available_quantity: row.available_quantity ?? null,
    sold_quantity: typeof row.sold_quantity === "number" ? row.sold_quantity : null,
    status: "active",
    images: images.length ? images : thumbnail ? [thumbnail] : [],
    attributes: [],
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

async function verifyCandidates(query: string, candidates: Candidate[], accessTokens: string[], statuses: number[]) {
  const verified: SearchMlItem[] = [];
  const unique = Array.from(new Map(candidates
    .filter((candidate) => itemIdFromRealMlUrl(candidate.permalink) === candidate.id)
    .map((candidate) => [candidate.id, candidate])).values());
  for (let offset = 0; offset < unique.length; offset += 20) {
    const batch = unique.slice(offset, offset + 20);
    const body = await api(`/items?ids=${encodeURIComponent(batch.map((candidate) => candidate.id).join(","))}`, accessTokens, statuses);
    const rows = Array.isArray(body) ? body : [];
    const fallbackById = new Map(batch.map((candidate) => [candidate.id, candidate.permalink ?? null]));
    for (const entry of rows) {
      const row = entry && typeof entry === "object" && "body" in entry ? (entry as { body?: ApiItem }).body : entry as ApiItem;
      if (!row) continue;
      const id = itemId(row.id);
      const item = apiToItem(row, id ? fallbackById.get(id) ?? null : null);
      if (item && relevant(query, item.title)) verified.push(item);
    }
  }
  return verified;
}

async function publicSearch(query: string, desired: number) {
  let status: number | "network_error" | null = null;
  const all: PublicCard[] = [];
  for (const url of buildPublicSearchUrls(query)) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": WEB_UA },
        signal: AbortSignal.timeout(15_000),
      });
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
    cards: Array.from(new Map(all.map((card) => [card.id, card])).values()).slice(0, desired),
  };
}

export async function discoverPublicAds(userId: string, query: string, desired = 20): Promise<DiscoveryOutcome> {
  const statuses: number[] = [];
  const accessTokens = await tokens(userId);
  const official = await marketplaceApiSearch(query, desired, accessTokens, statuses);
  const result: SearchMlItem[] = [...official];
  let googleCandidates = 0;
  let publicSearchStatus: number | "network_error" | null = null;
  let publicCandidates = 0;

  if (result.length < desired) {
    const { discoverMlItemLinksWithGoogle } = await import("@/lib/ml-google-discovery.server");
    const grounded = await discoverMlItemLinksWithGoogle(query, Math.min(50, Math.max(desired * 2, 20)));
    googleCandidates = grounded.length;
    const googleVerified = await verifyCandidates(query, grounded.map((candidate) => ({ id: candidate.id, permalink: candidate.url })), accessTokens, statuses);
    result.push(...googleVerified.filter((item) => !result.some((existing) => existing.id === item.id)));
  }

  if (result.length < desired) {
    const pub = await publicSearch(query, Math.min(50, Math.max(desired * 2, 20)));
    publicSearchStatus = pub.status;
    publicCandidates = pub.cards.length;
    const publicVerified = await verifyCandidates(query, pub.cards.map((card) => ({ id: card.id, permalink: card.permalink })), accessTokens, statuses);
    result.push(...publicVerified.filter((item) => !result.some((existing) => existing.id === item.id)));
  }

  const items = Array.from(new Map(result.map((item) => [item.id, item])).values())
    .filter((item) => item.verified_item === true && item.status === "active" && item.price_cents != null && item.price_cents > 0 && !!item.permalink && itemIdFromRealMlUrl(item.permalink) === item.id && relevant(query, item.title))
    .sort((a, b) => relevanceScore(query, b.title) - relevanceScore(query, a.title))
    .slice(0, desired);

  const reason = items.length
    ? `${items.length} anúncio(s) real(is) e ativo(s) confirmado(s). A busca nunca completa a lista com catálogo ou anúncios não validados.`
    : statuses.includes(403)
      ? "O Mercado Livre bloqueou a confirmação dos itens para esta busca. Para não mostrar anúncios falsos, o ANÚNCIO ML não exibe candidatos que não conseguiu validar."
      : "Nenhum anúncio ativo e validado do Mercado Livre foi encontrado para este termo.";

  console.info("[ML public discovery summary]", {
    strategy: "strict_verified_marketplace_items",
    query_slug: normalizeSearchTerm(query),
    official_items: official.length,
    google_candidates: googleCandidates,
    public_candidates: publicCandidates,
    final_verified_results: items.length,
  });

  return {
    ok: items.length > 0,
    reason,
    items,
    diagnostics: { statuses, products: 0, offers: 0, publicSearchStatus, publicCandidates: publicCandidates + googleCandidates },
  };
}
