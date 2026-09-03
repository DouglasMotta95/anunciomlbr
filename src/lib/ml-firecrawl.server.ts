/**
 * Coleta server-only de anúncios reais do Mercado Livre Brasil via Firecrawl.
 *
 * Nada aqui inventa dados: título, link, ID MLB, preço e imagem só são aceitos
 * quando aparecem em resposta real de página/busca e o MLB está no caminho da URL.
 */

import { normalizeItemId, normalizeSearchTerm } from "@/lib/ml-search-input";

const GATEWAY_V2 = "https://connector-gateway.lovable.dev/firecrawl/v2";
const DIRECT_V2 = "https://api.firecrawl.dev/v2";
const TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [350, 900] as const;

export type FirecrawlAd = {
  id: string;
  title: string;
  permalink: string;
  price_cents: number | null;
  thumbnail: string | null;
};

export type FirecrawlOutcome = {
  configured: boolean;
  ads: FirecrawlAd[];
  statuses: number[];
  error: string | null;
};

type ScrapeDocument = {
  html: string;
  markdown: string;
  finalUrl: string | null;
  statusCode: number | null;
};

function firecrawlKey() {
  return process.env["FIRECRAWL_API_KEY"]?.trim() || null;
}

function lovableGatewayKey() {
  return process.env["LOVABLE_API_KEY"]?.trim() || null;
}

export function firecrawlConfigured() {
  const key = firecrawlKey();
  if (!key) return false;
  if (key.startsWith("lovc_")) return !!lovableGatewayKey();
  return true;
}

function requestTarget(path: string) {
  const key = firecrawlKey();
  if (!key) return null;

  if (key.startsWith("lovc_")) {
    const lovableKey = lovableGatewayKey();
    if (!lovableKey) return null;
    return {
      url: `${GATEWAY_V2}${path}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": key,
      } as Record<string, string>,
    };
  }

  return {
    url: `${DIRECT_V2}${path}`,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` } as Record<string, string>,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function requestedUrl(body: unknown) {
  return body && typeof body === "object" && typeof (body as Record<string, unknown>)["url"] === "string"
    ? String((body as Record<string, unknown>)["url"])
    : null;
}

async function firecrawl(path: string, body: unknown, statuses: number[]): Promise<unknown | null> {
  const target = requestTarget(path);
  if (!target) return null;

  const maxAttempts = RETRY_DELAYS_MS.length + 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(target.url, {
        method: "POST",
        headers: target.headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      statuses.push(response.status);
      const text = await response.text();
      console.info("[Firecrawl gateway]", {
        path,
        requested_url: requestedUrl(body),
        attempt: attempt + 1,
        status: response.status,
        response_bytes: text.length,
      });

      if (response.ok) {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          console.error("[Firecrawl gateway]", { path, status: response.status, error: "invalid_json", response_bytes: text.length });
          return null;
        }
      }

      console.error("[Firecrawl]", { path, status: response.status, body: text.slice(0, 500) });
      if (!shouldRetryStatus(response.status) || attempt >= RETRY_DELAYS_MS.length) return null;
    } catch (error) {
      console.error("[Firecrawl gateway]", {
        path,
        requested_url: requestedUrl(body),
        attempt: attempt + 1,
        status: "network_error",
        message: error instanceof Error ? error.message : String(error),
      });
      if (attempt >= RETRY_DELAYS_MS.length) return null;
    }

    await sleep(RETRY_DELAYS_MS[attempt] ?? 900);
  }
  return null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/");
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function httpsUrl(value: string | null | undefined) {
  if (!value) return null;
  let candidate = decodeHtml(value).trim();
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  if (candidate.startsWith("http://")) candidate = `https://${candidate.slice(7)}`;
  return candidate.startsWith("https://") ? candidate : null;
}

function isMlUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br") || host === "mercadolivre.com" || host.endsWith(".mercadolivre.com");
  } catch {
    return false;
  }
}

function mlItemIdFromPath(value: string) {
  try {
    const url = new URL(value);
    if (!isMlUrl(url.toString())) return null;
    const id = normalizeItemId(url.pathname);
    return id && /^MLB\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function cleanPermalink(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return value;
  }
}

function toCents(fraction: string | null | undefined, cents?: string | null) {
  if (!fraction) return null;
  const digits = fraction.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isFinite(value) || value <= 0) return null;
  const decimals = (cents ?? "").replace(/[^\d]/g, "").slice(0, 2).padEnd(2, "0");
  return value * 100 + (cents ? Number(decimals) : 0);
}

function isImage(value: string | null) {
  if (!value) return false;
  return /(mlstatic\.com|\.jpe?g|\.png|\.webp)/i.test(value) && !/data:image/i.test(value);
}

function pushAd(map: Map<string, FirecrawlAd>, ad: FirecrawlAd | null) {
  if (!ad) return;
  const current = map.get(ad.id);
  if (!current) {
    map.set(ad.id, ad);
    return;
  }
  map.set(ad.id, {
    id: ad.id,
    title: current.title.length >= ad.title.length ? current.title : ad.title,
    permalink: current.permalink,
    price_cents: current.price_cents ?? ad.price_cents,
    thumbnail: current.thumbnail ?? ad.thumbnail,
  });
}

