/** Descoberta server-only de links reais do Mercado Livre via Google Search Grounding.
 * Usada apenas quando a busca pública de itens do Mercado Livre está restrita.
 * Esta função NÃO gera dados comerciais: ela só devolve URLs/IDs encontrados nas
 * fontes da Pesquisa Google. Título, preço, vendas etc. precisam ser confirmados
 * pela API do Mercado Livre antes de aparecerem no produto.
 */

import { normalizeItemId } from "@/lib/ml-search-input";

const TIMEOUT_MS = 20_000;
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
                `Use somente páginas de anúncio do domínio mercadolivre.com.br que possuam um ID MLB no próprio URL. ` +
                `Não use páginas de categoria, lista, blog, ajuda ou outros sites. Não invente URLs nem IDs. ` +
                `Encontre até ${limit} anúncios diferentes. Na resposta, inclua os URLs exatos encontrados nas fontes da Pesquisa Google, um por linha.`,
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
      for (const chunk of candidate.groundingMetadata?.groundingChunks ?? []) {
        const uri = chunk.web?.uri;
        if (!uri) continue;
        const parsed = directCandidate(uri, chunk.web?.title ?? null);
        if (parsed) candidates.push(parsed);
      }

      const text = candidate.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
      for (const match of text.matchAll(/https?:\/\/[^\s<>()"']+/gi)) {
        const raw = match[0].replace(/[\].,;:!?]+$/g, "");
        const parsed = directCandidate(raw);
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
