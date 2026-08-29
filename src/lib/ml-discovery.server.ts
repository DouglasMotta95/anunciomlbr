import type { SearchMlItem } from "@/lib/ml-search-production.functions";

/**
 * Busca de anúncios públicos reais do Mercado Livre.
 * Não altera UI/layout. A palavra digitada é convertida nas mesmas URLs públicas
 * usadas pelo marketplace e os links MLB encontrados são transformados em itens.
 */
const ML_API = "https://api.mercadolibre.com";
const ML_LIST = "https://lista.mercadolivre.com.br";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type PublicCard = { id: string; title: string; price_cents: number | null; permalink: string | null; thumbnail: string | null };
type ApiItem = { id?: string; title?: string; price?: number; permalink?: string; thumbnail?: string; category_id?: string; seller_id?: string | number; condition?: string; available_quantity?: number; sold_quantity?: number; status?: string; pictures?: Array<{ secure_url?: string; url?: string }>; attributes?: unknown[] };
type Product = { id?: string; name?: string; pictures?: Array<{ secure_url?: string; url?: string }>; attributes?: unknown[] };
type Offer = { item_id?: string; seller_id?: string | number; price?: number; category_id?: string; condition?: string; available_quantity?: number; sold_quantity?: number; status?: string };

export type DiscoveryOutcome = {
  ok: boolean;
  reason: string | null;
  items: SearchMlItem[];
  diagnostics: { statuses: number[]; products: number; offers: number; publicSearchStatus: number | "network_error" | null; publicCandidates: number };
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slug(value: string) { return normalize(value).replace(/\s+/g, "-"); }
const STOP = new Set(["de", "da", "do", "das", "dos", "com", "para", "por", "e", "em", "o", "a"]);
function words(value: string) { return normalize(value).split(" ").filter((x) => x.length >= 2 && !STOP.has(x)); }

export function relevanceScore(query: string, title: string) {
  const q = normalize(query); const t = normalize(title);
  if (!q || !t) return 0;
  if (t.includes(q)) return 100;
  const w = words(query); if (!w.length) return 0;
  return Math.round((w.filter((x) => t.includes(x)).length / w.length) * 100);
}
function relevant(query: string, title: string) { return relevanceScore(query, title) >= (words(query).length <= 1 ? 100 : 60); }

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}
function strip(value: string) { return decode(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()); }
function webUrl(value?: string | null) {
  if (!value) return null; const v = decode(value);
  if (v.startsWith("//")) return `https:${v}`;
  if (v.startsWith("http://")) return `https://${v.slice(7)}`;
  return v.startsWith("https://") ? v : null;
}
function itemId(value?: string | null) {
  if (!value) return null;
  const m = decode(value).toUpperCase().match(/MLB[-_ ]?(\d{6,})/);
  return m ? `MLB${m[1]}` : null;
}
function priceCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value * 100);
  if (typeof value !== "string") return null;
  const raw = strip(value).replace(/R\$/gi, "").replace(/\s/g, "");
  const normalized = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw) ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const n = Number(normalized); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function jsonLdCards(html: string, query: string) {
  const out: PublicCard[] = [];
  const visit = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach(visit); return; }
    const row = v as Record<string, unknown>;
    const obj = (row.item && typeof row.item === "object" ? row.item : row) as Record<string, unknown>;
    const url = webUrl(typeof obj.url === "string" ? obj.url : typeof row.url === "string" ? row.url : null);
    const id = itemId(url) ?? itemId(typeof obj.sku === "string" ? obj.sku : null) ?? itemId(typeof obj.productID === "string" ? obj.productID : null);
    const title = typeof obj.name === "string" ? obj.name.trim() : "";
    const offers = obj.offers && typeof obj.offers === "object" ? obj.offers as Record<string, unknown> : null;
    const image = Array.isArray(obj.image) ? obj.image[0] : obj.image;
    if (id && title && relevant(query, title)) out.push({ id, title, price_cents: priceCents(offers?.price), permalink: url, thumbnail: webUrl(typeof image === "string" ? image : null) });
    Object.values(row).forEach(visit);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(decode(m[1] ?? ""))); } catch {}
  }
  return out;
}