function buildAd(rawUrl: string | null, rawTitle: string | null, priceCents: number | null, image: string | null): FirecrawlAd | null {
  const url = httpsUrl(rawUrl);
  if (!url || !isMlUrl(url)) return null;
  const id = mlItemIdFromPath(url);
  if (!id) return null;
  const title = (rawTitle ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
  if (title.length < 3) return null;
  return {
    id,
    title,
    permalink: cleanPermalink(url),
    price_cents: priceCents,
    thumbnail: isImage(image) ? image : null,
  };
}

function splitCards(html: string) {
  const blocks = html.split(/<li\b/i).slice(1);
  if (blocks.length > 1) return blocks;
  return html.split(/<div\b[^>]*class=["'][^"']*poly-card/i).slice(1);
}

export function extractAdsFromHtml(html: string): FirecrawlAd[] {
  const found = new Map<string, FirecrawlAd>();
  for (const block of splitCards(html)) {
    const anchor = Array.from(block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)).find(
      (match) => !!mlItemIdFromPath(decodeHtml(match[1] ?? "")),
    );
    if (!anchor) continue;
    const href = decodeHtml(anchor[1] ?? "");
    const titleAttr = block.match(/class=["'][^"']*(?:poly-component__title|ui-search-item__title)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1];
    const titleFromAnchorAttr = anchor[0].match(/(?:title|aria-label)=["']([^"']{3,220})["']/i)?.[1];
    const title = stripHtml(titleAttr ?? titleFromAnchorAttr ?? anchor[2] ?? "");
    const fraction = block.match(/class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1]
      ?? block.match(/R\$\s*([\d.\s]{1,15})/i)?.[1];
    const cents = block.match(/class=["'][^"']*andes-money-amount__cents[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1];
    const image = httpsUrl(
      block.match(/<img\b[^>]*\bdata-src=["']([^"']+)["']/i)?.[1]
      ?? block.match(/<img\b[^>]*\bdata-lazy-src=["']([^"']+)["']/i)?.[1]
      ?? block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]
      ?? null,
    );
    pushAd(found, buildAd(href, title, toCents(fraction ? stripHtml(fraction) : null, cents ? stripHtml(cents) : null), image));
  }
  return Array.from(found.values());
}

export function extractAdsFromMarkdown(markdown: string): FirecrawlAd[] {
  const found = new Map<string, FirecrawlAd>();
  const lines = markdown.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\[([^\]]{0,300})\]\((https?:\/\/[^)\s]+)\)/g)) {
      const label = stripHtml(match[1] ?? "");
      const url = match[2] ?? "";
      if (!mlItemIdFromPath(url)) continue;
      const context = lines.slice(index, index + 5).join(" ");
      const priceMatch = context.match(/R\$\s*([\d.]{1,15})(?:,(\d{2}))?/i);
      const imageMatch = (line.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/) ?? context.match(/(https:\/\/http2\.mlstatic\.com\/[^\s)"']+)/))?.[1] ?? null;
      const title = label.replace(/^!\[[^\]]*\]\([^)]*\)\s*/, "").trim();
      pushAd(found, buildAd(url, title, toCents(priceMatch?.[1] ?? null, priceMatch?.[2] ?? null), httpsUrl(imageMatch)));
    }
  });
  return Array.from(found.values());
}

function metadataUrl(row: Record<string, unknown>) {
  const metadata = row["metadata"];
  if (metadata && typeof metadata === "object") {
    const nested = metadata as Record<string, unknown>;
    for (const key of ["sourceURL", "sourceUrl", "url", "finalUrl"]) {
      if (typeof nested[key] === "string") return String(nested[key]);
    }
  }
  for (const key of ["url", "sourceURL", "sourceUrl", "finalUrl"]) {
    if (typeof row[key] === "string") return String(row[key]);
  }
  return null;
}

