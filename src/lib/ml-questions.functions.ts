import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ML_API = "https://api.mercadolibre.com";

async function authState(userId: string) {
  const { getValidMlAccessToken } = await import("@/lib/ml.server");
  const token = await getValidMlAccessToken(userId);
  if (!token.ok) throw new Error("Reconecte sua conta do Mercado Livre.");
  if (!token.mlUserId) throw new Error("Não foi possível identificar sua conta do Mercado Livre.");
  return token;
}

export type MlQuestion = {
  id: number;
  item_id: string;
  status: string;
  text: string;
  date_created: string;
  answer: { text?: string; date_created?: string } | null;
};

export const listSellerQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = await authState(context.userId);
    const url = new URL(`${ML_API}/questions/search`);
    url.searchParams.set("seller_id", token.mlUserId!);
    url.searchParams.set("api_version", "4");
    url.searchParams.set("sort_fields", "date_created");
    url.searchParams.set("sort_types", "DESC");
    url.searchParams.set("limit", "50");
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token.accessToken}`, Accept: "application/json" } });
    if (!response.ok) throw new Error(`Mercado Livre não retornou as perguntas (${response.status}).`);
    const body = await response.json() as { total?: number; questions?: MlQuestion[] };
    return { total: body.total ?? 0, questions: body.questions ?? [] };
  });

export const answerSellerQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ question_id: z.number().int().positive(), text: z.string().trim().min(1).max(2000) }).parse(data))
  .handler(async ({ data, context }) => {
    const token = await authState(context.userId);
    const response = await fetch(`${ML_API}/answers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token.accessToken}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: data.question_id, text: data.text }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("ML answer failed", response.status, body.slice(0, 500));
      throw new Error(response.status === 403 ? "O Mercado Livre não permitiu responder esta pergunta." : "Não foi possível enviar a resposta.");
    }
    return { ok: true as const };
  });

export const suggestQuestionAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ question_id: z.number().int().positive(), item_id: z.string().min(5), question: z.string().min(1).max(2000) }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: quotaData, error: quotaError } = await db.rpc("consume_ai_credit", { p_user_id: context.userId, p_amount: 1 });
    if (quotaError) return { ok: false as const, reason: "Não foi possível validar seus créditos de IA." };
    const quota = Array.isArray(quotaData) ? quotaData[0] : quotaData;
    if (!quota?.allowed) return { ok: false as const, reason: "Seus créditos de IA acabaram neste período." };

    const token = await authState(context.userId);
    const itemResponse = await fetch(`${ML_API}/items/${encodeURIComponent(data.item_id)}`, { headers: { Authorization: `Bearer ${token.accessToken}`, Accept: "application/json" } });
    const item = itemResponse.ok ? await itemResponse.json() as { title?: string; price?: number; available_quantity?: number; attributes?: Array<{ name?: string; value_name?: string }> } : null;
    const contextText = item ? {
      title: item.title ?? null,
      price: item.price ?? null,
      stock: item.available_quantity ?? null,
      attributes: (item.attributes ?? []).slice(0, 25).map((a) => `${a.name ?? ""}: ${a.value_name ?? ""}`),
    } : { title: null, price: null, stock: null, attributes: [] };

    const { aiJson } = await import("@/lib/ai.server");
    const prompt = `Você ajuda um vendedor do Mercado Livre a responder uma pergunta pré-venda. Não invente informação. Se o contexto não permitir confirmar algo, diga de forma educada que a informação precisa ser verificada. Não inclua telefone, WhatsApp, link externo ou tentativa de tirar a negociação do Mercado Livre.\nPergunta do cliente: ${data.question}\nContexto do anúncio: ${JSON.stringify(contextText)}\nRetorne JSON: {"answer":string,"confidence":"alta"|"media"|"baixa","note":string|null}. A resposta deve ter no máximo 2000 caracteres e soar natural em português do Brasil.`;
    const result = await aiJson<{ answer: string; confidence: "alta" | "media" | "baixa"; note: string | null }>(prompt);
    if (!result.ok) return result;
    return { ok: true as const, suggestion: { ...result.result, answer: String(result.result.answer ?? "").slice(0, 2000) } };
  });
