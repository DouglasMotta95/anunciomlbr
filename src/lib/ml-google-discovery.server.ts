/** Descoberta server-only de anúncios do Mercado Livre via Google Search Grounding.
 * A busca comum pode usar estes resultados diretamente quando a API pública do
 * Mercado Livre estiver restrita. A IA só descobre IDs/URLs/títulos encontrados
 * na Pesquisa Google; não inventamos preço, vendas, estoque ou outras métricas.
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

function canonicalItemUrl(id: string) {
  const digits = id.replace(/^MLB/i, "");
  return `https://produto.mercadolivre.com.br/MLB-${digits}`;
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
          "User-Agent": "ANUNCIO-ML/1.0",
        },
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
        const raw = match[0].replace(/[\].,;:!?]+$/g, "");
        const parsed = directCandidate(raw);
        if (parsed) candidates.push(parsed);
      }

      for (const match of text.matchAll(/\bMLB[\s-]?(\d{6,})\b/gi)) {
        const id = `MLB${match[1]}`;
        const parsed = idCandidate(id, titleById.get(id) ?? null);
        if (parsed) candidates.push(parsed);
      }
    }

    const unique = Array.from(new Map(candidates.map((item) => [item.id, item])).values())
      .filter((item) => !!item.url)
      .slice(0, limit);
    console.info("[ML google discovery]", { status: response.status, candidates: unique.length });
    return unique;
  } catch (error) {
    console.info("[ML google discovery]", { status: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error", candidates: 0 });
    return [];
  } finally {
    clearTimeout(timer);
  }
}
