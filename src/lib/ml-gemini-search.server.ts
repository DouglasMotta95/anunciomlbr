import type { SearchMlItem } from "@/lib/ml-search-production.functions";
import { normalizeSearchText } from "@/lib/ml-search-input";
import { discoverMlItemLinksWithGoogle } from "@/lib/ml-google-discovery.server";
import { geminiGenerateJson } from "@/lib/gemini.server";

const GENERIC_TITLES = new Set([
  "mercado livre",
  "mercadolivre",
  "mercado libre",
  "mercadolibre",
]);

function cleanSourceTitle(value: string | null, id: string) {
  const title = (value ?? "").replace(/\s+/g, " ").trim();
  const normalized = normalizeSearchText(title);
  if (!title || GENERIC_TITLES.has(normalized)) return `Anúncio ${id}`;
  return title.slice(0, 220);
}

function queryWords(value: string) {
  return normalizeSearchText(value)
    .split(" ")
    .filter((word) => word.length >= 2);
}

function titleScore(query: string, title: string) {
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(title);
  if (!q || !t) return 0;
  if (t.includes(q)) return 100;
  const words = queryWords(query);
  if (!words.length) return 0;
  return Math.round((words.filter((word) => t.includes(word)).length / words.length) * 100);
}

function toSearchItem(candidate: Awaited<ReturnType<typeof discoverMlItemLinksWithGoogle>>[number]): SearchMlItem {
  return {
    id: candidate.id,
    title: cleanSourceTitle(candidate.sourceTitle, candidate.id),
    price_cents: null,
    thumbnail: null,
    permalink: candidate.url,
    category: null,
    seller: null,
    condition: null,
    available_quantity: null,
    sold_quantity: null,
    status: null,
    images: [],
    attributes: [],
    source_kind: "marketplace",
    seller_id: null,
    verified_item: false,
  };
}

/**
 * Aplica uma ordenação devolvida por IA exclusivamente sobre itens já existentes.
 * Índices inválidos, repetidos ou extras são descartados e nunca criam candidatos.
 */
export function applyCandidateOrder<T>(candidates: T[], indexes: unknown, desired: number): T[] {
  const ordered: T[] = [];
  const seen = new Set<number>();
  if (Array.isArray(indexes)) {
    for (const value of indexes) {
      if (!Number.isInteger(value)) continue;
      const index = Number(value);
      if (index < 0 || index >= candidates.length || seen.has(index)) continue;
      seen.add(index);
      ordered.push(candidates[index]!);
      if (ordered.length >= desired) return ordered;
    }
  }
  for (let index = 0; index < candidates.length && ordered.length < desired; index += 1) {
    if (seen.has(index)) continue;
    ordered.push(candidates[index]!);
  }
  return ordered;
}

async function rankWithGemini(query: string, items: SearchMlItem[], desired: number) {
  if (items.length <= 1) return items.slice(0, desired);
  const payload = items.map((item, index) => ({ index, title: item.title }));
  const response = await geminiGenerateJson<{ indexes?: unknown }>(
    `Ordene os candidatos abaixo por relevância para a busca ${JSON.stringify(query)}. ` +
      `Responda SOMENTE JSON no formato {"indexes":[0,1,2]}. ` +
      `Você não pode criar, alterar ou sugerir IDs, URLs, títulos ou novos candidatos. ` +
      `Use apenas índices presentes nesta lista:\n${JSON.stringify(payload)}`,
    { temperature: 0, maxOutputTokens: 512 },
  );
  if (!response.ok) return items.slice().sort((a, b) => titleScore(query, b.title) - titleScore(query, a.title)).slice(0, desired);
  return applyCandidateOrder(items, response.result.indexes, desired);
}

export async function searchAdsWithGeminiGrounding(query: string, desired = 20): Promise<SearchMlItem[]> {
  const requested = Math.max(5, Math.min(50, Math.max(desired * 2, 20)));
  const discovered = await discoverMlItemLinksWithGoogle(query, requested);
  const items = discovered.map(toSearchItem);
  return rankWithGemini(query, items, desired);
}
