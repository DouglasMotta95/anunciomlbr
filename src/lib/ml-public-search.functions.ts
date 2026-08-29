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
 * Entrada única da busca por palavra-chave.
 *
 * A implementação real fica em ml-discovery.server.ts e prioriza a URL pública
 * do próprio Mercado Livre (lista.mercadolivre.com.br/<termo>) antes dos
 * fallbacks oficiais. Manter esta função fina evita a tela /buscar cair por
 * engano nas buscas de "Meus anúncios" ou no catálogo genérico.
 *
 * SEARCH_FLOW_VERSION é proposital: além de documentar a estratégia implantada,
 * ajuda a identificar nos deploys do Lovable se a versão nova da busca chegou.
 */
const SEARCH_FLOW_VERSION = "public-url-v2-2026-08-29";

export const searchMercadoLivrePublicAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        query: z.string().trim().min(1).max(120),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<SearchResult> => {
    const desired = Math.min(Math.max(data.limit ?? 20, 1), 200);
    const query = data.query.trim();

    console.info("[ML public search]", {
      version: SEARCH_FLOW_VERSION,
      query,
      desired,
      strategy: "marketplace-public-url-first",
    });

    const { discoverPublicAds } = await import("@/lib/ml-discovery.server");
    const outcome = await discoverPublicAds(context.userId, query, desired);

    return {
      ok: outcome.ok,
      configured: true,
      reason: outcome.reason,
      items: outcome.items,
    };
  });
