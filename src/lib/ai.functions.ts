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
