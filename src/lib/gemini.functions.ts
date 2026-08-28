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

export type CallGeminiResult = { ok: true; text: string } | { ok: false; reason: string; code: string };

/** Endpoint seguro: recebe o prompt do frontend e fala com o Gemini no servidor. */
export const callGeminiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => promptSchema.parse(data))
  .handler(async ({ data }): Promise<CallGeminiResult> => {
    const { geminiGenerate } = await import("./gemini.server");
    const out = await geminiGenerate(data.prompt, {
      system: data.system ?? null,
      json: data.json ?? false,
      temperature: data.temperature ?? null,
      maxOutputTokens: data.maxOutputTokens ?? null,
    });
    if (!out.ok) return { ok: false, reason: out.reason, code: out.code };
    return { ok: true, text: out.result };
  });

/** Diagnóstico: informa apenas se a chave existe — nunca o valor. */
export const getGeminiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { geminiStatus } = await import("./gemini.server");
    return geminiStatus();
  });
