import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeSearchText } from "@/lib/ml-search-input";
import type { SearchMlItem } from "@/lib/ml-search-production.functions";

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

/**
 * Entrada única da busca comum por palavra-chave.
 *
 * Ordem das fontes:
 * 1) API oficial do Mercado Livre usando a conta conectada;
 * 2) somente se não houver nenhum item confirmado, a página pública
 *    https://lista.mercadolivre.com.br/{termo};
 * 3) somente se as duas anteriores não devolverem nada, redundâncias web.
 *
 * Nenhum ID, URL ou anúncio pode ser criado pela IA.
 */
const SEARCH_FLOW_VERSION = "ml-auth-public-page-firecrawl-quality-v10-2026-09-03";

function relevance(query: string, title: string) {
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(title);
  if (!q || !t) return 0;
  if (t === q) return 140;
  if (t.startsWith(q)) return 120;
  if (t.includes(q)) return 110;
  const words = q.split(" ").filter((word) => word.length >= 2);
  if (!words.length) return 0;
  const matched = words.filter((word) => t.includes(word)).length;
  return Math.round((matched / words.length) * 100);
}

function completeness(item: SearchMlItem) {
  return Number(!!item.thumbnail) * 3 + Number(item.price_cents != null) * 3 + Number(!!item.seller) + Number(!!item.condition);
}

function toItem(ad: { id: string; title: string; permalink: string; price_cents: number | null; thumbnail: string | null }): SearchMlItem {
  return {
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
  };
}

function addItems(target: Map<string, SearchMlItem>, items: SearchMlItem[]) {
  for (const item of items) if (!target.has(item.id)) target.set(item.id, item);
}

export const searchMercadoLivrePublicAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        query: z.string().trim().min(1).max(120),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const desired = Math.min(Math.max(data.limit ?? 20, 1), 50);
    const query = data.query.trim();

    console.info("[ML public search]", {
      version: SEARCH_FLOW_VERSION,
      query,
      desired,
      strategy: "official-api-first-public-page-then-firecrawl",
    });

    const byId = new Map<string, SearchMlItem>();
    let officialReason: string | null = null;
    let firecrawlError: string | null = null;
    let officialCount = 0;
    let publicFallbackCount = 0;
    let publicFallbackStatus: number | "network_error" | null = null;
    let firecrawlConfiguredFlag = false;
    let firecrawlCalled = false;
    let firecrawlStatuses: number[] = [];
    let firecrawlItems = 0;

    try {
      const { discoverPublicAds } = await import("@/lib/ml-discovery.server");
      const official = await discoverPublicAds(context.userId, query, desired);
      officialReason = official.reason;
      officialCount = official.items.length;
      addItems(byId, official.items);
    } catch (error) {
      console.error("[ML authenticated discovery failed]", error instanceof Error ? error.message : String(error));
    }

    if (byId.size === 0) {
      const { searchMercadoLivrePublicSiteFallback } = await import("@/lib/ml-public-site-fallback.server");
      const fallback = await searchMercadoLivrePublicSiteFallback(query, desired);
      publicFallbackCount = fallback.items.length;
      publicFallbackStatus = fallback.status;
      addItems(byId, fallback.items);
    }

    if (byId.size === 0) {
      const { firecrawlSearchMercadoLivre, firecrawlConfigured } = await import("@/lib/ml-firecrawl.server");
      firecrawlConfiguredFlag = firecrawlConfigured();
      if (firecrawlConfiguredFlag) {
        firecrawlCalled = true;
        const outcome = await firecrawlSearchMercadoLivre(query, desired);
        firecrawlError = outcome.error;
        firecrawlStatuses = outcome.statuses;
        firecrawlItems = outcome.ads.length;
        for (const ad of outcome.ads) if (!byId.has(ad.id)) byId.set(ad.id, toItem(ad));
      }
    }

    if (byId.size === 0) {
      const { searchAdsWithGeminiGrounding } = await import("@/lib/ml-gemini-search.server");
      const complement = await searchAdsWithGeminiGrounding(query, desired).catch(() => [] as SearchMlItem[]);
      addItems(byId, complement);
    }

    const relevantItems = Array.from(byId.values())
      .filter((item) => relevance(query, item.title) > 0 || /^Anúncio MLB/i.test(item.title))
      .sort((a, b) => {
        if (a.verified_item !== b.verified_item) return a.verified_item ? -1 : 1;
        const relevanceDiff = relevance(query, b.title) - relevance(query, a.title);
        if (relevanceDiff) return relevanceDiff;
        return completeness(b) - completeness(a);
      });

    const richItems = relevantItems.filter((item) => item.thumbnail || item.price_cents != null);
    const itemPool = richItems.length >= Math.min(5, desired) ? richItems : relevantItems;
    const items = itemPool.slice(0, desired);

    console.info("[ML public search result]", {
      version: SEARCH_FLOW_VERSION,
      query,
      official_items: officialCount,
      public_fallback_status: publicFallbackStatus,
      public_fallback_items: publicFallbackCount,
      firecrawl_configured: firecrawlConfiguredFlag,
      firecrawl_called: firecrawlCalled,
      firecrawl_statuses: firecrawlStatuses,
      firecrawl_items: firecrawlItems,
      final_items: items.length,
      final_with_images: items.filter((item) => !!item.thumbnail).length,
      final_with_price: items.filter((item) => item.price_cents != null).length,
    });

    const usedPublicFallback = officialCount === 0 && publicFallbackCount > 0;
    const usedFirecrawl = officialCount === 0 && publicFallbackCount === 0 && firecrawlItems > 0;
    const reason = items.length
      ? usedPublicFallback
        ? `${items.length} anúncio(s) encontrado(s) no Mercado Livre.`
        : usedFirecrawl
          ? `${items.length} anúncio(s) encontrado(s) no Mercado Livre.`
          : `${items.length} anúncio(s) real(is) do Mercado Livre encontrado(s) para “${query}”.`
      : officialReason
        ? `${officialReason} A busca pública do Mercado Livre também não retornou anúncios utilizáveis agora.`
        : firecrawlError
          ? `Nenhuma oferta real pôde ser carregada para “${query}” agora.`
          : `Nenhuma oferta real pôde ser carregada para “${query}” agora.`;

    return {
      ok: items.length > 0,
      configured: true,
      reason,
      items,
      firecrawl_configured: firecrawlConfiguredFlag,
      firecrawl_called: firecrawlCalled,
      firecrawl_statuses: firecrawlStatuses,
      firecrawl_items: firecrawlItems,
    };
  });
