import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serializeMlArray } from "@/lib/ml.functions";
import type { SearchMlItem } from "@/lib/ml-search-production.functions";

const ML_API = "https://api.mercadolibre.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";

type SearchResult = {
  ok: boolean;
  configured: true;
  reason: string | null;
  items: SearchMlItem[];
};

type FetchAttempt = {
  response: Response | null;
  statuses: number[];
};

type DomainDiscoveryRow = {
  category_id?: unknown;
};

async function getTokens(userId: string): Promise<string[]> {
  const { getAppAccessToken, getValidMlAccessToken } = await import("@/lib/ml.server");
  const tokens: string[] = [];

  try {
    const user = await getValidMlAccessToken(userId);
    if (user.ok && user.accessToken) tokens.push(user.accessToken);
  } catch {}

  try {
    const app = await getAppAccessToken();
    if (app && !tokens.includes(app)) tokens.push(app);
  } catch {}

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

async function mlFetch(url: string | URL, tokens: string[]): Promise<FetchAttempt> {
  const statuses: number[] = [];
  let last: Response | null = null;

  for (const token of tokens) {
    try {
      const response = await fetch(url, { headers: requestHeaders(token) });
      statuses.push(response.status);
      last = response;
      if (response.ok) return { response, statuses };
      if (![401, 403].includes(response.status)) return { response, statuses };
    } catch {}
  }

  try {
    const response = await fetch(url, { headers: requestHeaders() });
    statuses.push(response.status);
    last = response;
    return { response, statuses };
  } catch {
    return { response: last, statuses };
  }
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
  const ignored = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "com",
    "para",
    "por",
    "e",
    "em",
    "o",
    "a",
  ]);
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
  return score >= 60;
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

function appendRelevant(
  target: SearchMlItem[],
  rows: Array<Record<string, unknown>>,
  query: string,
) {
  for (const raw of rows) {
    const item = mapPublicAd(raw);
    if (!item.id || item.price_cents == null || !isRelevant(query, item.title)) continue;
    target.push(item);
  }
}

