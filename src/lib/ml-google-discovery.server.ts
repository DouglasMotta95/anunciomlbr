/** Descoberta server-only de anúncios do Mercado Livre.
 * Primeiro tenta Gemini + Google Search Grounding. Se a chave direta do Gemini
 * não existir no deploy, ou o grounding não retornar itens, usa fontes públicas
 * de busca somente para descobrir links reais do Mercado Livre. Nunca inventa
 * preço, vendas, estoque ou métricas comerciais.
 */

import { normalizeItemId, normalizeSearchTerm } from "@/lib/ml-search-input";

const TIMEOUT_MS = 20_000;
const REDIRECT_TIMEOUT_MS = 6_000;
const SEARCH_TIMEOUT_MS = 9_000;
const MAX_REDIRECTS = 6;
const DEFAULT_MODEL = process.env["GEMINI_SEARCH_MODEL"] || process.env["GEMINI_MODEL"] || "gemini-2.5-flash";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type GroundingWeb = { uri?: string; title?: string };
type GeminiGroundingPayload = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: GroundingWeb }>;
    };
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
  const digits = id.replace(/^MLB/i, "");
  return `https://produto.mercadolivre.com.br/MLB-${digits}`;
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
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
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

function dedupe(candidates: GroundedMlCandidate[], limit: number) {
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
  return Array.from(byId.values()).filter((item) => !!item.url).slice(0, limit);
}

async function resolveGroundingUri(value: string, title: string | null): Promise<GroundedMlCandidate | null> {
  const direct = directCandidate(value, title);
  if (direct) return direct;

  let current = value;
  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return null;
    }

    const host = parsed.hostname.toLowerCase();
    const allowedRedirectHost = host === "vertexaisearch.cloud.google.com" || host.endsWith(".google.com") || host.endsWith(".googleusercontent.com");
    if (!allowedRedirectHost) return null;

    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": WEB_UA },
        signal: AbortSignal.timeout(REDIRECT_TIMEOUT_MS),
      });

      const location = response.headers.get("location");
      if (!location) return directCandidate(response.url, title);

      current = new URL(location, current).toString();
      const candidate = directCandidate(current, title);
      if (candidate) return candidate;
    } catch {
      return null;
    }
  }

  return null;
}

function parseStructuredLines(text: string) {
  const parsed: GroundedMlCandidate[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/\b(MLB[\s-]?\d{6,})\b\s*(?:\|\|\||\||-|—|:)\s*(.*)$/i);
    if (!match) continue;

    const id = normalizeItemId(match[1] ?? "");
    if (!id || !/^MLB\d+$/.test(id)) continue;

    const rest = (match[2] ?? "").trim();
    const parts = rest.split(/\s*\|\|\|\s*/);
    const title = (parts[0] ?? "").replace(/^t[ií]tulo\s*[:=-]?\s*/i, "").trim();
    const urlPart = parts.find((part) => /https?:\/\//i.test(part)) ?? "";
    const direct = urlPart ? directCandidate(urlPart.trim(), title || null) : null;
    parsed.push(direct ?? idCandidate(id, title || null)!);
  }
  return parsed;
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
      } catch {
        break;
      }
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

function parseReaderMarkdown(markdown: string) {
  const candidates: GroundedMlCandidate[] = [];
  for (const match of markdown.matchAll(/\[([^\]]{3,220})\]\((https?:\/\/[^)]+)\)/g)) {
    const candidate = directCandidate(match[2] ?? "", stripHtml(match[1] ?? ""));
    if (candidate) candidates.push(candidate);
  }
  for (const match of markdown.matchAll(/https?:\/\/(?:[\w-]+\.)?mercadolivre\.com(?:\.br)?\/[^\s)>'"]+/gi)) {
    const candidate = directCandidate(match[0].replace(/[),.;]+$/g, ""));
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

async function discoverFromPublicWeb(query: string, limit: number) {
  const slug = normalizeSearchTerm(query);
  const candidates: GroundedMlCandidate[] = [];

  if (slug) {
    const readerUrl = `https://r.jina.ai/https://lista.mercadolivre.com.br/${encodeURIComponent(slug)}`;
    try {
      const response = await fetch(readerUrl, {
        headers: { Accept: "text/plain", "User-Agent": WEB_UA },
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      });
      if (response.ok) {
        candidates.push(...parseReaderMarkdown(await response.text()));
        console.info("[ML public web discovery]", { source: "reader", status: response.status, candidates: candidates.length });
      } else {
        console.info("[ML public web discovery]", { source: "reader", status: response.status, candidates: 0 });
      }
    } catch {
      console.info("[ML public web discovery]", { source: "reader", status: "network_error", candidates: 0 });
    }
  }

  if (candidates.length < limit) {
    const scoped = `${query} Mercado Livre Brasil MLB`;
    const engines = [
      `https://www.google.com/search?q=${encodeURIComponent(scoped)}&num=${Math.min(50, limit * 2)}&hl=pt-BR`,
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(scoped)}`,
      `https://www.bing.com/search?q=${encodeURIComponent(scoped)}&count=${Math.min(50, limit * 2)}`,
    ];

    for (const url of engines) {
      try {
        const response = await fetch(url, {
          headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "pt-BR,pt;q=0.9", "User-Agent": WEB_UA },
          signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
        });
        if (!response.ok) continue;
        candidates.push(...parseSearchEngineHtml(await response.text(), url));
        if (dedupe(candidates, limit).length >= limit) break;
      } catch {}
    }
  }

  return dedupe(candidates, limit);
}