function htmlCards(html: string, query: string) {
  const out: PublicCard[] = [];
  // Captura cada link público de produto, sem depender da estrutura CSS atual do ML.
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = webUrl(m[1]); const id = itemId(href) ?? itemId(m[0]);
    if (!href || !id) continue;
    const block = m[0];
    const titleAttr = block.match(/(?:title|aria-label)=["']([^"']{3,220})["']/i)?.[1];
    const titleNode = block.match(/class=["'][^"']*(?:ui-search-item__title|poly-component__title)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1];
    const title = strip(titleAttr ?? titleNode ?? m[2] ?? "").slice(0, 220);
    if (!title || !relevant(query, title)) continue;
    const fraction = block.match(/andes-money-amount__fraction[^>]*>([^<]+)/i)?.[1];
    const image = block.match(/(?:data-src|src)=["'](https?:\/\/[^"']+)["']/i)?.[1];
    out.push({ id, title, price_cents: priceCents(fraction ?? null), permalink: href, thumbnail: webUrl(image) });
  }
  // Fallback: procura MLBs no HTML e usa o contexto próximo para recuperar título/link.
  for (const m of html.matchAll(/MLB[-_ ]?\d{6,}/gi)) {
    const id = itemId(m[0]); if (!id) continue;
    const start = Math.max(0, (m.index ?? 0) - 1200); const end = Math.min(html.length, (m.index ?? 0) + 1800);
    const context = html.slice(start, end);
    const href = webUrl(context.match(/href=["']([^"']*MLB[^"']+)["']/i)?.[1] ?? null);
    const title = strip(context.match(/(?:title|aria-label)=["']([^"']{3,220})["']/i)?.[1] ?? context.match(/(?:ui-search-item__title|poly-component__title)[^>]*>([^<]+)/i)?.[1] ?? "").slice(0, 220);
    if (title && relevant(query, title)) out.push({ id, title, price_cents: priceCents(context.match(/andes-money-amount__fraction[^>]*>([^<]+)/i)?.[1] ?? null), permalink: href, thumbnail: webUrl(context.match(/(?:data-src|src)=["'](https?:\/\/[^"']+)["']/i)?.[1] ?? null) });
  }
  return out;
}

async function publicSearch(query: string, desired: number) {
  const s = slug(query); if (!s) return { status: null as number | "network_error" | null, cards: [] as PublicCard[] };
  // O ML indexa mais de uma forma de URL. Tentamos as URLs públicas reais, sem bypass anti-bot.
  const urls = [`${ML_LIST}/${s}`, `${ML_LIST}/comprar-${s}`];
  let last: number | "network_error" | null = null;
  const all: PublicCard[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": WEB_UA } });
      last = res.status; console.info("[ML public marketplace]", { endpoint: url, status: res.status });
      if (!res.ok) continue;
      const html = await res.text(); all.push(...jsonLdCards(html, query), ...htmlCards(html, query));
      if (all.length >= desired) break;
    } catch { last = "network_error"; console.info("[ML public marketplace]", { endpoint: url, status: "network_error" }); }
  }
  const cards = Array.from(new Map(all.map((x) => [x.id, x])).values()).sort((a,b) => relevanceScore(query,b.title)-relevanceScore(query,a.title)).slice(0, Math.max(desired, 40));
  return { status: last, cards };
}

async function tokens(userId: string) {
  const { getAppAccessToken, getValidMlAccessToken } = await import("@/lib/ml.server");
  const out: string[] = [];
  try { const u = await getValidMlAccessToken(userId); if (u.ok && u.accessToken) out.push(u.accessToken); } catch {}
  try { const a = await getAppAccessToken(); if (a && !out.includes(a)) out.push(a); } catch {}
  return out;
}
async function api(path: string, ts: string[], statuses: number[]) {
  for (const token of [...ts, ""]) {
    try {
      const res = await fetch(`${ML_API}${path}`, { headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      statuses.push(res.status); const body = await res.json().catch(() => null);
      console.info("[ML public discovery]", { endpoint: path, status: res.status, token_type: token ? "authenticated" : "anonymous" });
      if (res.ok) return body; if (![401,403].includes(res.status)) break;
    } catch {}
  }
  return null;
}
function baseItem(id: string, title: string, price: number | null, permalink: string | null, thumbnail: string | null, source: "marketplace" | "catalog_offer", verified: boolean): SearchMlItem {
  return { id, title, price_cents: price, thumbnail, permalink, category: null, seller: null, condition: null, available_quantity: null, sold_quantity: null, status: "active", images: thumbnail ? [thumbnail] : [], attributes: [], source_kind: source, seller_id: null, verified_item: verified };
}
function apiToItem(row: ApiItem, fallback?: PublicCard): SearchMlItem | null {
  const id = itemId(row.id) ?? fallback?.id ?? null; const title = row.title?.trim() || fallback?.title || ""; if (!id || !title) return null;
  const thumb = webUrl(row.thumbnail) ?? fallback?.thumbnail ?? null;
  return { id, title, price_cents: priceCents(row.price) ?? fallback?.price_cents ?? null, thumbnail: thumb, permalink: webUrl(row.permalink) ?? fallback?.permalink ?? null, category: row.category_id ?? null, seller: null, condition: row.condition ?? null, available_quantity: row.available_quantity ?? null, sold_quantity: row.sold_quantity ?? null, status: row.status ?? "active", images: (row.pictures ?? []).map(x => webUrl(x.secure_url ?? x.url)).filter((x): x is string => !!x), attributes: [], source_kind: "marketplace", seller_id: row.seller_id != null ? String(row.seller_id) : null, verified_item: true };
}

export async function discoverPublicAds(userId: string, query: string, desired = 20): Promise<DiscoveryOutcome> {
  const statuses: number[] = []; const ts = await tokens(userId); const pub = await publicSearch(query, desired);
  const result: SearchMlItem[] = [];
  if (pub.cards.length) {
    for (let i=0; i<pub.cards.length; i+=20) {
      const batch = pub.cards.slice(i,i+20); const ids = batch.map(x=>x.id).join(",");
      const body = await api(`/items?ids=${encodeURIComponent(ids)}`, ts, statuses);
      const rows = Array.isArray(body) ? body : [];
      const byId = new Map<string, ApiItem>();
      for (const entry of rows) { const row = entry && typeof entry === "object" && "body" in entry ? (entry as {body?:ApiItem}).body : entry as ApiItem; if (row?.id) byId.set(row.id.replace("-", ""), row); }
      for (const card of batch) result.push(apiToItem(byId.get(card.id) ?? {}, card) ?? baseItem(card.id, card.title, card.price_cents, card.permalink, card.thumbnail, "marketplace", false));
    }
  }

  let productCount = 0; let offerCount = 0;
  // Fallback oficial: catálogo serve apenas de índice para chegar a ofertas MLB reais.
  if (result.length < desired) {
    const pbody = await api(`/products/search?status=active&site_id=MLB&q=${encodeURIComponent(query)}&limit=20`, ts, statuses) as { results?: Product[] } | null;
    const products = Array.isArray(pbody?.results) ? pbody!.results! : []; productCount = products.length;
    for (const product of products) {
      if (!product.id || !product.name || !relevant(query, product.name)) continue;
      const obody = await api(`/products/${encodeURIComponent(product.id)}/items`, ts, statuses) as { results?: Offer[] } | Offer[] | null;
      const offers = Array.isArray(obody) ? obody : Array.isArray((obody as {results?:Offer[]})?.results) ? (obody as {results:Offer[]}).results : [];
      offerCount += offers.length;
      const picture = webUrl(product.pictures?.[0]?.secure_url ?? product.pictures?.[0]?.url ?? null);
      for (const offer of offers) {
        const id = itemId(offer.item_id); if (!id || result.some(x=>x.id===id)) continue;
        const item = baseItem(id, product.name, priceCents(offer.price), `https://produto.mercadolivre.com.br/MLB-${id.slice(3)}`, picture, "catalog_offer", true);
        item.seller_id = offer.seller_id != null ? String(offer.seller_id) : null; item.category = offer.category_id ?? null; item.condition = offer.condition ?? null; item.available_quantity = offer.available_quantity ?? null; item.sold_quantity = offer.sold_quantity ?? null; item.status = offer.status ?? "active";
        result.push(item); if (result.length >= desired) break;
      }
      if (result.length >= desired) break;
    }
  }
  const items = result.filter(x => relevant(query, x.title)).sort((a,b)=>relevanceScore(query,b.title)-relevanceScore(query,a.title)).slice(0, desired);
  const reason = items.length ? "Anúncios reais encontrados a partir dos links públicos do Mercado Livre e enriquecidos pela API quando disponível." : pub.status === 403 ? "O Mercado Livre bloqueou a leitura da página pública pelo servidor e a API oficial não retornou ofertas compatíveis para este termo." : "Nenhum anúncio público compatível foi recuperado para este termo.";
  return { ok: items.length > 0, reason, items, diagnostics: { statuses, products: productCount, offers: offerCount, publicSearchStatus: pub.status, publicCandidates: pub.cards.length } };
}
