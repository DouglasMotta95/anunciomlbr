/** Descoberta server-only de várias ofertas do Mercado Livre por palavra-chave.
 * A palavra digitada (ex.: "iphone") é uma consulta de marketplace, nunca um ID.
 * Priorizamos a página pública de resultados do Mercado Livre e usamos Gemini /
 * mecanismos de busca apenas como descoberta complementar de URLs reais.
 */

import { normalizeItemId, normalizeSearchTerm, normalizeSearchText } from "@/lib/ml-search-input";

const TIMEOUT_MS = 20_000;
const SEARCH_TIMEOUT_MS = 10_000;
const REDIRECT_TIMEOUT_MS = 6_000;
const MAX_REDIRECTS = 6;
const DEFAULT_MODEL = process.env["GEMINI_SEARCH_MODEL"] || process.env["GEMINI_MODEL"] || "gemini-2.5-flash";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type GroundingWeb = { uri?: string; title?: string };
type GeminiGroundingPayload = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: { groundingChunks?: Array<{ web?: GroundingWeb }> };
  }>;
};

export type GroundedMlCandidate = {
  id: string;
  url: string | null;
  sourceTitle: string | null;
};

function apiKey() {
  return process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || null;
}

function canonicalItemUrl(id: string) {
  return `https://produto.mercadolivre.com.br/MLB-${id.replace(/^MLB/i, "")}`;
}

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

function directCandidate(value: string, title: string | null = null): GroundedMlCandidate | null {
  if (!isMercadoLivreUrl(value)) return null;
  const id = normalizeItemId(value);
  if (!id || !/^MLB\d+$/.test(id)) return null;
  return { id, url: value.replace(/^http:\/\//i, "https://"), sourceTitle: title?.trim() || null };
}

function idCandidate(value: string, title: string | null = null): GroundedMlCandidate | null {
  const id = normalizeItemId(value);
  if (!id || !/^MLB\d+$/.test(id)) return null;
  return { id, url: canonicalItemUrl(id), sourceTitle: title?.trim() || null };
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
      url: current.url ?? candidate.url,
      sourceTitle: current.sourceTitle && current.sourceTitle.length > 4 ? current.sourceTitle : candidate.sourceTitle,
    });
  }
  return Array.from(byId.values())
    .filter((item) => !!item.url)
    .filter((item) => relevance(query, item.sourceTitle) > 0)
    .sort((a, b) => relevance(query, b.sourceTitle) - relevance(query, a.sourceTitle))
    .slice(0, limit);
}

function unwrapSearchHref(raw: string, base: string): string | null {
  let value = decodeHtml(raw).trim();
  if (!value) return null;
  if (value.startsWith("//")) value = `https:${value}`;
  let resolved: URL;
  try { resolved = new URL(value, base); } catch { return null; }
  if (isMercadoLivreUrl(resolved.toString())) return resolved.toString();

  for (const key of ["q", "url", "uddg", "target", "r"]) {
    const nested = resolved.searchParams.get(key);
    if (!nested) continue;
    let decoded = decodeHtml(nested);
    for (let i = 0; i < 3; i += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch { break; }
    }
    if (isMercadoLivreUrl(decoded)) return decoded;
  }
  return null;
}

