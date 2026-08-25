/**
 * Helpers server-only para consultar pedidos (orders) reais na API oficial do Mercado Livre.
 * Nunca importar em componentes: usa tokens e o cliente admin.
 */

const ML_API = "https://api.mercadolibre.com";

export type MlOrder = {
  id: string;
  status: string;
  date_created: string;
  total_amount: number;
  paid_amount: number | null;
  currency_id: string | null;
  buyer_nickname: string | null;
  items: Array<{ title: string; quantity: number; unit_price: number }>;
};

export type OrdersFetchResult =
  | { ok: true; orders: MlOrder[] }
  | { ok: false; reason: string };

/**
 * Busca todos os pedidos do vendedor no intervalo de datas informado (paginação de 50 em 50).
 */
export async function fetchSellerOrders(
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<OrdersFetchResult> {
  const { getValidMlAccessToken } = await import("@/lib/ml.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tokenState = await getValidMlAccessToken(userId);
  if (!tokenState.ok) return { ok: false, reason: tokenState.reason };

  const { data: connection } = await supabaseAdmin
    .from("ml_connections")
    .select("ml_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const mlUserId = connection?.ml_user_id ?? tokenState.mlUserId;
  if (!mlUserId) return { ok: false, reason: "missing_ml_user_id" };

  const auth = { Authorization: `Bearer ${tokenState.accessToken}`, Accept: "application/json" };
  const orders: MlOrder[] = [];
  const limit = 50;
  let offset = 0;
  let total = Infinity;

  while (offset < total && offset < 1000) {
    const url = new URL(`${ML_API}/orders/search`);
    url.searchParams.set("seller", mlUserId);
    url.searchParams.set("order.date_created.from", fromISO);
    url.searchParams.set("order.date_created.to", toISO);
    url.searchParams.set("sort", "date_desc");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url.toString(), { headers: auth });
    if (!response.ok) return { ok: false, reason: `orders_search_${response.status}` };

    const payload = (await response.json()) as {
      results?: Array<Record<string, unknown>>;
      paging?: { total?: number };
    };

    total = payload.paging?.total ?? 0;
    const results = payload.results ?? [];

    for (const raw of results) {
      const buyer = raw["buyer"] as { nickname?: string } | undefined;
      const orderItems = Array.isArray(raw["order_items"])
        ? (raw["order_items"] as Array<Record<string, unknown>>).map((it) => {
            const item = it["item"] as { title?: string } | undefined;
            return {
              title: item?.title ?? "Item",
              quantity: typeof it["quantity"] === "number" ? (it["quantity"] as number) : 0,
              unit_price: typeof it["unit_price"] === "number" ? (it["unit_price"] as number) : 0,
            };
          })
        : [];

      orders.push({
        id: String(raw["id"] ?? ""),
        status: String(raw["status"] ?? "unknown"),
        date_created: String(raw["date_created"] ?? ""),
        total_amount: typeof raw["total_amount"] === "number" ? (raw["total_amount"] as number) : 0,
        paid_amount: typeof raw["paid_amount"] === "number" ? (raw["paid_amount"] as number) : null,
        currency_id: (raw["currency_id"] as string) ?? null,
        buyer_nickname: buyer?.nickname ?? null,
        items: orderItems,
      });
    }

    offset += limit;
    if (results.length === 0) break;
  }

  return { ok: true, orders };
}
