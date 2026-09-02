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
 * Coleta principal: Firecrawl raspando a página pública de resultados do Mercado Livre.
 * Complemento: descoberta com auxílio do Gemini apenas para ampliar/ordenar candidatos reais.
 * Nada é inventado: cada item precisa de link real do Mercado Livre com ID MLB.
 */
const SEARCH_FLOW_VERSION = "firecrawl-marketplace-keyword-v4-2026-09-02";

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
  .handler(async ({ data }): Promise<SearchResult> => {
    const desired = Math.min(Math.max(data.limit ?? 20, 1), 50);
    const query = data.query.trim();

    console.info("[ML public search]", { version: SEARCH_FLOW_VERSION, query, desired, strategy: "firecrawl-first" });

    const byId = new Map<string, SearchMlItem>();

    const { firecrawlSearchMercadoLivre, firecrawlConfigured } = await import("@/lib/ml-firecrawl.server");
    const configured = firecrawlConfigured();
    let firecrawlError: string | null = configured ? null : "A coleta de anúncios (Firecrawl) ainda não está conectada neste projeto.";

    if (configured) {
      const outcome = await firecrawlSearchMercadoLivre(query, desired);
      firecrawlError = outcome.error;
      for (const ad of outcome.ads) if (!byId.has(ad.id)) byId.set(ad.id, toItem(ad));
    }

    if (byId.size < desired) {
      // Complemento com descoberta assistida (Gemini/links reais) — nunca fonte única de dados.
      const { searchAdsWithGeminiGrounding } = await import("@/lib/ml-gemini-search.server");
      const complement = await searchAdsWithGeminiGrounding(query, desired).catch(() => [] as SearchMlItem[]);
      for (const item of complement) if (!byId.has(item.id)) byId.set(item.id, item);
    }

    const items = Array.from(byId.values())
      .filter((item) => relevance(query, item.title) > 0 || /^Anúncio MLB/i.test(item.title))
      .sort((a, b) => relevance(query, b.title) - relevance(query, a.title))
      .slice(0, desired);

    return {
      ok: items.length > 0,
      configured: true,
      reason: items.length
        ? `${items.length} anúncio(s) real(is) do Mercado Livre Brasil encontrado(s) para “${query}”.`
        : firecrawlError ?? `Não foi possível carregar as ofertas do Mercado Livre para “${query}” agora.`,
      items,
    };
  });
