import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GeminiOptions } from "./gemini.server";

const promptSchema = z.object({
  prompt: z.string().trim().min(1).max(8000),
  system: z.string().trim().max(2000).optional(),
  json: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(16).max(8192).optional(),
});

export type CallGeminiInput = z.infer<typeof promptSchema>;
export type CallGeminiResult =
  | { ok: true; text: string; remaining: number }
  | { ok: false; reason: string; code: string };

type QuotaSnapshot = { used: number; credit_limit: number; remaining: number };
type ConsumeResult =
  | { ok: true; quota: QuotaSnapshot }
  | { ok: false; reason: string; quota: QuotaSnapshot };

type CallGeminiDependencies = {
  getQuota: (userId: string) => Promise<QuotaSnapshot>;
  generate: (
    prompt: string,
    options: GeminiOptions,
  ) => Promise<
    | { ok: true; result: string }
    | { ok: false; reason: string; code: string }
  >;
  consume: (userId: string, amount: number) => Promise<ConsumeResult>;
};

async function defaultDependencies(): Promise<CallGeminiDependencies> {
  const [{ getAiQuota, consumeAiQuota }, { geminiGenerate }] = await Promise.all([
    import("./ai-quota.server"),
    import("./gemini.server"),
  ]);
  return {
    getQuota: getAiQuota,
    generate: geminiGenerate,
    consume: consumeAiQuota,
  };
}

/**
 * Núcleo do callGemini. O userId chega somente depois do middleware autenticado.
 * A injeção de dependências existe para testar timeout, limite e falha de rede
 * sem usar chave real ou consumir créditos do cliente.
 */
export async function callGeminiAuthenticated(
  input: CallGeminiInput,
  userId: string,
  dependencies?: CallGeminiDependencies,
): Promise<CallGeminiResult> {
  const data = promptSchema.parse(input);
  const deps = dependencies ?? (await defaultDependencies());
  const quota = await deps.getQuota(userId);
  if (quota.remaining < 1) {
    return {
      ok: false,
      reason: `Seus créditos de IA acabaram (${quota.used}/${quota.credit_limit}).`,
      code: "AI_CREDITS_EXHAUSTED",
    };
  }

  const out = await deps.generate(data.prompt, {
    system: data.system ?? null,
    json: data.json ?? false,
    temperature: data.temperature ?? null,
    maxOutputTokens: data.maxOutputTokens ?? null,
  });
  if (!out.ok) return { ok: false, reason: out.reason, code: out.code };

  const consumed = await deps.consume(userId, 1);
  if (!consumed.ok) {
    return { ok: false, reason: consumed.reason, code: "AI_CREDIT_CONSUME_FAILED" };
  }

  return { ok: true, text: out.result, remaining: consumed.quota.remaining };
}

/** Endpoint seguro e tarifado: cada geração bem-sucedida usa 1 crédito de IA. */
export const callGeminiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => promptSchema.parse(data))
  .handler(async ({ data, context }): Promise<CallGeminiResult> =>
    callGeminiAuthenticated(data, context.userId),
  );

/** Diagnóstico: informa apenas se a chave existe — nunca o valor e não consome crédito. */
export const getGeminiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { geminiStatus } = await import("./gemini.server");
    return geminiStatus();
  });
