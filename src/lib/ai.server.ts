/** Helpers server-only da IA. Suporta Lovable AI Gateway e Gemini API direta. */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GATEWAY_MODEL = process.env["LOVABLE_AI_MODEL"] || "google/gemini-2.5-flash";
const GEMINI_MODEL = process.env["GEMINI_MODEL"] || "gemini-2.5-flash";
const AI_TIMEOUT_MS = 30_000;

export type AiFail = { ok: false; reason: string };
export type AiProvider = "lovable" | "gemini" | "none";

const SYSTEM =
  "Você é especialista em SEO e vendas no Mercado Livre (Brasil). Responda SEMPRE em JSON válido, em português do Brasil. Use apenas as informações fornecidas: nunca invente características, medidas, marcas ou métricas do produto.";

function geminiApiKey() {
  return process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || null;
}

export function aiProviderStatus(): { configured: boolean; provider: AiProvider; model: string | null } {
  if (process.env["LOVABLE_API_KEY"]) return { configured: true, provider: "lovable", model: GATEWAY_MODEL };
  if (geminiApiKey()) return { configured: true, provider: "gemini", model: GEMINI_MODEL };
  return { configured: false, provider: "none", model: null };
}

async function requestLovable<T>(prompt: string, apiKey: string): Promise<{ ok: true; result: T } | AiFail> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(GATEWAY, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GATEWAY_MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: "A IA demorou demais para responder. Tente novamente." };
    }
    console.error("ai gateway fetch failed");
    return { ok: false, reason: "Não foi possível falar com a IA agora." };
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) return { ok: false, reason: "Limite de uso da IA atingido. Tente novamente em instantes." };
  if (response.status === 402) return { ok: false, reason: "Créditos de IA esgotados no workspace." };
  if (!response.ok) {
    console.error("ai gateway error", response.status);
    return { ok: false, reason: `A IA não respondeu corretamente (erro ${response.status}).` };
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) return { ok: false, reason: "Resposta vazia da IA." };
  try {
    return { ok: true, result: JSON.parse(content) as T };
  } catch {
    return { ok: false, reason: "Não foi possível interpretar a resposta da IA." };
  }
}

async function requestGemini<T>(prompt: string): Promise<{ ok: true; result: T } | AiFail> {
  const { geminiGenerateJson } = await import("./gemini.server");
  const out = await geminiGenerateJson<T>(prompt, {
    system: SYSTEM,
    model: GEMINI_MODEL,
    temperature: 0.35,
  });
  if (out.ok) return out;
  return { ok: false, reason: out.reason };
}

/** Chamada única com fallback automático de provedor. */
export async function aiJson<T>(prompt: string): Promise<{ ok: true; result: T } | AiFail> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const googleKey = geminiApiKey();

  if (lovableKey) {
    const primary = await requestLovable<T>(prompt, lovableKey);
    if (primary.ok || !googleKey) return primary;
    console.warn("Lovable AI indisponível; tentando Gemini direto.");
  }

  if (googleKey) return requestGemini<T>(prompt);
  return { ok: false, reason: "IA não configurada no servidor. Configure a chave de IA no ambiente de produção." };
}

export type OptimizationInput = {
  title: string;
  description?: string | null;
  category?: string | null;
  price_cents?: number | null;
  attributes?: unknown;
  images_count?: number;
};

