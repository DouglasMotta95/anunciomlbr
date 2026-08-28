import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  price_cents: z.number().optional().nullable(),
  attributes: z.unknown().optional(),
  images_count: z.number().int().min(0).optional(),
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

type Ctx = { userId: string };

async function prepareAi(context: Ctx) {
  const { aiProviderStatus } = await import("./ai.server");
  if (!aiProviderStatus().configured) {
    return {
      ok: false as const,
      reason: "A inteligência artificial ainda não está disponível no servidor.",
    };
  }
  const { getAiQuota } = await import("./ai-quota.server");
  const quota = await getAiQuota(context.userId);
  if (quota.remaining < 1) {
    return {
      ok: false as const,
      reason: `Seus créditos de IA acabaram (${quota.used}/${quota.credit_limit}).`,
    };
  }
  return { ok: true as const };
}

async function consume(context: Ctx) {
  const { consumeAiQuota } = await import("./ai-quota.server");
  const result = await consumeAiQuota(context.userId, 1);
  return result.ok
    ? { ok: true as const }
    : { ok: false as const, reason: result.reason };
}

export const optimizeListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(
    async ({ data, context }): Promise<
      { ok: true; result: AiOptimization } | { ok: false; reason: string }
    > => {
      const ready = await prepareAi(context as Ctx);
      if (!ready.ok) return ready;

      const { aiJson, cleanOptimizedTitle, optimizationPrompt } = await import("./ai.server");
      const out = await aiJson<AiOptimization>(
        optimizationPrompt({
          title: data.title,
          description: data.description ?? null,
          category: data.category ?? null,
          price_cents: data.price_cents ?? null,
          attributes: data.attributes ?? null,
          images_count: data.images_count ?? 0,
        }),
      );
      if (!out.ok) return out;
      const result = out.result;
      if (
        !result ||
        typeof result.title !== "string" ||
        typeof result.description !== "string"
      ) {
        return {
          ok: false,
          reason: "A IA retornou uma resposta incompleta. Tente novamente.",
        };
      }
      const title = cleanOptimizedTitle(result.title);
      if (title.length < 3) {
        return { ok: false, reason: "A IA não retornou um título válido. Tente novamente." };
      }
      const credit = await consume(context as Ctx);
      if (!credit.ok) return credit;
      const before = Number.isFinite(result.score_before)
        ? Math.max(0, Math.min(100, Number(result.score_before)))
        : 0;
      const after = Number.isFinite(result.score_after)
        ? Math.max(0, Math.min(100, Number(result.score_after)))
        : before;
      return {
        ok: true,
        result: {
          score_before: before,
          score_after: after,
          title,
          description: result.description.trim(),
          keywords: Array.isArray(result.keywords)
            ? result.keywords.filter((value): value is string => typeof value === "string")
            : [],
          attributes: Array.isArray(result.attributes)
            ? result.attributes.filter((value): value is string => typeof value === "string")
            : [],
          improvements: Array.isArray(result.improvements)
            ? result.improvements.filter((value): value is string => typeof value === "string")
            : [],
        },
      };
    },
  );

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
  .handler(async ({ data, context }) => {
    const ready = await prepareAi(context as Ctx);
    if (!ready.ok) return ready;
    const { aiJson, cleanOptimizedTitle, titlesPrompt } = await import("./ai.server");
    const out = await aiJson<{
      titles: { title: string; score: number; keywords: string[] }[];
    }>(
      titlesPrompt({
        title: data.title,
        category: data.category ?? null,
        description: data.description ?? null,
        count: data.count,
      }),
    );
    if (!out.ok) return out;
    const titles = (out.result.titles ?? [])
      .filter((item) => typeof item?.title === "string")
      .slice(0, data.count)
      .map((item) => ({
        title: cleanOptimizedTitle(item.title),
        score: Number(item.score) || 0,
        keywords: item.keywords ?? [],
      }))
      .filter((item) => item.title.length >= 3);
    if (!titles.length) return { ok: false as const, reason: "A IA não retornou títulos válidos." };
    const credit = await consume(context as Ctx);
    if (!credit.ok) return credit;
    return { ok: true as const, titles };
  });

export const pickBestTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        titles: z.array(z.string().min(3)).min(2).max(20),
        context: z.string().max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const ready = await prepareAi(context as Ctx);
    if (!ready.ok) return ready;
    const { aiJson, bestTitlePrompt } = await import("./ai.server");
    const out = await aiJson<{ index: number; title: string; reason: string; score: number }>(
      bestTitlePrompt(data.titles, data.context),
    );
    if (!out.ok) return out;
    if (!out.result?.title) {
      return { ok: false as const, reason: "A IA não retornou uma escolha válida." };
    }
    const credit = await consume(context as Ctx);
    if (!credit.ok) return credit;
    return { ok: true as const, best: out.result };
  });

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
  .handler(async ({ data, context }) => {
    const ready = await prepareAi(context as Ctx);
    if (!ready.ok) return ready;
    const { aiJson, descriptionPrompt } = await import("./ai.server");
    const out = await aiJson<{ description: string; changes: string[] }>(
      descriptionPrompt({
        title: data.title,
        description: data.description ?? null,
        category: data.category ?? null,
        mode: data.mode,
      }),
    );
    if (!out.ok) return out;
    const description = out.result.description?.trim() ?? "";
    if (!description) {
      return { ok: false as const, reason: "A IA não retornou uma descrição válida." };
    }
    const credit = await consume(context as Ctx);
    if (!credit.ok) return credit;
    return { ok: true as const, description, changes: out.result.changes ?? [] };
  });

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
  .handler(async ({ data, context }) => {
    const ready = await prepareAi(context as Ctx);
    if (!ready.ok) return ready;
    const { aiJson, analysisPrompt } = await import("./ai.server");
    const out = await aiJson<import("./ai.server").ListingAnalysis>(
      analysisPrompt({
        title: data.title,
        description: data.description ?? null,
        category: data.category ?? null,
        attributes: data.attributes ?? null,
        images_count: data.images_count,
        price_cents: data.price_cents ?? null,
      }),
    );
    if (!out.ok) return out;
    if (!out.result || !Number.isFinite(out.result.score)) {
      return { ok: false as const, reason: "A IA não retornou uma análise válida." };
    }
    const credit = await consume(context as Ctx);
    if (!credit.ok) return credit;
    return { ok: true as const, analysis: out.result };
  });
