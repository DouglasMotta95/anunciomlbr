import type { SearchMlItem } from "@/lib/ml-search-production.functions";
import { normalizeSearchText } from "@/lib/ml-search-input";
import { discoverMlItemLinksWithGoogle } from "@/lib/ml-google-discovery.server";

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

function toSearchItem(candidate: Awaited<ReturnType<typeof discoverMlItemLinksWithGoogle>>[number]): SearchMlItem | null {
  if (!candidate.url) return null;

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

export async function searchAdsWithGeminiGrounding(query: string, desired = 20): Promise<SearchMlItem[]> {
  const requested = Math.max(5, Math.min(50, Math.max(desired * 2, 20)));
  const grounded = await discoverMlItemLinksWithGoogle(query, requested);

  return grounded
    .map(toSearchItem)
    .filter((item): item is SearchMlItem => item !== null)
    .sort((a, b) => titleScore(query, b.title) - titleScore(query, a.title))
    .slice(0, desired);
}