export function optimizationPrompt(input: OptimizationInput): string {
  return `Otimize de verdade este anúncio do Mercado Livre Brasil, mas somente quando houver melhoria real possível.

DADOS DO ANÚNCIO
Título atual: ${input.title}
Descrição atual: ${(input.description ?? "").slice(0, 4500) || "(vazia)"}
Categoria: ${input.category ?? "(não informada)"}
Preço (centavos): ${input.price_cents ?? "(não informado)"}
Atributos disponíveis: ${JSON.stringify(input.attributes ?? []).slice(0, 2500)}
Quantidade de imagens: ${input.images_count ?? "(não informada)"}

REGRAS OBRIGATÓRIAS
- Use SOMENTE fatos presentes nos dados acima. Nunca invente marca, modelo, material, medida, cor, compatibilidade, garantia, estoque, condição, acessórios ou qualquer especificação.
- Preserve marca, modelo, medidas, códigos e características importantes que já existam.
- Título com no máximo 60 caracteres, natural e focado no que o comprador realmente pesquisaria.
- Priorize clareza, intenção de busca e termos relevantes; elimine repetição e palavras sem valor comercial.
- Nunca acrescente '(copy)', '(cópia)', 'copy', 'cópia', 'IA', 'otimizado' ou 'versão otimizada' como enfeite no título.
- Não prometa frete, prazo, desconto, preço promocional ou benefício que não esteja nos dados.
- A descrição deve ser clara, organizada e comercial, sem links, telefones ou contatos externos.
- Se o título atual já for forte, preserve os elementos bons e faça apenas mudanças que tenham justificativa real.
- Não altere apenas para parecer diferente. score_after não pode ser maior sem melhorias concretas.
- Em attributes, liste apenas atributos relevantes já presentes nos dados; não crie novos fatos.

Retorne SOMENTE JSON válido com as chaves exatas:
{"score_before":number,"score_after":number,"title":string,"description":string,"keywords":string[],"attributes":string[],"improvements":string[]}`;
}

export function cleanOptimizedTitle(value: string): string {
  return value
    .replace(/\s*\((?:copy|cópia)\)\s*$/gi, "")
    .replace(/\s+\b(?:copy|cópia)\b\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export type TitleSuggestion = { title: string; score: number; keywords: string[] };
export function titlesPrompt(input: { title: string; category?: string | null; description?: string | null; count: number }): string {
  return `Gere exatamente ${input.count} variações de título para este anúncio do Mercado Livre.\nTítulo atual: ${input.title}\nCategoria: ${input.category ?? "(não informada)"}\nDescrição (contexto): ${(input.description ?? "").slice(0, 900) || "(vazia)"}\n\nRegras: máximo 60 caracteres por título, sem emojis, sem promessas de frete/preço, sem repetir palavras desnecessárias.\nJSON: {"titles":[{"title":string,"score":number(0-100),"keywords":string[]}]}`;
}

export function bestTitlePrompt(titles: string[], context: string): string {
  return `Escolha o melhor título para o Mercado Livre entre as opções.\nContexto do produto: ${context}\nOpções:\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nJSON: {"index":number(1-${titles.length}),"title":string,"reason":string,"score":number(0-100)}`;
}

export type DescriptionMode = "generate" | "improve" | "rewrite" | "organize" | "expand" | "summarize";
const MODE_LABEL: Record<DescriptionMode, string> = {
  generate: "criar uma descrição completa",
  improve: "melhorar a descrição mantendo o conteúdo",
  rewrite: "reescrever com outra abordagem",
  organize: "organizar em blocos e tópicos",
  expand: "expandir com mais detalhes já presentes",
  summarize: "resumir mantendo o essencial",
};

export function descriptionPrompt(input: { title: string; description?: string | null; category?: string | null; mode: DescriptionMode }): string {
  return `Tarefa: ${MODE_LABEL[input.mode]}.\nTítulo: ${input.title}\nCategoria: ${input.category ?? "(não informada)"}\nDescrição atual: ${(input.description ?? "").slice(0, 3000) || "(vazia)"}\n\nNão invente especificações que não estejam no título/descrição. Sem links, telefones ou dados de contato.\nJSON: {"description":string,"changes":string[]}`;
}

export type ListingAnalysis = { score: number; strengths: string[]; problems: string[]; suggestions: string[]; keywords: string[] };
export function analysisPrompt(input: { title: string; description?: string | null; category?: string | null; attributes?: unknown; images_count: number; price_cents?: number | null }): string {
  return `Analise a qualidade deste anúncio do Mercado Livre.\nTítulo: ${input.title}\nCategoria: ${input.category ?? "(não informada)"}\nAtributos: ${JSON.stringify(input.attributes ?? {}).slice(0, 1200)}\nQuantidade de imagens: ${input.images_count}\nPreço (centavos): ${input.price_cents ?? "(não informado)"}\nDescrição: ${(input.description ?? "").slice(0, 2000) || "(vazia)"}\n\nAvalie título, descrição, categoria, atributos, palavras-chave, imagens e estrutura.\nJSON: {"score":number(0-100),"strengths":string[],"problems":string[],"suggestions":string[],"keywords":string[]}`;
}
