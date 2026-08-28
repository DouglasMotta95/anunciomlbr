import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const promptSchema = z.object({
  prompt: z.string().trim().min(1).max(8000),
  system: z.string().trim().max(2000).optional(),
  json: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(16).max(8192).optional(),
});

export type CallGeminiResult = { ok: true; text: string; remaining: number } | { ok: false; reason: string; code: string };

/** Endpoint seguro e tarifado: cada geração bem-sucedida usa 1 crédito de IA. */
export const callGeminiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => promptSchema.parse(data))
  .handler(async ({ data, context }): Promise<CallGeminiResult> => {
    const { getAiQuota, consumeAiQuota } = await import("./ai-quota.server");
    const quota = await getAiQuota(context.userId);
    if (quota.remaining < 1) {
      return {
        ok: false,
        reason: `Seus créditos de IA acabaram (${quota.used}/${quota.credit_limit}).`,
        code: "AI_CREDITS_EXHAUSTED",
      };
    }

    const { geminiGenerate } = await import("./gemini.server");
    const out = await geminiGenerate(data.prompt, {
      system: data.system ?? null,
      json: data.json ?? false,
      temperature: data.temperature ?? null,
      maxOutputTokens: data.maxOutputTokens ?? null,
    });
    if (!out.ok) return { ok: false, reason: out.reason, code: out.code };

    const consumed = await consumeAiQuota(context.userId, 1);
    if (!consumed.ok) {
      return { ok: false, reason: consumed.reason, code: "AI_CREDIT_CONSUME_FAILED" };
    }

    return { ok: true, text: out.result, remaining: consumed.quota.remaining };
  });

/** Diagnóstico: informa apenas se a chave existe — nunca o valor e não consome crédito. */
export const getGeminiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { geminiStatus } = await import("./gemini.server");
    return geminiStatus();
  });
