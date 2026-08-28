import { callGeminiFn, type CallGeminiResult } from "./gemini.functions";

export type CallGeminiOptions = {
  system?: string;
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
};

/**
 * Helper reutilizável do frontend. A chave da IA fica só no servidor.
 * const res = await callGemini("Escreva um título...");
 */
export async function callGemini(prompt: string, options: CallGeminiOptions = {}): Promise<CallGeminiResult> {
  try {
    return await callGeminiFn({
      data: {
        prompt,
        ...(options.system ? { system: options.system } : {}),
        ...(options.json ? { json: true } : {}),
        ...(options.temperature != null ? { temperature: options.temperature } : {}),
        ...(options.maxOutputTokens != null ? { maxOutputTokens: options.maxOutputTokens } : {}),
      },
    });
  } catch (error) {
    console.error("callGemini falhou", error instanceof Error ? error.message : error);
    return { ok: false, reason: "Não foi possível falar com a IA agora. Verifique sua conexão e tente novamente.", code: "network" };
  }
}

/** Versão que já devolve JSON parseado. */
export async function callGeminiJson<T>(prompt: string, options: Omit<CallGeminiOptions, "json"> = {}): Promise<{ ok: true; data: T } | { ok: false; reason: string; code: string }> {
  const res = await callGemini(prompt, { ...options, json: true });
  if (!res.ok) return res;
  try {
    return { ok: true, data: JSON.parse(res.text) as T };
  } catch {
    return { ok: false, reason: "Não foi possível interpretar a resposta da IA.", code: "parse_error" };
  }
}
