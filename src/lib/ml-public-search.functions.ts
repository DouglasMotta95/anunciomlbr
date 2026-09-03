import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { itemIdFromRealMlUrl } from "@/lib/ml-discovery.server";
import { normalizeItemId, normalizeSearchText } from "@/lib/ml-search-input";
import type { SearchMlItem } from "@/lib/ml-search-production.functions";

const ML_API = "https://api.mercadolibre.com";
const SEARCH_FLOW_VERSION = "public-ml-like-search-verified-v13-2026-09-03";
const MIN_RELEVANCE = 100;

type SearchResult = {
  ok: boolean;
  configured: true;
  reason: string | null;
  items: SearchMlItem[];
  firecrawl_configured: boolean;
  firecrawl_called: boolean;
  firecrawl_statuses: number[];
  firecrawl_items: number;
};

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

type Candidate = SearchMlItem & { permalink: string };

const STOP = new Set(["de", "da", "do", "das", "dos", "com", "para", "por", "e", "em", "o", "a", "um", "uma"]);
const ACCESSORY_LEADS = new Set([
  "adaptador", "adesivo", "cabo", "capa", "carregador", "case", "controle", "extensao", "kit", "livro", "manual", "pelicula", "protetor", "suporte",
]);

function words(value: string) {
  return normalizeSearchText(value).split(" ").filter((word) => word.length >= 2 && !STOP.has(word));
}

/**
 * Relevância genérica para funcionar como uma busca pública do Mercado Livre:
 * aceita qualquer produto, exige os termos pesquisados no título e só pune
 * resultados claramente acessórios quando a pesquisa é por um único produto/marca.
 */
export function strictSearchRelevanceScore(query: string, title: string) {
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(title);
  if (!q || !t) return 0;
  if (t === q) return 240;
  if (t.startsWith(`${q} `)) return 220;
  if (t.includes(` ${q} `) || t.endsWith(` ${q}`)) return 190;

  const queryWords = words(query);
  const titleWords = words(title);
  if (!queryWords.length || !titleWords.length) return 0;

  if (queryWords.length === 1) {
    const needle = queryWords[0]!;
    const position = titleWords.indexOf(needle);
    if (position < 0) return 0;
    if (position > 0 && ACCESSORY_LEADS.has(titleWords[0]!) && titleWords[0] !== needle) return 0;
    return Math.max(110, 170 - position * 8);
  }

  const positions = queryWords.map((word) => titleWords.indexOf(word));
  if (positions.some((position) => position < 0)) return 0;

  const ordered = positions.every((position, index) => index === 0 || position > positions[index - 1]!);
  const firstPosition = positions[0]!;
  const phraseBonus = t.includes(q) ? 35 : 0;
  const orderBonus = ordered ? 20 : 0;
  const startBonus = firstPosition === 0 ? 25 : firstPosition === 1 ? 15 : 0;
  return 105 + phraseBonus + orderBonus + startBonus;
}