async function searchByKeywordDirect(
  query: string,
  desired: number,
  tokens: string[],
): Promise<{ items: SearchMlItem[]; statuses: number[] }> {
  const statuses: number[] = [];
  const items: SearchMlItem[] = [];

  for (let offset = 0; offset < Math.min(desired, 200); offset += 50) {
    const url = new URL(`${ML_API}/sites/MLB/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(Math.min(50, desired - offset)));
    url.searchParams.set("offset", String(offset));

    const attempt = await mlFetch(url, tokens);
    statuses.push(...attempt.statuses);
    if (!attempt.response?.ok) break;

    const payload = (await attempt.response.json().catch(() => null)) as
      | { results?: Array<Record<string, unknown>> }
      | null;
    const rows = payload?.results ?? [];
    appendRelevant(items, rows, query);
    if (rows.length < 50) break;
  }

  return { items, statuses };
}

async function discoverCategories(query: string, tokens: string[]) {
  const url = new URL(`${ML_API}/sites/MLB/domain_discovery/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");

  const attempt = await mlFetch(url, tokens);
  if (!attempt.response?.ok) {
    return { categories: [] as string[], statuses: attempt.statuses };
  }

  const payload = (await attempt.response.json().catch(() => [])) as DomainDiscoveryRow[];
  const categories = Array.from(
    new Set(
      payload
        .map((row) => (typeof row.category_id === "string" ? row.category_id : null))
        .filter((value): value is string => !!value),
    ),
  );

  return { categories, statuses: attempt.statuses };
}

async function searchByDiscoveredCategories(
  query: string,
  desired: number,
  tokens: string[],
): Promise<{ items: SearchMlItem[]; statuses: number[] }> {
  const discovery = await discoverCategories(query, tokens);
  const statuses = [...discovery.statuses];
  const items: SearchMlItem[] = [];

  for (const category of discovery.categories.slice(0, 5)) {
    for (let offset = 0; offset < 250 && items.length < desired * 3; offset += 50) {
      const url = new URL(`${ML_API}/sites/MLB/search`);
      url.searchParams.set("category", category);
      url.searchParams.set("limit", "50");
      url.searchParams.set("offset", String(offset));

      const attempt = await mlFetch(url, tokens);
      statuses.push(...attempt.statuses);
      if (!attempt.response?.ok) break;

      const payload = (await attempt.response.json().catch(() => null)) as
        | { results?: Array<Record<string, unknown>> }
        | null;
      const rows = payload?.results ?? [];
      appendRelevant(items, rows, query);
      if (rows.length < 50) break;
    }

    if (items.length >= desired) break;
  }

  return { items, statuses };
}

function extractMlbIds(html: string) {
  const ids = new Set<string>();
  const patterns = [
    /MLB-?(\d{8,15})/gi,
    /item_id["'=:%\s]+MLB-?(\d{8,15})/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      ids.add(`MLB${match[1]}`);
      if (ids.size >= 100) break;
    }
  }

  return [...ids];
}

async function fetchSearchEngineHtml(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
      },
      redirect: "follow",
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

async function hydrateItemIds(ids: string[], query: string, tokens: string[]) {
  const output: SearchMlItem[] = [];
  const unique = Array.from(new Set(ids)).slice(0, 80);

  for (let index = 0; index < unique.length; index += 20) {
    const chunk = unique.slice(index, index + 20);
    const url = new URL(`${ML_API}/items`);
    url.searchParams.set("ids", chunk.join(","));
    url.searchParams.set(
      "attributes",
      "id,title,price,thumbnail,permalink,category_id,seller_id,seller,condition,available_quantity,sold_quantity,status,pictures,attributes",
    );

    const attempt = await mlFetch(url, tokens);
    if (!attempt.response?.ok) continue;

    const rows = (await attempt.response.json().catch(() => [])) as Array<{
      code?: number;
      body?: Record<string, unknown>;
    }>;

    for (const row of rows) {
      if (row.code !== 200 || !row.body) continue;
      const item = mapPublicAd(row.body);
      if (!item.id || item.price_cents == null || !isRelevant(query, item.title)) continue;
      if (item.status && item.status !== "active") continue;
      output.push(item);
    }
  }

  return output;
}

async function searchPublicWeb(
  query: string,
  tokens: string[],
): Promise<SearchMlItem[]> {
  const encoded = encodeURIComponent(`site:mercadolivre.com.br ${query} MLB`);
  const engines = [
    `https://www.bing.com/search?q=${encoded}&count=50&setlang=pt-BR`,
    `https://html.duckduckgo.com/html/?q=${encoded}`,
  ];

  const pages = await Promise.all(engines.map(fetchSearchEngineHtml));
  const ids = Array.from(new Set(pages.flatMap(extractMlbIds)));
  if (!ids.length) return [];

  return hydrateItemIds(ids, query, tokens);
}

function rankAndUnique(items: SearchMlItem[], query: string, desired: number) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
    .sort((a, b) => {
      const relevanceDiff = relevance(query, b.title) - relevance(query, a.title);
      if (relevanceDiff) return relevanceDiff;
      return (b.sold_quantity ?? -1) - (a.sold_quantity ?? -1);
    })
    .slice(0, desired);
}

function messageFromStatuses(statuses: number[]) {
  if (statuses.includes(429)) {
    return "O Mercado Livre limitou temporariamente as consultas. Aguarde alguns instantes e tente novamente.";
  }
  if (statuses.includes(401)) {
    return "A autorização do Mercado Livre precisa ser renovada para validar os anúncios encontrados.";
  }
  return "Não encontramos anúncios públicos reais para este termo nas fontes disponíveis agora.";
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

    const direct = await searchByKeywordDirect(data.query, desired, tokens);
    const statuses = [...direct.statuses];
    let combined = [...direct.items];
    let source: "direct" | "category" | "web" = direct.items.length ? "direct" : "category";

    if (combined.length < desired) {
      const alternative = await searchByDiscoveredCategories(data.query, desired, tokens);
      statuses.push(...alternative.statuses);
      if (alternative.items.length) source = direct.items.length ? source : "category";
      combined.push(...alternative.items);
    }

    if (rankAndUnique(combined, data.query, desired).length < Math.min(desired, 10)) {
      const webItems = await searchPublicWeb(data.query, tokens);
      if (webItems.length && !direct.items.length) source = "web";
      combined.push(...webItems);
    }

    const items = rankAndUnique(combined, data.query, desired);
    if (!items.length) {
      return {
        ok: false,
        configured: true,
        reason: messageFromStatuses(statuses),
        items: [],
      };
    }

    const reason =
      source === "web"
        ? "Anúncios públicos encontrados na web e validados individualmente pela API oficial do Mercado Livre."
        : source === "category"
          ? "Anúncios públicos reais encontrados por categorias relacionadas ao termo pesquisado."
          : null;

    return {
      ok: true,
      configured: true,
      reason,
      items,
    };
  });
