import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiRuntimeHealth = {
  configured: boolean;
  responding: boolean;
  provider: "lovable" | "gemini" | "none";
  model: string | null;
  latency_ms: number | null;
  reason: string | null;
};

/**
 * Diagnóstico real da mesma rota de IA usada pelo produto.
 * Não consome crédito do usuário e nunca retorna/loga chaves.
 */
export const getAiRuntimeHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AiRuntimeHealth> => {
    const { aiJson, aiProviderStatus } = await import("./ai.server");
    const status = aiProviderStatus();

    if (!status.configured) {
      return {
        configured: false,
        responding: false,
        provider: "none",
        model: null,
        latency_ms: null,
        reason: "Nenhum provedor de IA está configurado no servidor.",
      };
    }

    const started = Date.now();
    const result = await aiJson<{ status?: string }>(
      'Teste de saúde interno. Retorne SOMENTE este JSON: {"status":"ok"}',
    );
    const latency = Date.now() - started;

    if (!result.ok) {
      return {
        configured: true,
        responding: false,
        provider: status.provider,
        model: status.model,
        latency_ms: latency,
        reason: result.reason,
      };
    }

    if (result.result?.status !== "ok") {
      return {
        configured: true,
        responding: false,
        provider: status.provider,
        model: status.model,
        latency_ms: latency,
        reason: "A IA respondeu, mas o formato do teste de saúde veio inesperado.",
      };
    }

    return {
      configured: true,
      responding: true,
      provider: status.provider,
      model: status.model,
      latency_ms: latency,
      reason: null,
    };
  });
