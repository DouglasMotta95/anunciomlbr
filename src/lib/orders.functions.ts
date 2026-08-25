import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrdersSummary = {
  pedidos: number;
  vendas: number;
  faturamento_cents: number;
  ticket_medio_cents: number;
  cancelamentos: number;
  series: Array<{ date: string; pedidos: number; faturamento_cents: number }>;
  recentOrders: Array<{
    id: string;
    status: string;
    date_created: string;
    total_amount_cents: number;
    buyer_nickname: string | null;
    items_summary: string;
  }>;
};

export type OrdersResult =
  | { ok: true; configured: true; summary: OrdersSummary }
  | { ok: false; configured: false; reason: string }
  | { ok: false; configured: true; reason: string };

const inputSchema = z.object({
  fromISO: z.string(),
  toISO: z.string(),
});

/** Busca e agrega os pedidos reais do vendedor no Mercado Livre para o período informado. */
export const getOrdersSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ context, data }): Promise<OrdersResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: connection } = await supabaseAdmin
      .from("ml_connections")
      .select("connected, ml_user_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!connection?.connected) {
      return { ok: false, configured: false, reason: "not_connected" };
    }

    const { fetchSellerOrders } = await import("@/lib/orders.server");
    const result = await fetchSellerOrders(context.userId, data.fromISO, data.toISO);

    if (!result.ok) {
      const configured = result.reason !== "missing_token" && result.reason !== "not_configured";
      return { ok: false, configured, reason: result.reason };
    }

    const orders = result.orders;
    const byDay = new Map<string, { pedidos: number; faturamento_cents: number }>();
    let faturamento_cents = 0;
    let vendas = 0;
    let cancelamentos = 0;

    for (const order of orders) {
      const day = order.date_created.slice(0, 10);
      const entry = byDay.get(day) ?? { pedidos: 0, faturamento_cents: 0 };
      entry.pedidos += 1;
      const isCancelled = order.status === "cancelled";
      if (isCancelled) cancelamentos += 1;
      const amountCents = Math.round(order.total_amount * 100);
      if (!isCancelled) {
        entry.faturamento_cents += amountCents;
        faturamento_cents += amountCents;
        vendas += order.items.reduce((sum, it) => sum + it.quantity, 0);
      }
      byDay.set(day, entry);
    }

    const series = Array.from(byDay.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const pedidos = orders.length;
    const ticket_medio_cents = pedidos > 0 ? Math.round(faturamento_cents / Math.max(pedidos - cancelamentos, 1)) : 0;

    const recentOrders = orders.slice(0, 50).map((o) => ({
      id: o.id,
      status: o.status,
      date_created: o.date_created,
      total_amount_cents: Math.round(o.total_amount * 100),
      buyer_nickname: o.buyer_nickname,
      items_summary: o.items.map((it) => `${it.quantity}x ${it.title}`).join(", "),
    }));

    return {
      ok: true,
      configured: true,
      summary: {
        pedidos,
        vendas,
        faturamento_cents,
        ticket_medio_cents,
        cancelamentos,
        series,
        recentOrders,
      },
    };
  });
