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
};

/**
 * Entrada única da busca comum por palavra-chave.
 *
 * "iphone" é uma consulta de marketplace e precisa devolver várias ofertas reais.
 * Ordem das fontes: API do Mercado Livre usando a conta conectada, Firecrawl (quando
 * disponível), descoberta web real e Gemini apenas para reordenar candidatos existentes.
 * Nenhum ID, URL ou anúncio pode ser criado pela IA.
 * Contrato legado da auditoria: marketplace-keyword-multi-offer.
 */
const SEARCH_FLOW_VERSION = "ml-auth-firecrawl-grounded-rerank-v7-2026-09-02";

function relevance(query: string, title: string) {
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(title);
  if (!q || !t) return 0;
  if (t === q) return 120;
  if (t.includes(q)) return 100;
  const words = q.split(" ").filter((word) => word.length >= 2);
  if (!words.length) return 0;
  return Math.round((words.filter((word) => t.includes(word)).length / words.length) * 100);
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
      strategy: "ml-auth-first-firecrawl-grounded-rerank",
    });

    const byId = new Map<string, SearchMlItem>();
    let officialReason: string | null = null;
    let firecrawlError: string | null = null;
    let officialCount = 0;

    // Primeira tentativa: usa os tokens reais da conta Mercado Livre conectada ao usuário.
    // Esta camada só devolve itens ativos e confirmados pela própria API do ML.
    try {
      const { discoverPublicAds } = await import("@/lib/ml-discovery.server");
      const official = await discoverPublicAds(context.userId, query, desired);
      officialReason = official.reason;
      officialCount = official.items.length;
      addItems(byId, official.items);
    } catch (error) {
      console.error("[ML authenticated discovery failed]", error instanceof Error ? error.message : String(error));
    }

    const { firecrawlSearchMercadoLivre, firecrawlConfigured } = await import("@/lib/ml-firecrawl.server");
    const firecrawlAvailable = firecrawlConfigured();

    if (byId.size < desired && firecrawlAvailable) {
      const outcome = await firecrawlSearchMercadoLivre(query, desired - byId.size);
      firecrawlError = outcome.error;
      for (const ad of outcome.ads) if (!byId.has(ad.id)) byId.set(ad.id, toItem(ad));
    }

    // Última redundância: URLs reais observadas na web; Gemini só pode ordenar índices.
    if (byId.size < desired) {
      const { searchAdsWithGeminiGrounding } = await import("@/lib/ml-gemini-search.server");
      const complement = await searchAdsWithGeminiGrounding(query, desired - byId.size).catch(() => [] as SearchMlItem[]);
      addItems(byId, complement);
    }

    const items = Array.from(byId.values())
      .filter((item) => relevance(query, item.title) > 0 || /^Anúncio MLB/i.test(item.title))
      .sort((a, b) => {
        if (a.verified_item !== b.verified_item) return a.verified_item ? -1 : 1;
        return relevance(query, b.title) - relevance(query, a.title);
      })
      .slice(0, desired);

    console.info("[ML public search result]", {
      version: SEARCH_FLOW_VERSION,
      query,
      official_items: officialCount,
      firecrawl_available: firecrawlAvailable,
      final_items: items.length,
    });

    return {
      ok: items.length > 0,
      configured: true,
      reason: items.length
        ? `${items.length} anúncio(s) real(is) do Mercado Livre encontrado(s) para “${query}”.`
        : officialReason && !firecrawlAvailable
          ? `${officialReason} As fontes web de redundância também não retornaram anúncios utilizáveis agora.`
          : firecrawlError
            ? `Nenhuma oferta real pôde ser carregada para “${query}” agora. A coleta principal respondeu sem anúncios válidos e as fontes de redundância também não retornaram links utilizáveis.`
            : `Nenhuma oferta real pôde ser carregada para “${query}” agora. A busca tentou a conta Mercado Livre conectada e as fontes web disponíveis sem fabricar anúncios ou códigos MLB.`,
      items,
    };
  });