function parseSearchEngineHtml(html: string, base: string) {
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

function parseMarketplaceMarkdown(markdown: string) {
  const candidates: GroundedMlCandidate[] = [];
  for (const match of markdown.matchAll(/\[([^\]]{3,220})\]\((https?:\/\/[^)]+)\)/g)) {
    const title = stripHtml(match[1] ?? "");
    const candidate = directCandidate(match[2] ?? "", title);
    if (candidate) candidates.push(candidate);
  }

  // Jina às vezes preserva o MLB no texto mesmo quando o link é simplificado.
  for (const match of markdown.matchAll(/\b(MLB[\s-]?\d{6,})\b/gi)) {
    const candidate = idCandidate(match[1] ?? "");
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

  // A página de resultados é a fonte semântica principal: palavra-chave => várias ofertas.
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

function parseStructuredLines(text: string) {
  const parsed: GroundedMlCandidate[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/\b(MLB[\s-]?\d{6,})\b\s*(?:\|\|\||\||-|—|:)\s*(.*)$/i);
    if (!match) continue;
    const id = normalizeItemId(match[1] ?? "");
    if (!id) continue;
    const parts = (match[2] ?? "").trim().split(/\s*\|\|\|\s*/);
    const title = (parts[0] ?? "").replace(/^t[ií]tulo\s*[:=-]?\s*/i, "").trim();
    const urlPart = parts.find((part) => /https?:\/\//i.test(part)) ?? "";
    parsed.push((urlPart ? directCandidate(urlPart.trim(), title || null) : null) ?? idCandidate(id, title || null)!);
  }
  return parsed;
}

async function resolveGroundingUri(value: string, title: string | null) {
  const direct = directCandidate(value, title);
  if (direct) return direct;
  let current = value;
  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    let parsed: URL;
    try { parsed = new URL(current); } catch { return null; }
    const host = parsed.hostname.toLowerCase();
    if (!(host === "vertexaisearch.cloud.google.com" || host.endsWith(".google.com") || host.endsWith(".googleusercontent.com"))) return null;
    try {
      const response = await fetch(current, { method: "GET", redirect: "manual", headers: { "User-Agent": WEB_UA }, signal: AbortSignal.timeout(REDIRECT_TIMEOUT_MS) });
      const location = response.headers.get("location");
      if (!location) return directCandidate(response.url, title);
      current = new URL(location, current).toString();
      const candidate = directCandidate(current, title);
      if (candidate) return candidate;
    } catch { return null; }
  }
  return null;
}

async function discoverWithGemini(query: string, limit: number) {
  const key = apiKey();
  if (!key) return [] as GroundedMlCandidate[];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text:
          `Faça uma busca de MARKETPLACE por ${JSON.stringify(query)} no Mercado Livre Brasil. ` +
          `A entrada é uma PALAVRA-CHAVE, não um código MLB. Encontre VÁRIOS anúncios/ofertas diferentes cujo título contenha ou seja claramente relacionado ao termo, como os resultados de lista.mercadolivre.com.br/${normalizeSearchTerm(query)}. ` +
          `Retorne até ${limit} ofertas diferentes. Para cada oferta use uma linha: MLB1234567890 ||| TÍTULO DO ANÚNCIO ||| URL. ` +
          `Use apenas URLs/IDs encontrados nas fontes do Google Search; não invente dados comerciais.` }]}],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0, maxOutputTokens: 4096 },
      }),
    });
    if (!response.ok) return [];
    const payload = await response.json() as GeminiGroundingPayload;
    const candidates: GroundedMlCandidate[] = [];
    for (const candidate of payload.candidates ?? []) {
      const text = candidate.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
      const structured = parseStructuredLines(text);
      candidates.push(...structured);
      const titleById = new Map(structured.map((item) => [item.id, item.sourceTitle]));
      const resolved = await Promise.all((candidate.groundingMetadata?.groundingChunks ?? []).slice(0, limit * 3).map(async (chunk) => {
        const uri = chunk.web?.uri;
        if (!uri) return null;
        const item = await resolveGroundingUri(uri, chunk.web?.title ?? null);
        if (!item) return null;
        return { ...item, sourceTitle: titleById.get(item.id) ?? item.sourceTitle };
      }));
      for (const item of resolved) if (item) candidates.push(item);
    }
    return dedupe(candidates, limit, query);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverMlItemLinksWithGoogle(query: string, desired = 20): Promise<GroundedMlCandidate[]> {
  const limit = Math.max(5, Math.min(50, desired));

  const marketplace = await discoverFromMarketplaceSearch(query, limit);
  if (marketplace.length >= Math.min(limit, 10)) return marketplace;

  const [gemini, engines] = await Promise.all([
    discoverWithGemini(query, limit),
    discoverFromSearchEngines(query, limit),
  ]);

  const combined = dedupe([...marketplace, ...gemini, ...engines], limit, query);
  console.info("[ML keyword discovery]", {
    query,
    marketplace_candidates: marketplace.length,
    gemini_candidates: gemini.length,
    search_engine_candidates: engines.length,
    final_candidates: combined.length,
  });
  return combined;
}
