/** Helpers server-only da IA (Lovable AI Gateway). */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.5-flash";

export type AiFail = { ok: false; reason: string };

const SYSTEM =
  "Você é especialista em SEO e vendas no Mercado Livre (Brasil). Responda SEMPRE em JSON válido, em português do Brasil. Use apenas as informações fornecidas: nunca invente características, medidas, marcas ou métricas do produto.";

/** Chamada única ao gateway com resposta JSON. */
export async function aiJson<T>(prompt: string): Promise<{ ok: true; result: T } | AiFail> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, reason: "Configuração pendente: chave de IA ausente." };

  let response: Response;
  try {
    response = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    console.error("ai gateway fetch failed", error);
    return { ok: false, reason: "Não foi possível falar com a IA agora." };
  }

  if (response.status === 429) return { ok: false, reason: "Limite de uso da IA atingido. Tente novamente em instantes." };
  if (response.status === 402) return { ok: false, reason: "Créditos de IA esgotados no workspace." };
  if (!response.ok) {
    console.error("ai gateway error", response.status, await response.text());
    return { ok: false, reason: "A IA não respondeu. Tente novamente." };
  }

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return { ok: false, reason: "Resposta vazia da IA." };

  try {
    return { ok: true, result: JSON.parse(content) as T };
  } catch {
    return { ok: false, reason: "Não foi possível interpretar a resposta da IA." };
  }
}

export type TitleSuggestion = { title: string; score: number; keywords: string[] };

export function titlesPrompt(input: {
  title: string;
  category?: string | null | undefined;
  description?: string | null | undefined;
  count: number;
}): string {
  return `Gere exatamente ${input.count} variações de título para este anúncio do Mercado Livre.
Título atual: ${input.title}
Categoria: ${input.category ?? "(não informada)"}
Descrição (contexto): ${(input.description ?? "").slice(0, 900) || "(vazia)"}

Regras: máximo 60 caracteres por título, sem emojis, sem promessas de frete/preço, sem repetir palavras desnecessárias.
JSON: {"titles":[{"title":string,"score":number(0-100),"keywords":string[]}]}`;
}

export function bestTitlePrompt(titles: string[], context: string): string {
  return `Escolha o melhor título para o Mercado Livre entre as opções.
Contexto do produto: ${context}
Opções:
${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

JSON: {"index":number(1-${titles.length}),"title":string,"reason":string,"score":number(0-100)}`;
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

export function descriptionPrompt(input: {
  title: string;
  description?: string | null | undefined;
  category?: string | null | undefined;
  mode: DescriptionMode;
}): string {
  return `Tarefa: ${MODE_LABEL[input.mode]}.
Título: ${input.title}
Categoria: ${input.category ?? "(não informada)"}
Descrição atual: ${(input.description ?? "").slice(0, 3000) || "(vazia)"}

Não invente especificações que não estejam no título/descrição. Sem links, telefones ou dados de contato (proibido pelo Mercado Livre).
JSON: {"description":string,"changes":string[]}`;
}

export type ListingAnalysis = {
  score: number;
  strengths: string[];
  problems: string[];
  suggestions: string[];
  keywords: string[];
};

export function analysisPrompt(input: {
  title: string;
  description?: string | null | undefined;
  category?: string | null | undefined;
  attributes?: unknown;
  images_count: number;
  price_cents?: number | null | undefined;
}): string {
  return `Analise a qualidade deste anúncio do Mercado Livre.
Título: ${input.title}
Categoria: ${input.category ?? "(não informada)"}
Atributos: ${JSON.stringify(input.attributes ?? {}).slice(0, 1200)}
Quantidade de imagens: ${input.images_count}
Preço (centavos): ${input.price_cents ?? "(não informado)"}
Descrição: ${(input.description ?? "").slice(0, 2000) || "(vazia)"}

Avalie título, descrição, categoria, atributos, palavras-chave, imagens e estrutura.
JSON: {"score":number(0-100),"strengths":string[],"problems":string[],"suggestions":string[],"keywords":string[]}`;
}