function cleanHttps(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice(7)}`;
  return trimmed.startsWith("https://") ? trimmed : null;
}

function priceCents(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

function confirmedApiItem(row: ApiItem, candidate?: SearchMlItem): SearchMlItem | null {
  const id = normalizeItemId(row.id ?? "");
  const permalink = cleanHttps(row.permalink);
  if (!id || !/^MLB\d+$/.test(id) || !permalink || itemIdFromRealMlUrl(permalink) !== id) return null;
  if (row.site_id && row.site_id !== "MLB") return null;
  if (row.status && row.status !== "active") return null;
  const title = row.title?.trim();
  if (!title) return null;

  const thumbnail = cleanHttps(row.thumbnail) ?? candidate?.thumbnail ?? null;
  const images = (row.pictures ?? [])
    .map((picture) => cleanHttps(picture.secure_url ?? picture.url))
    .filter((value): value is string => !!value);

  return {
    id,
    title,
    price_cents: priceCents(row.price) ?? candidate?.price_cents ?? null,
    thumbnail,
    permalink,
    category: row.category_id ?? candidate?.category ?? null,
    seller: candidate?.seller ?? null,
    condition: row.condition ?? candidate?.condition ?? null,
    available_quantity: typeof row.available_quantity === "number" ? row.available_quantity : candidate?.available_quantity ?? null,
    sold_quantity: typeof row.sold_quantity === "number" ? row.sold_quantity : null,
    status: "active",
    images: images.length ? images : thumbnail ? [thumbnail] : [],
    attributes: candidate?.attributes ?? [],
    source_kind: candidate?.source_kind ?? "marketplace",
    seller_id: row.seller_id != null ? String(row.seller_id) : candidate?.seller_id ?? null,
    verified_item: true,
  };
}

async function accessTokens(userId: string) {
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

async function mlGet(path: string, tokens: string[], statuses: number[]) {
  for (const token of [...tokens, ""]) {
    try {
      const response = await fetch(`${ML_API}${path}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "ANUNCIO-ML/1.0",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
      statuses.push(response.status);
      const body = await response.json().catch(() => null);
      if (response.ok) return body;
      if (![401, 403].includes(response.status)) break;
    } catch {}
  }
  return null;
}

async function officialSearch(query: string, desired: number, tokens: string[], statuses: number[]) {
  const body = await mlGet(`/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${Math.min(Math.max(desired * 2, 20), 50)}`, tokens, statuses) as { results?: ApiItem[] } | null;
  return (Array.isArray(body?.results) ? body.results : [])
    .map((row) => confirmedApiItem(row))
    .filter((item): item is SearchMlItem => !!item)
    .filter((item) => strictSearchRelevanceScore(query, item.title) >= MIN_RELEVANCE)
    .slice(0, desired);
}

async function verifyCandidates(query: string, candidates: SearchMlItem[], tokens: string[], statuses: number[]) {
  const valid = Array.from(new Map(candidates
    .filter((candidate): candidate is Candidate => !!candidate.permalink && itemIdFromRealMlUrl(candidate.permalink) === candidate.id)
    .filter((candidate) => strictSearchRelevanceScore(query, candidate.title) >= MIN_RELEVANCE)
    .map((candidate) => [candidate.id, candidate])).values());
  if (!valid.length) return [] as SearchMlItem[];

  const verified: SearchMlItem[] = [];
  for (let offset = 0; offset < valid.length; offset += 20) {
    const batch = valid.slice(offset, offset + 20);
    const byId = new Map(batch.map((candidate) => [candidate.id, candidate]));
    const body = await mlGet(`/items?ids=${encodeURIComponent(batch.map((candidate) => candidate.id).join(","))}`, tokens, statuses);
    const rows = Array.isArray(body) ? body : [];
    for (const entry of rows) {
      const row = entry && typeof entry === "object" && "body" in entry ? (entry as { body?: ApiItem }).body : entry as ApiItem;
      if (!row) continue;
      const id = normalizeItemId(row.id ?? "");
      const item = confirmedApiItem(row, id ? byId.get(id) : undefined);
      if (item && strictSearchRelevanceScore(query, item.title) >= MIN_RELEVANCE) verified.push(item);
    }
  }
  return verified;
}

function mergeSearchItem(existing: SearchMlItem, item: SearchMlItem): SearchMlItem {
  const existingImages = existing.images ?? [];
  const incomingImages = item.images ?? [];
  const thumbnail = existing.thumbnail ?? item.thumbnail;
  return {
    ...existing,
    price_cents: existing.price_cents ?? item.price_cents,
    thumbnail,
    permalink: existing.permalink ?? item.permalink,
    category: existing.category ?? item.category,
    seller: existing.seller ?? item.seller,
    condition: existing.condition ?? item.condition,
    available_quantity: existing.available_quantity ?? item.available_quantity,
    sold_quantity: existing.sold_quantity ?? item.sold_quantity,
    status: existing.status ?? item.status,
    images: existingImages.length ? existingImages : incomingImages.length ? incomingImages : thumbnail ? [thumbnail] : [],
    attributes: existing.attributes?.length ? existing.attributes : item.attributes ?? [],
    source_kind: existing.source_kind ?? item.source_kind,
    seller_id: existing.seller_id ?? item.seller_id,
    verified_item: existing.verified_item === true || item.verified_item === true,
  };
}

