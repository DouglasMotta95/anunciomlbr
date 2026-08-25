import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MlItem = {
  id: string;
  title: string;
  price_cents: number | null;
  thumbnail: string | null;
  permalink: string | null;
  category: string | null;
  seller: string | null;
  condition: string | null;
  available_quantity: number | null;
  sold_quantity: number | null;
};

/**
 * Busca anúncios usando a API pública oficial do Mercado Livre.
 * Quando a API exige credenciais e elas não estão configuradas,
 * devolvemos `configured: false` em vez de simular resultados.
 */
export const searchMercadoLivre = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        query: z.string().min(1).max(120),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const token = process.env["ML_ACCESS_TOKEN"];
    const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(
      data.query,
    )}&limit=${data.limit ?? 20}`;

    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false as const,
          configured: false,
          reason:
            "Configuração pendente: a busca oficial do Mercado Livre requer credenciais de aplicação.",
          items: [] as MlItem[],
        };
      }
      if (!response.ok) {
        return {
          ok: false as const,
          configured: true,
          reason: `A API do Mercado Livre respondeu ${response.status}.`,
          items: [] as MlItem[],
        };
      }

      const payload = (await response.json()) as {
        results?: Array<Record<string, unknown>>;
      };

      const items: MlItem[] = (payload.results ?? []).map((raw) => {
        const seller = raw["seller"] as { nickname?: string } | undefined;
        const price = typeof raw["price"] === "number" ? (raw["price"] as number) : null;
        return {
          id: String(raw["id"] ?? ""),
          title: String(raw["title"] ?? ""),
          price_cents: price === null ? null : Math.round(price * 100),
          thumbnail: (raw["thumbnail"] as string) ?? null,
          permalink: (raw["permalink"] as string) ?? null,
          category: (raw["category_id"] as string) ?? null,
          seller: seller?.nickname ?? null,
          condition: (raw["condition"] as string) ?? null,
          available_quantity: (raw["available_quantity"] as number) ?? null,
          sold_quantity: (raw["sold_quantity"] as number) ?? null,
        };
      });

      return { ok: true as const, configured: true, items, reason: null };
    } catch (error) {
      console.error("ML search failed", error);
      return {
        ok: false as const,
        configured: true,
        reason: "Não foi possível consultar o Mercado Livre agora.",
        items: [] as MlItem[],
      };
    }
  });

/** Monta a URL de autorização OAuth oficial do Mercado Livre. */
export const getMlAuthorizationUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = process.env["ML_CLIENT_ID"];
    const redirectUri = process.env["ML_REDIRECT_URI"];
    if (!clientId || !redirectUri) {
      return { configured: false as const, url: null };
    }
    const url = new URL("https://auth.mercadolivre.com.br/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", context.userId);
    return { configured: true as const, url: url.toString() };
  });

/** Estado da conexão do usuário com o Mercado Livre. */
export const getMlConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ml_connections")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const configured = !!process.env["ML_CLIENT_ID"] && !!process.env["ML_REDIRECT_URI"];
    return { configured, connection: data ?? null };
  });
