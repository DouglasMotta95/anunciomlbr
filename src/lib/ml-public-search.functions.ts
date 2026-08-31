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
 * O Mercado Livre vem bloqueando a confirmação pública de itens em algumas
 * integrações. Para não deixar a busca inutilizável, a busca comum usa o Gemini
 * com Google Search Grounding para descobrir anúncios reais do Mercado Livre
 * Brasil e exibi-los diretamente. A IA não preenche preço, vendas ou estoque
 * quando esses dados não estão disponíveis na fonte grounded.
 *
 * Buscas explícitas por código MLB, link, vendedor e produto continuam usando
 * os fluxos específicos existentes na tela /buscar.
 */
const SEARCH_FLOW_VERSION = "gemini-grounded-only-v1-2026-08-31";

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
      strategy: "gemini-google-grounding-only",
    });

    const { searchAdsWithGeminiGrounding } = await import("@/lib/ml-gemini-search.server");
    const items = await searchAdsWithGeminiGrounding(query, desired);

    return {
      ok: items.length > 0,
      configured: true,
      reason: items.length
        ? `${items.length} anúncio(s) encontrado(s) pelo Gemini na Pesquisa Google, com links do Mercado Livre Brasil.`
        : "O Gemini não encontrou anúncios individuais acessíveis do Mercado Livre Brasil para este termo. Tente uma descrição um pouco mais específica.",
      items,
    };
  });