async function discoverWithGemini(query: string, limit: number) {
  const key = apiKey();
  if (!key) {
    console.info("[ML google discovery]", { status: "not_configured", candidates: 0 });
    return [] as GroundedMlCandidate[];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: `Pesquise na Web por anúncios INDIVIDUAIS e atuais do Mercado Livre Brasil relacionados exatamente a: ${JSON.stringify(query)}.\n` +
                `Use somente resultados da Pesquisa Google que correspondam a páginas de anúncio do Mercado Livre Brasil. Não use categoria, lista, blog, ajuda ou outros sites. ` +
                `Encontre até ${limit} anúncios diferentes e relevantes. Para CADA anúncio escreva uma linha exatamente no formato: ` +
                `MLB1234567890 ||| TÍTULO EXATO DO ANÚNCIO ||| URL EXATO SE APARECER NA FONTE. ` +
                `O título precisa ser específico daquele anúncio, nunca uma frase sobre a busca. Não invente URLs nem IDs; use somente IDs, títulos e URLs que aparecerem nas fontes da Pesquisa Google.`,
            }],
          }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0, maxOutputTokens: 4096 },
        }),
      },
    );

    if (!response.ok) {
      console.info("[ML google discovery]", { status: response.status, candidates: 0 });
      return [];
    }

    const payload = await response.json() as GeminiGroundingPayload;
    const candidates: GroundedMlCandidate[] = [];
    for (const candidate of payload.candidates ?? []) {
      const text = candidate.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
      const structured = parseStructuredLines(text);
      const titleById = new Map(structured.map((item) => [item.id, item.sourceTitle]));
      candidates.push(...structured);

      const groundedSources = candidate.groundingMetadata?.groundingChunks ?? [];
      const resolved = await Promise.all(
        groundedSources.slice(0, limit * 2).map(async (chunk) => {
          const uri = chunk.web?.uri;
          if (!uri) return null;
          const item = await resolveGroundingUri(uri, chunk.web?.title ?? null);
          if (!item) return null;
          const specificTitle = titleById.get(item.id);
          return specificTitle ? { ...item, sourceTitle: specificTitle } : item;
        }),
      );
      for (const item of resolved) if (item) candidates.push(item);

      for (const match of text.matchAll(/https?:\/\/[^\s<>()"']+/gi)) {
        const parsed = directCandidate(match[0].replace(/[\].,;:!?]+$/g, ""));
        if (parsed) candidates.push(parsed);
      }
      for (const match of text.matchAll(/\bMLB[\s-]?(\d{6,})\b/gi)) {
        const id = `MLB${match[1]}`;
        const parsed = idCandidate(id, titleById.get(id) ?? null);
        if (parsed) candidates.push(parsed);
      }
    }

    const unique = dedupe(candidates, limit);
    console.info("[ML google discovery]", { status: response.status, candidates: unique.length });
    return unique;
  } catch (error) {
    console.info("[ML google discovery]", { status: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error", candidates: 0 });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverMlItemLinksWithGoogle(query: string, desired = 20): Promise<GroundedMlCandidate[]> {
  const limit = Math.max(5, Math.min(50, desired));
  const grounded = await discoverWithGemini(query, limit);
  if (grounded.length >= Math.min(limit, 5)) return grounded.slice(0, limit);

  const publicWeb = await discoverFromPublicWeb(query, limit);
  const combined = dedupe([...grounded, ...publicWeb], limit);
  console.info("[ML discovery summary]", {
    gemini_candidates: grounded.length,
    public_web_candidates: publicWeb.length,
    final_candidates: combined.length,
  });
  return combined;
}
