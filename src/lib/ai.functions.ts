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
    const { aiJson } = await import("./ai.server");
    const prompt = `Analise e otimize este anúncio do Mercado Livre.
Título: ${data.title}
Descrição: ${data.description ?? "(vazia)"}
Categoria: ${data.category ?? "(não informada)"}
Preço (centavos): ${data.price_cents ?? "(não informado)"}

Retorne JSON com as chaves exatas:
{"score_before":number(0-100),"score_after":number(0-100),"title":string(max 60 chars),"description":string,"keywords":string[],"attributes":string[],"improvements":string[]}`;

    const out = await aiJson<AiOptimization>(prompt);
    if (!out.ok) return out;

    const result = out.result;
    if (!result || typeof result.title !== "string" || typeof result.description !== "string") {
      return { ok: false, reason: "A IA retornou uma resposta incompleta. Tente novamente." };
    }

    return {
      ok: true,
      result: {
        score_before: Number.isFinite(result.score_before) ? Math.max(0, Math.min(100, result.score_before)) : 0,
        score_after: Number.isFinite(result.score_after) ? Math.max(0, Math.min(100, result.score_after)) : 0,
        title: result.title.slice(0, 60),
        description: result.description,
        keywords: Array.isArray(result.keywords) ? result.keywords : [],
        attributes: Array.isArray(result.attributes) ? result.attributes : [],
        improvements: Array.isArray(result.improvements) ? result.improvements : [],
      },
    };
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
