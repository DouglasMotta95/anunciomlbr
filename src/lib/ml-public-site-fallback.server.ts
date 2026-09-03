import type { SearchMlItem } from "@/lib/ml-search-production.functions";
import { normalizeSearchTerm, normalizeSearchText } from "@/lib/ml-search-input";
import { itemIdFromRealMlUrl } from "@/lib/ml-discovery.server";

const PUBLIC_SEARCH_BASE = "https://lista.mercadolivre.com.br/";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type StructuredCandidate = {
  url?: string | null;
  title?: string | null;
  price?: unknown;
  seller?: string | null;
  thumbnail?: string | null;
  catalog?: boolean;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&#0?39;|&#x27;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\\//g, "/");
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function cleanMlPermalink(value: string | null | undefined) {
  if (!value) return null;
  try {
    const raw = decodeHtml(value).trim();
    const normalized = raw.startsWith("//") ? `https:${raw}` : raw.startsWith("http://") ? `https://${raw.slice(7)}` : raw;
    const url = new URL(normalized);
    const id = itemIdFromRealMlUrl(url.toString());
    if (!id) return null;
    url.search = "";
    url.hash = "";
    return { id, url: url.toString() };
  } catch {
    return null;
  }
}

function relevant(query: string, title: string) {
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(title);
  if (!q || !t) return false;
  if (t.includes(q)) return true;
  const terms = q.split(" ").filter((term) => term.length >= 2);
  return terms.length > 0 && terms.filter((term) => t.includes(term)).length / terms.length >= 0.6;
}

function findCardBlock(html: string, anchorIndex: number) {
  const liStart = html.lastIndexOf("<li", anchorIndex);
  const liEnd = html.indexOf("</li>", anchorIndex);
  if (liStart >= 0 && liEnd > anchorIndex && anchorIndex - liStart < 20_000 && liEnd - anchorIndex < 30_000) {
    return html.slice(liStart, liEnd + 5);
  }

  const articleStart = html.lastIndexOf("<article", anchorIndex);
  const articleEnd = html.indexOf("</article>", anchorIndex);
  if (articleStart >= 0 && articleEnd > anchorIndex && anchorIndex - articleStart < 20_000 && articleEnd - anchorIndex < 30_000) {
    return html.slice(articleStart, articleEnd + 10);
  }

  return html.slice(Math.max(0, anchorIndex - 6_000), Math.min(html.length, anchorIndex + 12_000));
}

function extractTitle(block: string, anchorHtml: string) {
  const candidates = [
    block.match(/class=["'][^"']*(?:poly-component__title|ui-search-item__title|poly-component__title-wrapper)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
    block.match(/data-testid=["'](?:product-title|item-title)["'][^>]*>([\s\S]*?)<\//i)?.[1],
    block.match(/<h[123]\b[^>]*>([\s\S]*?)<\/h[123]>/i)?.[1],
    anchorHtml.match(/(?:title|aria-label)=["']([^"']{3,240})["']/i)?.[1],
    anchorHtml.replace(/^<a\b[^>]*>/i, "").replace(/<\/a>$/i, ""),
  ];
  for (const candidate of candidates) {
    const title = candidate ? stripHtml(candidate).slice(0, 220) : "";
    if (title.length >= 3) return title;
  }
  return "";
}

function numericPriceToCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value * 100);
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!normalized) return null;
  const parsed = normalized.includes(",")
    ? Number(normalized.replace(/\./g, "").replace(",", "."))
    : Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

function extractPriceCents(block: string) {
  const meta =
    block.match(/itemprop=["']price["'][^>]*content=["']([0-9]+(?:[.,][0-9]{1,2})?)["']/i)?.[1] ??
    block.match(/content=["']([0-9]+(?:[.,][0-9]{1,2})?)["'][^>]*itemprop=["']price["']/i)?.[1];
  if (meta) {
    const cents = numericPriceToCents(meta);
    if (cents != null) return cents;
  }

  const fraction = block.match(/class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>([^<]+)</i)?.[1];
  if (fraction) {
    const integer = Number(stripHtml(fraction).replace(/\D/g, ""));
    if (Number.isFinite(integer) && integer > 0) {
      const centsText = block.match(/class=["'][^"']*andes-money-amount__cents[^"']*["'][^>]*>([^<]+)</i)?.[1];
      const cents = centsText ? Number(stripHtml(centsText).replace(/\D/g, "").slice(0, 2).padEnd(2, "0")) : 0;
      return integer * 100 + (Number.isFinite(cents) ? cents : 0);
    }
  }

  const visible = block.match(/R\$\s*([\d.]+(?:,\d{2})?)/i)?.[1];
  return visible ? numericPriceToCents(visible) : null;
}

function extractSeller(block: string) {
  const candidates = [
    block.match(/class=["'][^"']*(?:poly-component__seller|ui-search-official-store-label|ui-search-item__group__element--seller|poly-component__seller__name)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
    block.match(/(?:Vendido por|Por)\s*<[^>]*>([^<]{2,120})</i)?.[1],
    block.match(/(?:Vendido por|Por)\s+([^<\n]{2,120})/i)?.[1],
  ];
  for (const candidate of candidates) {
    const seller = candidate ? stripHtml(candidate).replace(/^(?:vendido\s+por|por)\s*/i, "").trim().slice(0, 120) : "";
    if (seller.length >= 2) return seller;
  }
  return null;
}

function normalizeImage(value: string | null | undefined) {
  if (!value) return null;
  const decoded = decodeHtml(value).trim();
  if (decoded.startsWith("//")) return `https:${decoded}`;
  if (decoded.startsWith("http://")) return `https://${decoded.slice(7)}`;
  return decoded.startsWith("https://") ? decoded : null;
}

function extractThumbnail(block: string) {
  const match = block.match(/<img\b[^>]*(?:data-src|data-lazy-src|src)=["']([^"']+)["'][^>]*>/i)?.[1];
  return normalizeImage(match);
}

function isCatalogOffer(block: string) {
  return /(?:catalog[_-]?offer|oferta\s+de\s+cat[aá]logo|poly-[^"']*catalog|buybox)/i.test(block);
}

function toSearchItem(candidate: StructuredCandidate): SearchMlItem | null {
  const permalink = cleanMlPermalink(candidate.url);
  const title = stripHtml(candidate.title ?? "").slice(0, 220);
  if (!permalink || title.length < 3) return null;
  const thumbnail = normalizeImage(candidate.thumbnail);
  return {
    id: permalink.id,
    title,
    price_cents: priceFromUnknown(candidate.price),
    thumbnail,
    permalink: permalink.url,
    category: null,
    seller: candidate.seller ? stripHtml(candidate.seller).slice(0, 120) : null,
    condition: null,
    available_quantity: null,
    sold_quantity: null,
    status: null,
    images: thumbnail ? [thumbnail] : [],
    attributes: [],
    source_kind: candidate.catalog ? "catalog_offer" : "marketplace",
    seller_id: null,
    verified_item: false,
  };
}

function priceFromUnknown(value: unknown): number | null {
  const direct = numericPriceToCents(value);
  if (direct != null) return direct;
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  for (const key of ["amount", "value", "price", "current_price", "currentPrice"]) {
    const parsed = numericPriceToCents(row[key]);
    if (parsed != null) return parsed;
    if (row[key] && typeof row[key] === "object") {
      const nested = priceFromUnknown(row[key]);
      if (nested != null) return nested;
    }
  }
  return null;
}

function stringField(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (typeof row[key] === "string" && (row[key] as string).trim()) return (row[key] as string).trim();
  return null;
}

function structuredCandidatesFromJson(value: unknown): StructuredCandidate[] {
  const found: StructuredCandidate[] = [];
  const seen = new Set<object>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const row = node as Record<string, unknown>;
    const url = stringField(row, ["permalink", "url", "link", "item_url", "itemUrl"]);
    const title = stringField(row, ["title", "name", "item_title", "itemTitle"]);
    if (url && title && cleanMlPermalink(url)) {
      const sellerValue = row["seller"];
      const seller =
        typeof sellerValue === "string"
          ? sellerValue
          : sellerValue && typeof sellerValue === "object"
            ? stringField(sellerValue as Record<string, unknown>, ["nickname", "name", "title"])
            : stringField(row, ["seller_name", "sellerName"]);
      const thumbnailValue = row["thumbnail"] ?? row["image"] ?? row["picture"];
      const thumbnail =
        typeof thumbnailValue === "string"
          ? thumbnailValue
          : thumbnailValue && typeof thumbnailValue === "object"
            ? stringField(thumbnailValue as Record<string, unknown>, ["url", "secure_url", "src"])
            : null;
      found.push({
        url,
        title,
        price: row["price"] ?? row["current_price"] ?? row["currentPrice"] ?? row["amount"],
        seller,
        thumbnail,
        catalog: Boolean(row["catalog_listing"] ?? row["catalogListing"] ?? row["is_catalog"]),
      });
    }
    Object.values(row).forEach(visit);
  };
  visit(value);
  return found;
}

function extractStructuredItems(html: string, query: string, limit: number) {
  const items = new Map<string, SearchMlItem>();
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (items.size >= limit) break;
    const raw = (script[1] ?? "").trim();
    if (!raw || (raw[0] !== "{" && raw[0] !== "[")) continue;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      try {
        parsed = JSON.parse(decodeHtml(raw));
      } catch {
        continue;
      }
    }
    for (const candidate of structuredCandidatesFromJson(parsed)) {
      const item = toSearchItem(candidate);
      if (!item || items.has(item.id) || !relevant(query, item.title)) continue;
      items.set(item.id, item);
      if (items.size >= limit) break;
    }
  }
  return Array.from(items.values());
}

function classifyHtml(html: string) {
  const probe = normalizeSearchText(html.slice(0, 20_000));
  if (/captcha|challenge|robot|verifique que voce e humano|access denied|acesso negado/.test(probe)) return "challenge";
  if (/nenhum resultado|nao encontramos|sem resultados/.test(probe)) return "no_results";
  if (/<(?:li|article)\b/i.test(html) && /mercadolivre\.com\.br/i.test(html)) return "search_like";
  return "unknown";
}

export function extractPublicSiteSearchItems(html: string, query: string, limit = 20): SearchMlItem[] {
  const items = new Map<string, SearchMlItem>();

  for (const item of extractStructuredItems(html, query, limit)) items.set(item.id, item);

  const anchorPattern = /<a\b[^>]*(?:href|data-href)=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    if (items.size >= limit) break;
    const permalink = cleanMlPermalink(match[1]);
    if (!permalink || items.has(permalink.id)) continue;
    const block = findCardBlock(html, match.index ?? 0);
    const title = extractTitle(block, match[0]);
    if (!title || !relevant(query, title)) continue;

    const thumbnail = extractThumbnail(block);
    items.set(permalink.id, {
      id: permalink.id,
      title,
      price_cents: extractPriceCents(block),
      thumbnail,
      permalink: permalink.url,
      category: null,
      seller: extractSeller(block),
      condition: null,
      available_quantity: null,
      sold_quantity: null,
      status: null,
      images: thumbnail ? [thumbnail] : [],
      attributes: [],
      source_kind: isCatalogOffer(block) ? "catalog_offer" : "marketplace",
      seller_id: null,
      verified_item: false,
    });
  }

  return Array.from(items.values()).slice(0, limit);
}

export async function searchMercadoLivrePublicSiteFallback(query: string, limit = 20) {
  const slug = normalizeSearchTerm(query).toLowerCase();
  if (!slug) {
    return {
      items: [] as SearchMlItem[],
      status: null as number | "network_error" | null,
      url: null as string | null,
      pageKind: null as string | null,
    };
  }

  const url = `${PUBLIC_SEARCH_BASE}${slug}`;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Cache-Control": "no-cache",
        "User-Agent": WEB_UA,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return { items: [] as SearchMlItem[], status: response.status, url, pageKind: "http_error" };
    }

    const html = await response.text();
    const pageKind = classifyHtml(html);
    const items = extractPublicSiteSearchItems(html, query, limit);
    console.info(
      "[ML public fallback html]",
      JSON.stringify({
        url,
        final_url: response.url,
        status: response.status,
        content_type: response.headers.get("content-type"),
        page_kind: pageKind,
        html_length: html.length,
        extracted_items: items.length,
        html_preview: html.slice(0, 500),
      }),
    );
    return { items, status: response.status, url, pageKind };
  } catch (error) {
    console.warn("[ML public fallback failed]", error instanceof Error ? error.message : String(error));
    return { items: [] as SearchMlItem[], status: "network_error" as const, url, pageKind: "network_error" };
  }
}