function metadataStatus(row: Record<string, unknown>) {
  const metadata = row["metadata"];
  if (metadata && typeof metadata === "object") {
    const nested = metadata as Record<string, unknown>;
    for (const key of ["statusCode", "status", "httpStatus"]) {
      const value = Number(nested[key]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

function scrapeDocuments(payload: unknown): ScrapeDocument[] {
  const docs: ScrapeDocument[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (seen.has(value as object)) return;
    seen.add(value as object);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const row = value as Record<string, unknown>;
    const html = typeof row["rawHtml"] === "string" ? row["rawHtml"] : typeof row["html"] === "string" ? row["html"] : "";
    const markdown = typeof row["markdown"] === "string" ? row["markdown"] : "";
    if (html || markdown) docs.push({ html, markdown, finalUrl: metadataUrl(row), statusCode: metadataStatus(row) });
    if (row["data"]) visit(row["data"]);
  };
  visit(payload);
  return docs;
}

function searchUrls(query: string, desired: number) {
  const slug = normalizeSearchTerm(query);
  if (!slug) return [] as string[];
  const primary = `https://lista.mercadolivre.com.br/${slug}`;
  return desired > 20 ? [primary, `${primary}_Desde_49`] : [primary];
}

function rowImage(row: Record<string, unknown>) {
  for (const key of ["image", "thumbnail", "ogImage", "og_image"]) {
    const value = row[key];
    if (typeof value === "string" && isImage(httpsUrl(value))) return httpsUrl(value);
  }
  const metadata = row["metadata"];
  if (metadata && typeof metadata === "object") {
    const nested = metadata as Record<string, unknown>;
    for (const key of ["ogImage", "og:image", "image"]) {
      const value = nested[key];
      if (typeof value === "string" && isImage(httpsUrl(value))) return httpsUrl(value);
    }
  }
  return null;
}

function logExtractedAd(ad: FirecrawlAd, source: string, finalUrl: string | null, status: number | null) {
  console.info("[Firecrawl ML item]", {
    source,
    title: ad.title,
    final_url: finalUrl ?? ad.permalink,
    permalink: ad.permalink,
    price_cents: ad.price_cents,
    image: ad.thumbnail,
    mlb: ad.id,
    status,
  });
}

function addScrapeDocument(found: Map<string, FirecrawlAd>, doc: ScrapeDocument, query: string, desired: number, requested: string) {
  const before = found.size;
  return import("@/lib/ml-public-site-fallback.server").then(({ extractPublicSiteSearchItems }) => {
    for (const item of extractPublicSiteSearchItems(doc.html, query, desired)) {
      pushAd(found, buildAd(item.permalink, item.title, item.price_cents, item.thumbnail));
    }
    for (const ad of [...extractAdsFromHtml(doc.html), ...extractAdsFromMarkdown(doc.markdown)]) pushAd(found, ad);
    const extracted = found.size - before;
    console.info("[Firecrawl ML scrape document]", {
      requested_url: requested,
      final_url: doc.finalUrl,
      status: doc.statusCode,
      html_length: doc.html.length,
      markdown_length: doc.markdown.length,
      new_items: extracted,
      total_items: found.size,
    });
    return extracted;
  });
}

function searchRows(payload: unknown) {
  const rows = (payload && typeof payload === "object" ? (payload as { data?: unknown }).data : null) ?? null;
  return Array.isArray(rows) ? rows : Array.isArray((rows as { web?: unknown } | null)?.web) ? ((rows as { web: unknown[] }).web) : [];
}

export async function firecrawlSearchMercadoLivre(query: string, desired = 20): Promise<FirecrawlOutcome> {
  const statuses: number[] = [];
  if (!firecrawlConfigured()) {
    return { configured: false, ads: [], statuses, error: "Firecrawl não está configurado corretamente neste projeto." };
  }

  const found = new Map<string, FirecrawlAd>();

  for (const url of searchUrls(query, desired)) {
    const payload = await firecrawl(
      "/scrape",
      {
        url,
        formats: ["markdown", "rawHtml"],
        onlyMainContent: false,
        waitFor: 1200,
        location: { country: "BR", languages: ["pt-BR"] },
      },
      statuses,
    );
    const docs = scrapeDocuments(payload);
    for (const doc of docs) await addScrapeDocument(found, doc, query, desired, url);
    if (found.size >= desired) break;
  }

  const searchQueries = [
    `${query} site:produto.mercadolivre.com.br`,
    `${query} site:mercadolivre.com.br MLB`,
  ];

  for (const searchQuery of searchQueries) {
    if (found.size >= Math.min(desired, 8)) break;
    const payload = await firecrawl(
      "/search",
      {
        query: searchQuery,
        limit: Math.min(20, Math.max(desired, 10)),
        lang: "pt",
        country: "br",
      },
      statuses,
    );
    for (const entry of searchRows(payload)) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const ad = buildAd(
        typeof row["url"] === "string" ? row["url"] : null,
        typeof row["title"] === "string" ? row["title"] : null,
        null,
        rowImage(row),
      );
      if (ad) {
        pushAd(found, ad);
        logExtractedAd(ad, "firecrawl_search", typeof row["url"] === "string" ? row["url"] : null, null);
      }
    }
  }

  const ads = Array.from(found.values())
    .sort((a, b) => Number(b.thumbnail != null) - Number(a.thumbnail != null) || Number(b.price_cents != null) - Number(a.price_cents != null))
    .slice(0, Math.max(desired, 1));

  for (const ad of ads) logExtractedAd(ad, "firecrawl_final", ad.permalink, statuses.at(-1) ?? null);

  console.info("[Firecrawl ML search]", {
    query,
    desired,
    statuses,
    ads: ads.length,
    with_images: ads.filter((ad) => !!ad.thumbnail).length,
    with_price: ads.filter((ad) => ad.price_cents != null).length,
    with_real_permalink: ads.filter((ad) => !!mlItemIdFromPath(ad.permalink)).length,
  });
  return { configured: true, ads, statuses, error: ads.length ? null : "Firecrawl respondeu, mas nenhum anúncio com permalink real pôde ser extraído." };
}