function addItems(target: Map<string, SearchMlItem>, items: SearchMlItem[]) {
  for (const item of items) {
    const existing = target.get(item.id);
    target.set(item.id, existing ? mergeSearchItem(existing, item) : item);
  }
}

function mergeEnrichment(verified: SearchMlItem[], enriched: Array<{ id: string; price_cents: number | null; thumbnail: string | null }>) {
  const extra = new Map(enriched.map((item) => [item.id, item]));
  return verified.map((item) => {
    const row = extra.get(item.id);
    if (!row) return item;
    const thumbnail = item.thumbnail ?? row.thumbnail;
    return {
      ...item,
      price_cents: item.price_cents ?? row.price_cents,
      thumbnail,
      images: item.images?.length ? item.images : thumbnail ? [thumbnail] : [],
    };
  });
}

function resultQualityScore(item: SearchMlItem) {
  return Number(item.price_cents != null) * 5
    + Number(!!item.thumbnail) * 4
    + Number(!!item.seller || !!item.seller_id) * 2
    + Number(item.sold_quantity != null)
    + Number(item.available_quantity != null);
}

export const searchMercadoLivrePublicAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    query: z.string().trim().min(1).max(120),
    limit: z.number().int().min(1).max(200).optional(),
  }).parse(data))
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const desired = Math.min(Math.max(data.limit ?? 20, 1), 50);
    const query = data.query.trim();
    const mlStatuses: number[] = [];
    const firecrawlStatuses: number[] = [];

    console.info("[ML public search]", {
      version: SEARCH_FLOW_VERSION,
      query,
      desired,
      strategy: "official-and-public-parallel-verify-every-result",
    });

    const { searchMercadoLivrePublicSiteFallback } = await import("@/lib/ml-public-site-fallback.server");
    const tokensPromise = accessTokens(context.userId);
    const officialPromise = tokensPromise.then((tokens) => officialSearch(query, desired, tokens, mlStatuses));
    const fallbackPromise = searchMercadoLivrePublicSiteFallback(query, Math.min(desired * 2, 50));
    const [tokens, officialItems, fallback] = await Promise.all([tokensPromise, officialPromise, fallbackPromise]);

    const publicCandidates = fallback.items.filter((item) => strictSearchRelevanceScore(query, item.title) >= MIN_RELEVANCE);
    const incomplete = Array.from(new Map([...officialItems, ...publicCandidates]
      .filter((item): item is Candidate => !!item.permalink && itemIdFromRealMlUrl(item.permalink) === item.id)
      .filter((item) => !item.thumbnail || item.price_cents == null)
      .map((item) => [item.id, item])).values());

    let firecrawlConfiguredFlag = false;
    let firecrawlCalled = false;
    let enrichmentItems: Array<{ id: string; price_cents: number | null; thumbnail: string | null }> = [];

    const verifyPublicPromise = verifyCandidates(query, publicCandidates, tokens, mlStatuses);
    const enrichPromise = incomplete.length
      ? import("@/lib/ml-firecrawl-enrich.server").then(async ({ firecrawlEnrichMercadoLivreAds, firecrawlEnrichmentConfigured }) => {
          firecrawlConfiguredFlag = firecrawlEnrichmentConfigured();
          if (!firecrawlConfiguredFlag) return [];
          firecrawlCalled = true;
          const outcome = await firecrawlEnrichMercadoLivreAds(incomplete.map((item) => ({
            id: item.id,
            title: item.title,
            permalink: item.permalink,
            price_cents: item.price_cents,
            thumbnail: item.thumbnail,
          })));
          firecrawlStatuses.push(...outcome.statuses);
          return outcome.items;
        })
      : Promise.resolve([]);

    const [verifiedPublic, enriched] = await Promise.all([verifyPublicPromise, enrichPromise]);
    enrichmentItems = enriched;

    const byId = new Map<string, SearchMlItem>();
    addItems(byId, mergeEnrichment(officialItems, enriched));
    addItems(byId, mergeEnrichment(verifiedPublic, enriched));

    if (byId.size < Math.min(desired, 8)) {
      const { firecrawlSearchMercadoLivre, firecrawlConfigured } = await import("@/lib/ml-firecrawl.server");
      firecrawlConfiguredFlag = firecrawlConfiguredFlag || firecrawlConfigured();
      if (firecrawlConfigured()) {
        firecrawlCalled = true;
        const outcome = await firecrawlSearchMercadoLivre(query, Math.min(desired * 2, 50));
        firecrawlStatuses.push(...outcome.statuses);
        const candidates = outcome.ads.map((ad): SearchMlItem => ({
          id: ad.id,
          title: ad.title,
          price_cents: ad.price_cents,
          thumbnail: ad.thumbnail,
          permalink: ad.permalink,
          category: null,
          seller: null,
          condition: null,
          available_quantity: null,
          sold_quantity: null,
          status: null,
          images: ad.thumbnail ? [ad.thumbnail] : [],
          attributes: [],
          source_kind: "marketplace",
          seller_id: null,
          verified_item: false,
        }));
        addItems(byId, await verifyCandidates(query, candidates, tokens, mlStatuses));
      }
    }

    if (byId.size < Math.min(desired, 8)) {
      const { searchAdsWithGeminiGrounding } = await import("@/lib/ml-gemini-search.server");
      const groundedCandidates = await searchAdsWithGeminiGrounding(query, Math.min(desired * 2, 50)).catch(() => [] as SearchMlItem[]);
      addItems(byId, await verifyCandidates(query, groundedCandidates, tokens, mlStatuses));
    }

    const items = Array.from(byId.values())
      .filter((item) => item.verified_item === true)
      .filter((item) => item.status === "active")
      .filter((item) => !!item.permalink && itemIdFromRealMlUrl(item.permalink) === item.id)
      .filter((item) => strictSearchRelevanceScore(query, item.title) >= MIN_RELEVANCE)
      .sort((a, b) => {
        const relevance = strictSearchRelevanceScore(query, b.title) - strictSearchRelevanceScore(query, a.title);
        if (relevance) return relevance;
        const quality = resultQualityScore(b) - resultQualityScore(a);
        if (quality) return quality;
        return (b.sold_quantity ?? -1) - (a.sold_quantity ?? -1);
      })
      .slice(0, desired);

    console.info("[ML public search result]", {
      version: SEARCH_FLOW_VERSION,
      query,
      official_items: officialItems.length,
      public_fallback_status: fallback.status,
      public_fallback_items: fallback.items.length,
      public_verified_items: verifiedPublic.length,
      firecrawl_configured: firecrawlConfiguredFlag,
      firecrawl_called: firecrawlCalled,
      firecrawl_statuses: firecrawlStatuses,
      firecrawl_enriched_items: enrichmentItems.length,
      ml_verify_statuses: mlStatuses,
      final_items: items.length,
      final_missing_price: items.filter((item) => item.price_cents == null).length,
      final_missing_image: items.filter((item) => !item.thumbnail).length,
      final_without_confirmed_permalink: items.filter((item) => !item.permalink || itemIdFromRealMlUrl(item.permalink) !== item.id).length,
    });

    return {
      ok: items.length > 0,
      configured: true,
      reason: items.length ? `${items.length} anúncio(s) ativo(s) e confirmado(s) no Mercado Livre.` : `Nenhum anúncio ativo e confirmado do Mercado Livre foi encontrado para “${query}”.`,
      items,
      firecrawl_configured: firecrawlConfiguredFlag,
      firecrawl_called: firecrawlCalled,
      firecrawl_statuses: firecrawlStatuses,
      firecrawl_items: enrichmentItems.length,
    };
  });
