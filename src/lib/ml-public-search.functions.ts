import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serializeMlArray } from "@/lib/ml.functions";
import type { SearchMlItem } from "@/lib/ml-search-production.functions";

const ML_API = "https://api.mercadolibre.com";
const USER_AGENT = "ANUNCIO-ML/1.0";

type SearchResult = {
  ok: boolean;
  configured: true;
  reason: string | null;
  items: SearchMlItem[];
};

async function getTokens(userId: string): Promise<string[]> {
  const { getAppAccessToken, getValidMlAccessToken } = await import("@/lib/ml.server");
  const tokens: string[] = [];

  try {
    const user = await getValidMlAccessToken(userId);
    if (user.ok && user.accessToken) tokens.push(user.accessToken);
  } catch {
    // O token da aplicação ainda pode funcionar para a busca pública.
  }

  try {
    const app = await getAppAccessToken();
    if (app && !tokens.includes(app)) tokens.push(app);
  } catch {
    // A tentativa sem token é feita por último.
  }

  return tokens;
}

function requestHeaders(token?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchMarketplace(url: URL, tokens: string[]) {
  const statuses: number[] = [];

  for (const token of [...tokens, undefined]) {
    try {
      const response = await fetch(url, { headers: requestHeaders(token) });
      statuses.push(response.status);
      if (response.ok) return { response, statuses };
      if (![401, 403].includes(response.status)) return { response, statuses };
    } catch {
      // Tenta a próxima credencial.
    }
  }

  return { response: null, statuses };
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("http://") ? `https://${value.slice(7)}` : value;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokensOf(value: string) {
  const ignored = new Set(["de", "da", "do", "das", "dos", "com", "para", "por", "e", "em", "o", "a"]);
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !ignored.has(token));
}

function relevance(query: string, title: string) {
  const normalizedQuery = normalize(query);
  const normalizedTitle = normalize(title);
  if (!normalizedQuery || !normalizedTitle) return 0;
  if (normalizedTitle.includes(normalizedQuery)) return 100;

  const queryTokens = tokensOf(query);
  if (!queryTokens.length) return 0;
  const matched = queryTokens.filter((token) => normalizedTitle.includes(token)).length;
  return Math.round((matched / queryTokens.length) * 100);
}

function isRelevant(query: string, title: string) {
  const queryTokens = tokensOf(query);
  const score = relevance(query, title);
  if (queryTokens.length <= 1) return score === 100;
  return score >= 50;
}

function mapPublicAd(raw: Record<string, unknown>): SearchMlItem {
  const seller = raw["seller"] as { id?: unknown; nickname?: unknown } | undefined;
  const pictures = Array.isArray(raw["pictures"])
    ? (raw["pictures"] as Array<{ secure_url?: string; url?: string }>)
    : [];
  const images = pictures
    .map((picture) => safeUrl(picture.secure_url ?? picture.url))
    .filter((value): value is string => !!value);

  return {
    id: String(raw["id"] ?? ""),
    title: String(raw["title"] ?? "Anúncio Mercado Livre"),
    price_cents: typeof raw["price"] === "number" ? Math.round(raw["price"] * 100) : null,
    thumbnail: safeUrl(raw["thumbnail"]) ?? images[0] ?? null,
    permalink: safeUrl(raw["permalink"]),
    category: typeof raw["category_id"] === "string" ? raw["category_id"] : null,
    seller: typeof seller?.nickname === "string" ? seller.nickname : null,
    seller_id:
      raw["seller_id"] != null
        ? String(raw["seller_id"])
        : seller?.id != null
          ? String(seller.id)
          : null,
    condition: typeof raw["condition"] === "string" ? raw["condition"] : null,
    available_quantity:
      typeof raw["available_quantity"] === "number" ? raw["available_quantity"] : null,
    sold_quantity: typeof raw["sold_quantity"] === "number" ? raw["sold_quantity"] : null,
    status: typeof raw["status"] === "string" ? raw["status"] : null,
    images,
    attributes: serializeMlArray(raw["attributes"]),
    source_kind: "marketplace",
    verified_item: true,
  };
}

function messageFromStatuses(statuses: number[]) {
  if (statuses.includes(429)) {
    return "O Mercado Livre limitou temporariamente as consultas. Aguarde alguns instantes e tente novamente.";
  }
  if (statuses.includes(401)) {
    return "Não foi possível validar a autorização do Mercado Livre para consultar os anúncios públicos.";
  }
  if (statuses.includes(403)) {
    return "O Mercado Livre não liberou a busca pública por palavra-chave neste momento. Tente novamente ou use o link/ID MLB de um anúncio.";
  }
  return "Não encontramos anúncios públicos relacionados a este termo.";
}

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
    const tokens = await getTokens(context.userId);
    const statuses: number[] = [];
    const collected: SearchMlItem[] = [];

    // A busca principal usa exclusivamente /sites/MLB/search, que retorna anúncios
    // públicos do marketplace. Catálogo (/products/search) não participa deste fluxo.
    for (let offset = 0; offset < desired; offset += 50) {
      const url = new URL(`${ML_API}/sites/MLB/search`);
      url.searchParams.set("q", data.query);
      url.searchParams.set("limit", String(Math.min(50, desired - offset)));
      url.searchParams.set("offset", String(offset));

      const attempt = await fetchMarketplace(url, tokens);
      statuses.push(...attempt.statuses);
      if (!attempt.response?.ok) break;

      const payload = (await attempt.response.json().catch(() => null)) as
        | { results?: Array<Record<string, unknown>> }
        | null;
      const page = payload?.results ?? [];

      for (const raw of page) {
        const item = mapPublicAd(raw);
        if (!item.id || item.price_cents == null || !isRelevant(data.query, item.title)) continue;
        collected.push(item);
      }

      if (page.length < 50) break;
    }

    const unique = Array.from(new Map(collected.map((item) => [item.id, item])).values())
      .sort((a, b) => {
        const relevanceDiff = relevance(data.query, b.title) - relevance(data.query, a.title);
        if (relevanceDiff) return relevanceDiff;
        return (b.sold_quantity ?? -1) - (a.sold_quantity ?? -1);
      })
      .slice(0, desired);

    if (!unique.length) {
      return {
        ok: false,
        configured: true,
        reason: messageFromStatuses(statuses),
        items: [],
      };
    }

    return {
      ok: true,
      configured: true,
      reason: null,
      items: unique,
    };
  });
