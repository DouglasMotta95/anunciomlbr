import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const askSellerCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ question: z.string().trim().min(3).max(500).default("O que eu devo fazer hoje para melhorar minhas vendas?") }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: quotaData, error: quotaError } = await context.supabase.rpc("consume_ai_credit", { p_user_id: context.userId, p_amount: 1 });
    if (quotaError) return { ok: false as const, reason: "Não foi possível validar seus créditos de IA." };
    const quota = Array.isArray(quotaData) ? quotaData[0] : quotaData;
    if (!quota?.allowed) return { ok: false as const, reason: `Créditos de IA esgotados (${quota?.used ?? 0}/${quota?.credit_limit ?? 0}).` };

    const [{ data: listings }, { data: connection }] = await Promise.all([
      context.supabase.from("listings").select("title,status,stock,price_cents,cost_cents,fees_cents,ai_score,updated_at").limit(250),
      context.supabase.from("ml_connections").select("connected,last_sync_at").maybeSingle(),
    ]);
    const rows = listings ?? [];
    const summary = {
      ml_connected: !!connection?.connected,
      total_listings: rows.length,
      active: rows.filter((r: any) => r.status === "active").length,
      drafts: rows.filter((r: any) => r.status === "draft").length,
      low_stock: rows.filter((r: any) => r.status === "active" && Number(r.stock ?? 0) <= 3).length,
      low_ai_score: rows.filter((r: any) => Number(r.ai_score ?? 0) < 70).length,
      catalog_value_cents: rows.reduce((sum: number, r: any) => sum + Number(r.price_cents ?? 0), 0),
      missing_cost: rows.filter((r: any) => !r.cost_cents).length,
    };

    let salesSummary = { orders: 0, revenue_cents: 0 };
    if (connection?.connected) {
      const now = new Date(); const from = new Date(now); from.setDate(from.getDate() - 30);
      try {
        const { fetchSellerOrders } = await import("@/lib/orders.server");
        const result = await fetchSellerOrders(context.userId, from.toISOString(), now.toISOString());
        if (result.ok) {
          const valid = result.orders.filter((o) => !["cancelled", "invalid"].includes(o.status));
          salesSummary = { orders: valid.length, revenue_cents: valid.reduce((sum, o) => sum + Math.round((o.paid_amount ?? o.total_amount) * 100), 0) };
        }
      } catch { /* resumo continua sem vendas */ }
    }

    const { aiJson } = await import("@/lib/ai.server");
    const prompt = `Você é o copiloto comercial do vendedor dentro do ANÚNCIO ML. Use somente os dados abaixo, não invente métricas.\n\nPergunta: ${data.question}\n\nResumo da conta: ${JSON.stringify({ ...summary, sales_30d: salesSummary })}\n\nResponda em JSON: {"headline":string,"summary":string,"priorities":[{"title":string,"reason":string,"action":string,"impact":"alto"|"medio"|"baixo"}],"warning":string|null}. Dê no máximo 5 prioridades, objetivas e acionáveis.`;
    const out = await aiJson<{ headline: string; summary: string; priorities: Array<{ title: string; reason: string; action: string; impact: "alto" | "medio" | "baixo" }>; warning: string | null }>(prompt);
    if (!out.ok) return out;
    return { ok: true as const, result: out.result };
  });
