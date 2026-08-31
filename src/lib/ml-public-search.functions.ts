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
 * Uma entrada como "iphone" é uma consulta de marketplace e deve trazer várias
 * ofertas relacionadas, como a busca pública do Mercado Livre. A descoberta
 * prioriza a página de resultados do ML e usa Gemini / mecanismos de busca como
 * complemento, sem tratar a palavra como código e sem inventar métricas.
 *
 * Buscas explícitas por código MLB, link, vendedor e produto continuam usando
 * os fluxos específicos existentes na tela /buscar.
 */
const SEARCH_FLOW_VERSION = "marketplace-keyword-multi-offer-v3-2026-08-31";

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
      strategy: "marketplace-keyword-multi-offer",
    });

    const { searchAdsWithGeminiGrounding } = await import("@/lib/ml-gemini-search.server");
    const items = await searchAdsWithGeminiGrounding(query, desired);

    return {
      ok: items.length > 0,
      configured: true,
      reason: items.length
        ? `${items.length} oferta(s) do Mercado Livre Brasil encontrada(s) para “${query}”.`
        : `Não foi possível carregar as ofertas do Mercado Livre para “${query}” agora.`,
      items,
    };
  });
