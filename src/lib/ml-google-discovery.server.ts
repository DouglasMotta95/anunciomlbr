/** Descoberta server-only de várias ofertas do Mercado Livre por palavra-chave.
 * A palavra digitada (ex.: "iphone") é uma consulta de marketplace, nunca um ID.
 * Esta camada somente coleta URLs reais observadas em páginas consultadas.
 * Nenhum MLB encontrado apenas em texto, query string ou fragmento vira candidato.
 */

import { normalizeItemId, normalizeSearchTerm, normalizeSearchText } from "@/lib/ml-search-input";

const SEARCH_TIMEOUT_MS = 10_000;
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export type GroundedMlCandidate = {
  id: string;
  url: string;
  sourceTitle: string | null;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/");
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function isMercadoLivreUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br") || host === "mercadolivre.com" || host.endsWith(".mercadolivre.com");
  } catch {
    return false;
  }
}

/** O MLB é evidência somente quando aparece no caminho da própria URL real. */
export function mlItemIdFromRealUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!isMercadoLivreUrl(url.toString())) return null;
    const id = normalizeItemId(url.pathname);
    return id && /^MLB\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function directCandidate(value: string, title: string | null = null): GroundedMlCandidate | null {
  if (!isMercadoLivreUrl(value)) return null;
  const id = mlItemIdFromRealUrl(value);
  if (!id) return null;
  const url = new URL(value.replace(/^http:\/\//i, "https://"));
  url.search = "";
  url.hash = "";
  return { id, url: url.toString(), sourceTitle: title?.trim() || null };
}

function queryWords(value: string) {
  return normalizeSearchText(value).split(" ").filter((word) => word.length >= 2);
}

function relevance(query: string, title: string | null) {
  if (!title) return 1;
  const normalizedTitle = normalizeSearchText(title);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedTitle || !normalizedQuery) return 1;
  if (normalizedTitle.includes(normalizedQuery)) return 100;
  const words = queryWords(query);
  if (!words.length) return 1;
  return Math.round((words.filter((word) => normalizedTitle.includes(word)).length / words.length) * 100);
}

function dedupe(candidates: GroundedMlCandidate[], limit: number, query: string) {
  const byId = new Map<string, GroundedMlCandidate>();
  for (const candidate of candidates) {
    const current = byId.get(candidate.id);
    if (!current) {
      byId.set(candidate.id, candidate);
      continue;
    }
    byId.set(candidate.id, {
      id: candidate.id,
      url: current.url,
      sourceTitle: current.sourceTitle && current.sourceTitle.length > 4 ? current.sourceTitle : candidate.sourceTitle,
    });
  }
  return Array.from(byId.values())
    .filter((item) => relevance(query, item.sourceTitle) > 0)
    .sort((a, b) => relevance(query, b.sourceTitle) - relevance(query, a.sourceTitle))
    .slice(0, limit);
}

function unwrapSearchHref(raw: string, base: string): string | null {
  let value = decodeHtml(raw).trim();
  if (!value) return null;
  if (value.startsWith("//")) value = `https:${value}`;
  let resolved: URL;
  try {
    resolved = new URL(value, base);
  } catch {
    return null;
  }
  if (directCandidate(resolved.toString())) return resolved.toString();

  for (const key of ["q", "url", "uddg", "target", "r"]) {
    const nested = resolved.searchParams.get(key);
    if (!nested) continue;
    let decoded = decodeHtml(nested);
    for (let i = 0; i < 3; i += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        break;
      }
    }
    if (directCandidate(decoded)) return decoded;
  }
  return null;
}

