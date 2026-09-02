/**
 * Coleta server-only de anúncios reais do Mercado Livre Brasil via Firecrawl.
 *
 * Motivo: a API oficial bloqueia (403) a busca pública por palavra-chave e o fetch
 * direto das páginas do Mercado Livre / Google / Bing é bloqueado em produção.
 * O Firecrawl faz a raspagem da própria página de resultados do marketplace.
 *
 * Nada aqui inventa dados: título, link, ID MLB, preço e imagem só são aceitos
 * quando aparecem na página real raspada.
 */

import { normalizeItemId, normalizeSearchTerm } from "@/lib/ml-search-input";

const GATEWAY_V2 = "https://connector-gateway.lovable.dev/firecrawl/v2";
const DIRECT_V2 = "https://api.firecrawl.dev/v2";
const TIMEOUT_MS = 45_000;

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

function firecrawlKey() {
  return process.env["FIRECRAWL_API_KEY"] ?? null;
}

export function firecrawlConfigured() {
  return !!firecrawlKey();
}

function requestTarget(path: string) {
  const key = firecrawlKey();
  if (!key) return null;
  const lovableKey = process.env["LOVABLE_API_KEY"];
  // Conexões gerenciadas do Lovable usam chave lovc_ + gateway; chaves fc- falam direto com a Firecrawl.
  if (key.startsWith("lovc_") && lovableKey) {
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

async function firecrawl(path: string, body: unknown, statuses: number[]): Promise<unknown | null> {
  const target = requestTarget(path);
  if (!target) return null;
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: target.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    statuses.push(response.status);
    const text = await response.text();
    if (!response.ok) {
      console.error("[Firecrawl]", { path, status: response.status, body: text.slice(0, 500) });
      return null;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  } catch (error) {
    console.error("[Firecrawl]", { path, status: "network_error", message: error instanceof Error ? error.message : String(error) });
    return null;
  }
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

/** "R$ 1.299" + centavos "90" => 129990 */
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
  const id = normalizeItemId(url);
  if (!id || !/^MLB\d+$/.test(id)) return null;
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

/** Divide o HTML da busca em blocos de card para casar título, preço e imagem do mesmo anúncio. */
function splitCards(html: string) {
  const blocks = html.split(/<li\b/i).slice(1);
  if (blocks.length > 1) return blocks;
  return html.split(/<div\b[^>]*class=["'][^"']*poly-card/i).slice(1);
}

export function extractAdsFromHtml(html: string): FirecrawlAd[] {
  const found = new Map<string, FirecrawlAd>();
  for (const block of splitCards(html)) {
    const anchor = Array.from(block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)).find(
      (match) => !!normalizeItemId(decodeHtml(match[1] ?? "")),
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
      block.match(/<img\b[^>]*\bdata-src=["']([^"']+)["']/i)?.[1] ?? block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ?? null,
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
      if (!normalizeItemId(url)) continue;
      const context = lines.slice(index, index + 5).join(" ");
      const priceMatch = context.match(/R\$\s*([\d.]{1,15})(?:,(\d{2}))?/i);
      const imageMatch = (line.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/) ?? context.match(/(https:\/\/http2\.mlstatic\.com\/[^\s)"']+)/))?.[1] ?? null;
      const title = label.replace(/^!\[[^\]]*\]\([^)]*\)\s*/, "").trim();
      pushAd(found, buildAd(url, title, toCents(priceMatch?.[1] ?? null, priceMatch?.[2] ?? null), httpsUrl(imageMatch)));
    }
  });
  return Array.from(found.values());
}

function scrapeDocuments(payload: unknown): Array<{ html: string; markdown: string }> {
  const docs: Array<{ html: string; markdown: string }> = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const row = value as Record<string, unknown>;
    const html = typeof row["rawHtml"] === "string" ? row["rawHtml"] : typeof row["html"] === "string" ? row["html"] : "";
    const markdown = typeof row["markdown"] === "string" ? row["markdown"] : "";
    if (html || markdown) docs.push({ html, markdown });
    if (row["data"]) visit(row["data"]);
  };
  visit(payload);
  return docs;
}

function searchUrls(query: string) {
  const slug = normalizeSearchTerm(query);
  if (!slug) return [] as string[];
  return [`https://lista.mercadolivre.com.br/${slug}`, `https://lista.mercadolivre.com.br/${slug}_Desde_49`];
}

/** Raspa a página pública de resultados do Mercado Livre e devolve os anúncios reais encontrados. */
export async function firecrawlSearchMercadoLivre(query: string, desired = 20): Promise<FirecrawlOutcome> {
  const statuses: number[] = [];
  if (!firecrawlConfigured()) {
    return { configured: false, ads: [], statuses, error: "Firecrawl não está configurado neste projeto." };
  }

  const found = new Map<string, FirecrawlAd>();
  for (const url of searchUrls(query)) {
    const payload = await firecrawl(
      "/scrape",
      {
        url,
        formats: ["markdown", "rawHtml"],
        onlyMainContent: false,
        waitFor: 2500,
        location: { country: "BR", languages: ["pt-BR"] },
      },
      statuses,
    );
    for (const doc of scrapeDocuments(payload)) {
      for (const ad of [...extractAdsFromHtml(doc.html), ...extractAdsFromMarkdown(doc.markdown)]) pushAd(found, ad);
    }
    if (found.size >= desired) break;
  }

  if (found.size < Math.min(desired, 5)) {
    const payload = await firecrawl(
      "/search",
      {
        query: `${query} site:produto.mercadolivre.com.br`,
        limit: Math.min(20, Math.max(desired, 10)),
        lang: "pt",
        country: "br",
      },
      statuses,
    );
    const rows = (payload && typeof payload === "object" ? (payload as { data?: unknown }).data : null) ?? null;
    const list = Array.isArray(rows) ? rows : Array.isArray((rows as { web?: unknown } | null)?.web) ? ((rows as { web: unknown[] }).web) : [];
    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      pushAd(
        found,
        buildAd(
          typeof row["url"] === "string" ? row["url"] : null,
          typeof row["title"] === "string" ? row["title"] : null,
          null,
          null,
        ),
      );
    }
  }

  const ads = Array.from(found.values()).slice(0, Math.max(desired, 1));
  console.info("[Firecrawl ML search]", { query, desired, statuses, ads: ads.length });
  return { configured: true, ads, statuses, error: ads.length ? null : "Firecrawl respondeu, mas nenhum anúncio pôde ser extraído da página." };
}
