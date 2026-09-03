import { itemIdFromRealMlUrl } from "@/lib/ml-discovery.server";

const GATEWAY_V2 = "https://connector-gateway.lovable.dev/firecrawl/v2";
const DIRECT_V2 = "https://api.firecrawl.dev/v2";
const TIMEOUT_MS = 12_000;
const MAX_CONCURRENCY = 4;

export type FirecrawlEnrichmentCandidate = {
  id: string;
  title: string;
  permalink: string;
  price_cents: number | null;
  thumbnail: string | null;
};

export type FirecrawlEnrichmentOutcome = {
  configured: boolean;
  items: FirecrawlEnrichmentCandidate[];
  statuses: number[];
};

function key() {
  return process.env["FIRECRAWL_API_KEY"]?.trim() || null;
}

function lovableKey() {
  return process.env["LOVABLE_API_KEY"]?.trim() || null;
}

export function firecrawlEnrichmentConfigured() {
  const value = key();
  if (!value) return false;
  return !value.startsWith("lovc_") || !!lovableKey();
}

function target() {
  const value = key();
  if (!value) return null;
  if (value.startsWith("lovc_")) {
    const gatewayKey = lovableKey();
    if (!gatewayKey) return null;
    return {
      url: `${GATEWAY_V2}/scrape`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gatewayKey}`,
        "X-Connection-Api-Key": value,
      },
    };
  }
  return {
    url: `${DIRECT_V2}/scrape`,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${value}` },
  };
}

function decode(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/");
}

function strip(value: string) {
  return decode(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function imageUrl(value?: string | null) {
  if (!value) return null;
  let out = decode(value).trim();
  if (out.startsWith("//")) out = `https:${out}`;
  if (out.startsWith("http://")) out = `https://${out.slice(7)}`;
  if (!out.startsWith("https://")) return null;
  return /(mlstatic\.com|\.jpe?g(?:\?|$)|\.png(?:\?|$)|\.webp(?:\?|$))/i.test(out) ? out : null;
}

function numberToCents(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().replace(/\s/g, "");
  let number: number;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized)) {
    number = Number(normalized.replace(/\./g, "").replace(",", "."));
  } else {
    number = Number(normalized.replace(",", "."));
  }
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : null;
}

export function extractProductPageEnrichment(
  html: string,
  candidate: FirecrawlEnrichmentCandidate,
): FirecrawlEnrichmentCandidate {
  const title = strip(
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1]
      ?? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? candidate.title,
  ).slice(0, 220) || candidate.title;

  const priceRaw =
    html.match(/<meta[^>]+itemprop=["']price["'][^>]+content=["']([\d.,]+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([\d.,]+)["'][^>]+itemprop=["']price["']/i)?.[1]
    ?? html.match(/"price"\s*:\s*([\d.]+)/i)?.[1]
    ?? html.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i)?.[1];

  const thumbnail = imageUrl(
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
      ?? html.match(/<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<img\b[^>]+src=["'](https?:\/\/[^"']*mlstatic\.com[^"']*)["']/i)?.[1]
      ?? null,
  );

  return {
    ...candidate,
    title,
    price_cents: candidate.price_cents ?? numberToCents(priceRaw),
    thumbnail: candidate.thumbnail ?? thumbnail,
  };
}

function documents(payload: unknown) {
  const result: string[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return void value.forEach(visit);
    const row = value as Record<string, unknown>;
    const html = typeof row["rawHtml"] === "string" ? row["rawHtml"] : typeof row["html"] === "string" ? row["html"] : null;
    if (html) result.push(html);
    if (row["data"]) visit(row["data"]);
  };
  visit(payload);
  return result;
}

async function enrichOne(candidate: FirecrawlEnrichmentCandidate, statuses: number[]) {
  if (itemIdFromRealMlUrl(candidate.permalink) !== candidate.id) return candidate;
  const request = target();
  if (!request) return candidate;
  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({
        url: candidate.permalink,
        formats: ["rawHtml"],
        onlyMainContent: false,
        waitFor: 400,
        location: { country: "BR", languages: ["pt-BR"] },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    statuses.push(response.status);
    if (!response.ok) return candidate;
    const payload = await response.json().catch(() => null);
    const html = documents(payload)[0];
    return html ? extractProductPageEnrichment(html, candidate) : candidate;
  } catch {
    return candidate;
  }
}

export async function firecrawlEnrichMercadoLivreAds(candidates: FirecrawlEnrichmentCandidate[]): Promise<FirecrawlEnrichmentOutcome> {
  const statuses: number[] = [];
  if (!firecrawlEnrichmentConfigured() || !candidates.length) {
    return { configured: firecrawlEnrichmentConfigured(), items: candidates, statuses };
  }

  const output: FirecrawlEnrichmentCandidate[] = [];
  for (let offset = 0; offset < candidates.length; offset += MAX_CONCURRENCY) {
    const batch = candidates.slice(offset, offset + MAX_CONCURRENCY);
    output.push(...await Promise.all(batch.map((candidate) => enrichOne(candidate, statuses))));
  }
  return { configured: true, items: output, statuses };
}
