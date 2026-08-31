import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
 * O fluxo tenta Gemini + Google Search Grounding primeiro. Como a chave direta
 * do Gemini pode não existir em todos os deploys, há um fallback server-only que
 * descobre links reais do Mercado Livre em fontes públicas da Web. Em nenhum dos
 * caminhos são inventados preço, vendas, estoque ou métricas comerciais.
 *
 * Buscas explícitas por código MLB, link, vendedor e produto continuam usando
 * os fluxos específicos existentes na tela /buscar.
 */
const SEARCH_FLOW_VERSION = "grounded-web-resilient-v2-2026-08-31";

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

    console.info("[ML public search]", {
      version: SEARCH_FLOW_VERSION,
      query,
      desired,
      strategy: "gemini-grounding-with-public-web-fallback",
    });

    const { searchAdsWithGeminiGrounding } = await import("@/lib/ml-gemini-search.server");
    const items = await searchAdsWithGeminiGrounding(query, desired);

    return {
      ok: items.length > 0,
      configured: true,
      reason: items.length
        ? `${items.length} anúncio(s) do Mercado Livre Brasil encontrado(s) na busca Web.`
        : "A busca Web não conseguiu localizar anúncios individuais do Mercado Livre Brasil para este termo agora. Tente novamente em alguns instantes.",
      items,
    };
  });