export function parseSearchEngineHtml(html: string, base: string) {
  const candidates: GroundedMlCandidate[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = unwrapSearchHref(match[1] ?? "", base);
    if (!href) continue;
    const title = stripHtml(match[2] ?? "").slice(0, 220) || null;
    const candidate = directCandidate(href, title);
    if (candidate) candidates.push(candidate);
  }
  const decoded = decodeHtml(html);
  for (const match of decoded.matchAll(/https?:\/\/(?:[\w-]+\.)?mercadolivre\.com(?:\.br)?\/[^\s<>'"]+/gi)) {
    const candidate = directCandidate(match[0].replace(/[),.;]+$/g, ""));
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

export function parseMarketplaceMarkdown(markdown: string) {
  const candidates: GroundedMlCandidate[] = [];
  for (const match of markdown.matchAll(/\[([^\]]{3,220})\]\((https?:\/\/[^)]+)\)/g)) {
    const title = stripHtml(match[1] ?? "");
    const candidate = directCandidate(match[2] ?? "", title);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

async function fetchText(url: string, accept: string) {
  const response = await fetch(url, {
    headers: { Accept: accept, "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": WEB_UA },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  return response.text();
}

async function discoverFromMarketplaceSearch(query: string, limit: number) {
  const slug = normalizeSearchTerm(query);
  if (!slug) return [] as GroundedMlCandidate[];

  const candidates: GroundedMlCandidate[] = [];
  const marketplaceUrls = [
    `https://lista.mercadolivre.com.br/${encodeURIComponent(slug)}`,
    `https://lista.mercadolivre.com.br/comprar-${encodeURIComponent(slug)}`,
  ];

  for (const marketplaceUrl of marketplaceUrls) {
    const readerUrls = [
      `https://r.jina.ai/${marketplaceUrl}`,
      `https://r.jina.ai/http://${marketplaceUrl.replace(/^https?:\/\//, "")}`,
    ];
    for (const readerUrl of readerUrls) {
      try {
        const markdown = await fetchText(readerUrl, "text/plain");
        if (!markdown) continue;
        candidates.push(...parseMarketplaceMarkdown(markdown));
        if (dedupe(candidates, limit, query).length >= Math.min(limit, 10)) break;
      } catch {}
    }
    if (dedupe(candidates, limit, query).length >= Math.min(limit, 10)) break;
  }

  return dedupe(candidates, limit, query);
}

async function discoverFromSearchEngines(query: string, limit: number) {
  const candidates: GroundedMlCandidate[] = [];
  const scopedQueries = [
    `site:produto.mercadolivre.com.br/MLB ${query}`,
    `site:mercadolivre.com.br/MLB ${query}`,
    `${query} site:produto.mercadolivre.com.br Mercado Livre`,
  ];

  for (const scoped of scopedQueries) {
    const engines = [
      `https://www.google.com/search?q=${encodeURIComponent(scoped)}&num=${Math.min(50, limit * 2)}&hl=pt-BR`,
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(scoped)}`,
      `https://www.bing.com/search?q=${encodeURIComponent(scoped)}&count=${Math.min(50, limit * 2)}`,
    ];
    for (const url of engines) {
      try {
        const html = await fetchText(url, "text/html,application/xhtml+xml");
        if (!html) continue;
        candidates.push(...parseSearchEngineHtml(html, url));
        if (dedupe(candidates, limit, query).length >= limit) return dedupe(candidates, limit, query);
      } catch {}
    }
  }
  return dedupe(candidates, limit, query);
}

/**
 * Descoberta complementar sem geração: devolve somente candidatos cuja URL real
 * foi observada nas páginas consultadas. Gemini não participa desta etapa.
 */
export async function discoverMlItemLinksWithGoogle(query: string, desired = 20): Promise<GroundedMlCandidate[]> {
  const limit = Math.max(5, Math.min(50, desired));
  const marketplace = await discoverFromMarketplaceSearch(query, limit);
  if (marketplace.length >= Math.min(limit, 10)) return marketplace;

  const engines = await discoverFromSearchEngines(query, limit);
  const combined = dedupe([...marketplace, ...engines], limit, query);
  console.info("[ML keyword discovery]", {
    query,
    marketplace_candidates: marketplace.length,
    search_engine_candidates: engines.length,
    final_candidates: combined.length,
    generated_candidates: 0,
  });
  return combined;
}
