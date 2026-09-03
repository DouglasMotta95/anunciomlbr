import type { SearchMlItem } from "@/lib/ml-search-production.functions";
import { normalizeSearchTerm, normalizeSearchText } from "@/lib/ml-search-input";
import { itemIdFromRealMlUrl } from "@/lib/ml-discovery.server";

const PUBLIC_SEARCH_BASE = "https://lista.mercadolivre.com.br/";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}
function stripHtml(value: string) { return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()); }
function cleanMlPermalink(value: string | null | undefined) {
  if (!value) return null;
  try {
    const raw = decodeHtml(value);
    const normalized = raw.startsWith("//") ? `https:${raw}` : raw.startsWith("http://") ? `https://${raw.slice(7)}` : raw;
    const url = new URL(normalized);
    const id = itemIdFromRealMlUrl(url.toString());
    if (!id) return null;
    url.search = ""; url.hash = "";
    return { id, url: url.toString() };
  } catch { return null; }
}
function relevant(query: string, title: string) {
  const q = normalizeSearchText(query), t = normalizeSearchText(title);
  if (!q || !t) return false;
  if (t.includes(q)) return true;
  const terms = q.split(" ").filter((term) => term.length >= 2);
  return terms.length > 0 && terms.filter((term) => t.includes(term)).length / terms.length >= 0.6;
}
function findCardBlock(html: string, anchorIndex: number) {
  const liStart = html.lastIndexOf("<li", anchorIndex), liEnd = html.indexOf("</li>", anchorIndex);
  if (liStart >= 0 && liEnd > anchorIndex && anchorIndex - liStart < 12000 && liEnd - anchorIndex < 16000) return html.slice(liStart, liEnd + 5);
  return html.slice(Math.max(0, anchorIndex - 3500), Math.min(html.length, anchorIndex + 6500));
}
function extractTitle(block: string, anchorHtml: string) {
  const candidates = [block.match(/class=["'][^"']*(?:poly-component__title|ui-search-item__title)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1], anchorHtml.match(/(?:title|aria-label)=["']([^"']{3,240})["']/i)?.[1], anchorHtml.replace(/^<a\b[^>]*>/i, "").replace(/<\/a>$/i, "")];
  for (const candidate of candidates) { const title = candidate ? stripHtml(candidate).slice(0, 220) : ""; if (title.length >= 3) return title; }
  return "";
}
function extractPriceCents(block: string) {
  const meta = block.match(/itemprop=["']price["'][^>]*content=["']([0-9]+(?:[.,][0-9]{1,2})?)["']/i)?.[1] ?? block.match(/content=["']([0-9]+(?:[.,][0-9]{1,2})?)["'][^>]*itemprop=["']price["']/i)?.[1];
  if (meta) { const value = Number(meta.replace(",", ".")); if (Number.isFinite(value) && value > 0) return Math.round(value * 100); }
  const fraction = block.match(/class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>([^<]+)</i)?.[1];
  if (!fraction) return null;
  const integer = Number(stripHtml(fraction).replace(/\D/g, "")); if (!Number.isFinite(integer) || integer <= 0) return null;
  const centsText = block.match(/class=["'][^"']*andes-money-amount__cents[^"']*["'][^>]*>([^<]+)</i)?.[1];
  const cents = centsText ? Number(stripHtml(centsText).replace(/\D/g, "").slice(0, 2).padEnd(2, "0")) : 0;
  return integer * 100 + (Number.isFinite(cents) ? cents : 0);
}
function extractSeller(block: string) {
  const candidates = [block.match(/class=["'][^"']*(?:poly-component__seller|ui-search-official-store-label|ui-search-item__group__element--seller)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1], block.match(/(?:Vendido por|Por)\s*<[^>]*>([^<]{2,120})</i)?.[1], block.match(/(?:Vendido por|Por)\s+([^<\n]{2,120})/i)?.[1]];
  for (const candidate of candidates) { const seller = candidate ? stripHtml(candidate).replace(/^(?:vendido\s+por|por)\s*/i, "").trim().slice(0, 120) : ""; if (seller.length >= 2) return seller; }
  return null;
}
function extractThumbnail(block: string) {
  const match = block.match(/<img\b[^>]*(?:data-src|src)=["']([^"']+)["'][^>]*>/i)?.[1]; if (!match) return null;
  const decoded = decodeHtml(match); if (decoded.startsWith("//")) return `https:${decoded}`; if (decoded.startsWith("http://")) return `https://${decoded.slice(7)}`; return decoded.startsWith("https://") ? decoded : null;
}
function isCatalogOffer(block: string) { return /(?:catalog[_-]?offer|oferta\s+de\s+cat[aá]logo|poly-[^"']*catalog|buybox)/i.test(block); }

export function extractPublicSiteSearchItems(html: string, query: string, limit = 20): SearchMlItem[] {
  const items = new Map<string, SearchMlItem>();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    if (items.size >= limit) break;
    const permalink = cleanMlPermalink(match[1]); if (!permalink || items.has(permalink.id)) continue;
    const block = findCardBlock(html, match.index ?? 0), title = extractTitle(block, match[0]);
    if (!title || !relevant(query, title)) continue;
    const price_cents = extractPriceCents(block); if (price_cents == null) continue;
    const thumbnail = extractThumbnail(block), catalog = isCatalogOffer(block);
    items.set(permalink.id, { id: permalink.id, title, price_cents, thumbnail, permalink: permalink.url, category: null, seller: extractSeller(block), condition: null, available_quantity: null, sold_quantity: null, status: null, images: thumbnail ? [thumbnail] : [], attributes: [], source_kind: catalog ? "catalog_offer" : "marketplace", seller_id: null, verified_item: false });
  }
  return Array.from(items.values()).slice(0, limit);
}

export async function searchMercadoLivrePublicSiteFallback(query: string, limit = 20) {
  const slug = normalizeSearchTerm(query).toLowerCase();
  if (!slug) return { items: [] as SearchMlItem[], status: null as number | "network_error" | null, url: null as string | null };
  const url = `${PUBLIC_SEARCH_BASE}${slug}`;
  try {
    const response = await fetch(url, { redirect: "follow", headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": WEB_UA }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return { items: [] as SearchMlItem[], status: response.status, url };
    const html = await response.text();
    console.info("[ML public fallback html]", JSON.stringify({ url, final_url: response.url, status: response.status, html_length: html.length, html_preview: html.slice(0, 500) }));
    return { items: extractPublicSiteSearchItems(html, query, limit), status: response.status, url };
  } catch { return { items: [] as SearchMlItem[], status: "network_error" as const, url }; }
}
