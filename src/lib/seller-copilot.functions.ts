import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const askSellerCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ question: z.string().trim().min(3).max(500).default("O que eu devo fazer hoje para melhorar minhas vendas?") }).parse(data))
  .handler(async ({ data, context }) => {
    const { getAiQuota } = await import("@/lib/ai-quota.server");
    const quota = await getAiQuota(context.userId);
    if (quota.remaining < 1) return { ok: false as const, reason: `Créditos de IA esgotados (${quota.used}/${quota.credit_limit}).` };

    const [{ data: listings }, { data: connection }] = await Promise.all([
      context.supabase.from("listings").select("title,status,stock,price_cents,cost_cents,fees_cents,ai_score,updated_at").limit(250),
      context.supabase.from("ml_connections").select("connected,last_sync_at,access_token,nickname").eq("user_id", context.userId).maybeSingle(),
    ]);

    const rows = listings ?? [];
    const mlConnected = !!connection && (!!connection.connected || !!connection.access_token);
    const scoredRows = rows.filter((row: any) => row.ai_score !== null && row.ai_score !== undefined);
    const summary = {
      ml_connected: mlConnected,
      ml_nickname: connection?.nickname ?? null,
      last_sync_at: connection?.last_sync_at ?? null,
      total_listings: rows.length,
      active: rows.filter((row: any) => row.status === "active").length,
      drafts: rows.filter((row: any) => row.status === "draft").length,
      low_stock: rows.filter((row: any) => row.status === "active" && Number(row.stock ?? 0) <= 3).length,
      ai_scored: scoredRows.length,
      low_ai_score: scoredRows.filter((row: any) => Number(row.ai_score) < 70).length,
      missing_cost: rows.filter((row: any) => row.cost_cents === null || row.cost_cents === undefined).length,
    };

    let salesSummary = { orders: 0, revenue_cents: 0, available: false };
    if (mlConnected) {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      try {
        const { fetchSellerOrders } = await import("@/lib/orders.server");
        const result = await fetchSellerOrders(context.userId, from.toISOString(), now.toISOString());
        if (result.ok) {
          const valid = result.orders.filter((order) => !["cancelled", "invalid"].includes(order.status));
          salesSummary = {
            orders: valid.length,
            revenue_cents: valid.reduce((sum, order) => sum + Math.round((order.paid_amount ?? order.total_amount) * 100), 0),
            available: true,
          };
        }
      } catch {
        // Mantém available=false para a IA não confundir indisponibilidade com zero vendas.
      }
    }

    const { aiJson } = await import("@/lib/ai.server");
    const prompt = `Você é o copiloto operacional do vendedor dentro do ANÚNCIO ML. Use SOMENTE os dados fornecidos. Não invente métricas, problemas de conexão, vendas, ranking, visibilidade, conversão ou comportamento do algoritmo do Mercado Livre. Se sales_30d.available=false, diga que os dados de vendas não puderam ser confirmados — nunca trate isso como zero vendas. Só diga que a conta está desconectada se ml_connected=false. ai_scored informa quantos anúncios realmente possuem pontuação; não classifique anúncios sem score como score baixo.\nPergunta: ${data.question}\nResumo confirmado da conta: ${JSON.stringify({ ...summary, sales_30d: salesSummary })}\nRetorne JSON: {"headline":string,"summary":string,"priorities":[{"title":string,"reason":string,"action":string,"impact":"alto"|"medio"|"baixo"}],"warning":string|null}. Dê no máximo 5 prioridades curtas, factuais e acionáveis.`;

    const out = await aiJson<{ headline: string; summary: string; priorities: Array<{ title: string; reason: string; action: string; impact: "alto" | "medio" | "baixo" }>; warning: string | null }>(prompt);
    if (!out.ok) return out;

    const { consumeAiQuota } = await import("@/lib/ai-quota.server");
    const consumed = await consumeAiQuota(context.userId, 1);
    if (!consumed.ok) return { ok: false as const, reason: consumed.reason };
    return { ok: true as const, result: out.result };
  });
