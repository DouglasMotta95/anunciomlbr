import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  price_cents: z.number().optional().nullable(),
});

export type AiOptimization = {
  score_before: number;
  score_after: number;
  title: string;
  description: string;
  keywords: string[];
  attributes: string[];
  improvements: string[];
};

/** ANÚNCIO AI — sugere melhorias. Nada é aplicado sem revisão do usuário. */
export const optimizeListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; result: AiOptimization } | { ok: false; reason: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, reason: "Configuração pendente: chave de IA ausente." };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é especialista em SEO de marketplaces brasileiros, especialmente Mercado Livre. Responda SEMPRE em JSON válido, em português do Brasil. Nunca invente dados de vendas ou métricas reais.",
          },
          {
            role: "user",
            content: `Analise e otimize este anúncio.
Título: ${data.title}
Descrição: ${data.description ?? "(vazia)"}
Categoria: ${data.category ?? "(não informada)"}
Preço (centavos): ${data.price_cents ?? "(não informado)"}

Retorne JSON com as chaves exatas:
{"score_before":number(0-100),"score_after":number(0-100),"title":string(max 60 chars),"description":string,"keywords":string[],"attributes":string[],"improvements":string[]}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (response.status === 429) return { ok: false, reason: "Limite de uso da IA atingido. Tente novamente em instantes." };
    if (!response.ok) {
      console.error("AI gateway error", response.status, await response.text());
      return { ok: false, reason: "A IA não respondeu. Tente novamente." };
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return { ok: false, reason: "Resposta vazia da IA." };

    try {
      const parsed = JSON.parse(content) as AiOptimization;
      return { ok: true, result: parsed };
    } catch {
      return { ok: false, reason: "Não foi possível interpretar a resposta da IA." };
    }
  });

/** Gera 5, 10 ou 20 títulos reais via IA. */
export const generateTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        title: z.string().min(3),
        description: z.string().nullish(),
        category: z.string().nullish(),
        count: z.union([z.literal(5), z.literal(10), z.literal(20)]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { aiJson, titlesPrompt } = await import("./ai.server");
    const out = await aiJson<{ titles: { title: string; score: number; keywords: string[] }[] }>(
      titlesPrompt({ title: data.title, category: data.category, description: data.description, count: data.count }),
    );
    if (!out.ok) return out;
    const titles = (out.result.titles ?? [])
      .filter((t) => typeof t?.title === "string")
      .slice(0, data.count)
      .map((t) => ({ title: t.title.slice(0, 60), score: Number(t.score) || 0, keywords: t.keywords ?? [] }));
    return { ok: true as const, titles };
  });

/** Escolhe o melhor título entre as opções geradas. */
export const pickBestTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ titles: z.array(z.string().min(3)).min(2).max(20), context: z.string().max(500) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { aiJson, bestTitlePrompt } = await import("./ai.server");
    const out = await aiJson<{ index: number; title: string; reason: string; score: number }>(
      bestTitlePrompt(data.titles, data.context),
    );
    if (!out.ok) return out;
    return { ok: true as const, best: out.result };
  });

/** Gera / melhora / reescreve / organiza / expande / resume a descrição. */
export const generateDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        title: z.string().min(3),
        description: z.string().nullish(),
        category: z.string().nullish(),
        mode: z.enum(["generate", "improve", "rewrite", "organize", "expand", "summarize"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { aiJson, descriptionPrompt } = await import("./ai.server");
    const out = await aiJson<{ description: string; changes: string[] }>(descriptionPrompt(data));
    if (!out.ok) return out;
    return { ok: true as const, description: out.result.description ?? "", changes: out.result.changes ?? [] };
  });

/** Análise completa do anúncio com pontuação 0-100. */
export const analyzeListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        title: z.string().min(3),
        description: z.string().nullish(),
        category: z.string().nullish(),
        attributes: z.unknown().optional(),
        images_count: z.number().int().min(0).default(0),
        price_cents: z.number().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { aiJson, analysisPrompt } = await import("./ai.server");
    const out = await aiJson<import("./ai.server").ListingAnalysis>(analysisPrompt(data));
    if (!out.ok) return out;
    return { ok: true as const, analysis: out.result };
  });
