/**
 * Descoberta complementar via Google Search grounding do Gemini.
 *
 * Segurança: o texto gerado pelo modelo é ignorado. Só aceitamos URLs presentes
 * em groundingMetadata.groundingChunks[].web.uri, resolvemos redirecionamentos
 * controlados do Google e exigimos um MLB no pathname da URL real do Mercado Livre.
 */

import { normalizeItemId } from "@/lib/ml-search-input";

const TIMEOUT_MS = 25_000;
const REDIRECT_TIMEOUT_MS = 6_000;
const MAX_REDIRECTS = 6;
const DEFAULT_MODEL = process.env["GEMINI_SEARCH_MODEL"] || process.env["GEMINI_MODEL"] || "gemini-2.5-flash";
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type GroundingWeb = { uri?: string; title?: string };
type GeminiGroundingPayload = {
  candidates?: Array<{
    groundingMetadata?: { groundingChunks?: Array<{ web?: GroundingWeb }> };
  }>;
};

export type GroundedWebCandidate = {
  id: string;
  url: string;
  sourceTitle: string | null;
};

function apiKey() {
  return process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || null;
}

function isMercadoLivreUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br") || host === "mercadolivre.com" || host.endsWith(".mercadolivre.com");
  } catch {
    return false;
  }
}

function itemIdFromRealUrl(value: string) {
  try {
    const url = new URL(value);
    if (!isMercadoLivreUrl(url.toString())) return null;
    const id = normalizeItemId(url.pathname);
    return id && /^MLB\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function groundedCandidateFromUrl(value: string, title: string | null = null): GroundedWebCandidate | null {
  if (!isMercadoLivreUrl(value)) return null;
  const id = itemIdFromRealUrl(value);
  if (!id) return null;
  const url = new URL(value.replace(/^http:\/\//i, "https://"));
  url.search = "";
  url.hash = "";
  return { id, url: url.toString(), sourceTitle: title?.trim().slice(0, 220) || null };
}

function allowedRedirectHost(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "vertexaisearch.cloud.google.com" || host.endsWith(".google.com") || host.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

async function resolveGroundingUri(value: string, title: string | null) {
  const direct = groundedCandidateFromUrl(value, title);
  if (direct) return direct;
  if (!allowedRedirectHost(value)) return null;

  let current = value;
  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    if (!allowedRedirectHost(current)) return groundedCandidateFromUrl(current, title);
    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": WEB_UA },
        signal: AbortSignal.timeout(REDIRECT_TIMEOUT_MS),
      });
      const location = response.headers.get("location");
      if (!location) return groundedCandidateFromUrl(response.url, title);
      current = new URL(location, current).toString();
      const candidate = groundedCandidateFromUrl(current, title);
      if (candidate) return candidate;
    } catch {
      return null;
    }
  }
  return null;
}

function dedupe(items: GroundedWebCandidate[], limit: number) {
  const byId = new Map<string, GroundedWebCandidate>();
  for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item);
  return Array.from(byId.values()).slice(0, limit);
}

export async function discoverFromGroundedWeb(query: string, desired = 20): Promise<GroundedWebCandidate[]> {
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
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Pesquise ofertas reais e atuais de ${JSON.stringify(query)} no Mercado Livre Brasil. Consulte resultados e páginas reais do marketplace.`,
                },
              ],
            },
          ],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0, maxOutputTokens: 256 },
        }),
      },
    );
    if (!response.ok) return [];

    const payload = (await response.json()) as GeminiGroundingPayload;
    const candidates: GroundedWebCandidate[] = [];
    for (const candidate of payload.candidates ?? []) {
      const chunks = candidate.groundingMetadata?.groundingChunks ?? [];
      const resolved = await Promise.all(
        chunks.slice(0, limit * 4).map(async (chunk) => {
          const uri = chunk.web?.uri;
          if (!uri) return null;
          return resolveGroundingUri(uri, chunk.web?.title ?? null);
        }),
      );
      for (const item of resolved) if (item) candidates.push(item);
    }

    const result = dedupe(candidates, limit);
    console.info("[ML grounded web discovery]", { query, grounding_candidates: result.length, generated_candidates: 0 });
    return result;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
