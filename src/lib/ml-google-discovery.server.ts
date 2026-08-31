/** Descoberta server-only de links reais do Mercado Livre via Google Search Grounding.
 * Usada apenas quando a busca pública de itens do Mercado Livre está restrita.
 * Esta função NÃO gera dados comerciais: ela só devolve URLs/IDs encontrados nas
 * fontes da Pesquisa Google. Título, preço, vendas etc. precisam ser confirmados
 * pela API do Mercado Livre antes de aparecerem no produto.
 */

import { normalizeItemId } from "@/lib/ml-search-input";

const TIMEOUT_MS = 20_000;
const REDIRECT_TIMEOUT_MS = 6_000;
const MAX_REDIRECTS = 6;
const DEFAULT_MODEL = process.env["GEMINI_SEARCH_MODEL"] || process.env["GEMINI_MODEL"] || "gemini-2.5-flash";

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
  return { id, url: null, sourceTitle: title?.trim() || null };
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
        headers: {
          Accept: "text/html,application/xhtml+xml",
          Range: "bytes=0-0",
          "User-Agent": "ANUNCIO-ML/1.0",
        },
        signal: AbortSignal.timeout(REDIRECT_TIMEOUT_MS),
      });

      const location = response.headers.get("location");
      if (!location) {
        const final = directCandidate(response.url, title);
        return final;
      }

      current = new URL(location, current).toString();
      const candidate = directCandidate(current, title);
      if (candidate) return candidate;
    } catch {
      return null;
    }
  }

  return null;
}

export async function discoverMlItemLinksWithGoogle(query: string, desired = 20): Promise<GroundedMlCandidate[]> {
  const key = apiKey();
  if (!key) return [];

  const limit = Math.max(5, Math.min(50, desired));
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
              text: `Pesquise na Web por anúncios INDIVIDUAIS e atuais do Mercado Livre Brasil relacionados a: ${JSON.stringify(query)}.\n` +
                `Use somente páginas de anúncio do domínio mercadolivre.com.br. Não use páginas de categoria, lista, blog, ajuda ou outros sites. ` +
                `Encontre até ${limit} anúncios diferentes. Para cada resultado, informe o ID MLB exato e, quando estiver disponível na fonte, o URL exato. ` +
                `Não invente URLs nem IDs; use somente o que aparecer nas fontes da Pesquisa Google.`,
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
      const groundedSources = candidate.groundingMetadata?.groundingChunks ?? [];
      const resolved = await Promise.all(
        groundedSources.slice(0, limit * 2).map(async (chunk) => {
          const uri = chunk.web?.uri;
          if (!uri) return null;
          return resolveGroundingUri(uri, chunk.web?.title ?? null);
        }),
      );
      for (const item of resolved) if (item) candidates.push(item);

      const text = candidate.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
      for (const match of text.matchAll(/https?:\/\/[^\s<>()"']+/gi)) {
        const raw = match[0].replace(/[\].,;:!?]+$/g, "");
        const parsed = directCandidate(raw);
        if (parsed) candidates.push(parsed);
      }

      for (const match of text.matchAll(/\bMLB[\s-]?(\d{6,})\b/gi)) {
        const parsed = idCandidate(`MLB${match[1]}`);
        if (parsed) candidates.push(parsed);
      }
    }

    const unique = Array.from(new Map(candidates.map((item) => [item.id, item])).values()).slice(0, limit);
    console.info("[ML google discovery]", { status: response.status, candidates: unique.length });
    return unique;
  } catch (error) {
    console.info("[ML google discovery]", { status: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error", candidates: 0 });
    return [];
  } finally {
    clearTimeout(timer);
  }
}
