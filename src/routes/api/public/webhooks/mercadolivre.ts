import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook oficial de notificações da aplicação Mercado Livre.
 *
 * Segurança:
 * - valida formato/origem do payload (application_id precisa bater com ML_CLIENT_ID);
 * - aceita apenas tópicos e caminhos de recurso esperados;
 * - resolve somente vendedores realmente conectados antes de persistir o evento;
 * - nunca confia no corpo recebido: relê o recurso na API oficial com o token
 *   do vendedor e, quando a API informa o seller, confere a titularidade;
 * - idempotente por notification_id;
 * - tokens nunca são expostos na resposta.
 */

type MlNotification = {
  _id?: string;
  resource?: string;
  user_id?: number | string;
  topic?: string;
  application_id?: number | string;
  attempts?: number;
  sent?: string;
  received?: string;
  actions?: string[];
};

const SUPPORTED_TOPICS = new Set([
  "items",
  "items_prices",
  "orders",
  "orders_v2",
  "created_orders",
  "questions",
  "messages",
  "shipments",
]);

const RESOURCE_PREFIX: Record<string, string> = {
  items: "/items/",
  items_prices: "/items/",
  orders: "/orders/",
  orders_v2: "/orders/",
  created_orders: "/orders/",
  questions: "/questions/",
  messages: "/messages/",
  shipments: "/shipments/",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isSafeResource(topic: string, resource: string) {
  const prefix = RESOURCE_PREFIX[topic];
  if (!prefix || resource.length > 600 || !resource.startsWith(prefix)) return false;
  if (resource.includes("..") || resource.includes("://") || resource.includes("\\")) return false;
  return /^\/[A-Za-z0-9_./?=&:%-]+$/.test(resource);
}

function resourceSellerId(data: Record<string, unknown>) {
  if (data["seller_id"] != null) return String(data["seller_id"]);
  const seller = data["seller"];
  if (seller && typeof seller === "object" && (seller as Record<string, unknown>)["id"] != null) {
    return String((seller as Record<string, unknown>)["id"]);
  }
  return null;
}

export const Route = createFileRoute("/api/public/webhooks/mercadolivre")({
  server: {
    handlers: {
      GET: async () => json({ ok: true, service: "anuncio-ml-ml-webhook" }),

      POST: async ({ request }) => {
        const clientId = process.env["ML_CLIENT_ID"]?.trim();
        if (!clientId) return json({ ok: false, reason: "not_configured" }, 503);

        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) {
          return json({ ok: false, reason: "unsupported_media_type" }, 415);
        }

        let payload: MlNotification;
        try {
          payload = (await request.json()) as MlNotification;
        } catch {
          return json({ ok: false, reason: "invalid_json" }, 400);
        }

        const topic = (payload.topic ?? "").trim();
        const resource = (payload.resource ?? "").trim();
        const mlUserId = payload.user_id != null ? String(payload.user_id).trim() : null;
        const applicationId =
          payload.application_id != null ? String(payload.application_id).trim() : null;

        if (!SUPPORTED_TOPICS.has(topic)) return json({ ok: true, ignored: "unsupported_topic" });
        if (!resource || !isSafeResource(topic, resource)) {
          return json({ ok: false, reason: "invalid_resource" }, 400);
        }
        if (!mlUserId || !/^\d{1,20}$/.test(mlUserId)) {
          return json({ ok: false, reason: "invalid_user" }, 400);
        }
        if (!applicationId || applicationId !== clientId) {
          return json({ ok: false, reason: "unknown_application" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Só eventos de uma conta realmente conectada entram na fila/log. Isso
        // impede que terceiros encham a tabela usando user_ids aleatórios.
        const { data: connection, error: connectionError } = await supabaseAdmin
          .from("ml_connections")
          .select("user_id")
          .eq("ml_user_id", mlUserId)
          .eq("connected", true)
          .maybeSingle();
        if (connectionError) {
          console.error("ML webhook connection lookup failed", connectionError.message);
          return json({ ok: false, reason: "connection_lookup_failed" }, 500);
        }
        const userId = connection?.user_id ?? null;
        if (!userId) return json({ ok: true, ignored: "seller_not_connected" });

        const rawNotificationId =
          typeof payload._id === "string" && payload._id.trim()
            ? payload._id.trim()
            : `${applicationId}:${topic}:${resource}:${payload.sent ?? "unspecified"}`;
        const notificationId = rawNotificationId.slice(0, 600);

        const { data: logged, error: logError } = await supabaseAdmin
          .from("ml_notifications")
          .insert({
            notification_id: notificationId,
            topic,
            resource,
            ml_user_id: mlUserId,
            application_id: applicationId,
            user_id: userId,
            attempts:
              typeof payload.attempts === "number" && payload.attempts > 0
                ? Math.min(Math.trunc(payload.attempts), 1000)
                : 1,
            payload: {
              _id: typeof payload._id === "string" ? payload._id.slice(0, 600) : null,
              topic,
              resource,
              user_id: mlUserId,
              application_id: applicationId,
              attempts: payload.attempts ?? 1,
              sent: payload.sent ?? null,
              received: payload.received ?? null,
              actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 20) : [],
            } as never,
            sent_at: payload.sent ?? null,
          })
          .select("id")
          .maybeSingle();

        if (logError) {
          if ((logError as { code?: string }).code === "23505") {
            return json({ ok: true, deduped: true });
          }
          console.error("ml webhook log failed", logError.message);
          return json({ ok: false, reason: "log_failed" }, 500);
        }

        const { getValidMlAccessToken } = await import("@/lib/ml.server");
        const tokenState = await getValidMlAccessToken(userId);

        if (!tokenState.ok) {
          await supabaseAdmin
            .from("ml_notifications")
            .update({ processed: false, error: tokenState.reason })
            .eq("id", logged!.id);
          return json({ ok: true, pending: tokenState.reason });
        }

        let processError: string | null = null;
        try {
          const lookup = await fetch(`https://api.mercadolibre.com${resource}`, {
            headers: {
              Authorization: `Bearer ${tokenState.accessToken}`,
              Accept: "application/json",
              "User-Agent": "ANUNCIO-ML/1.0",
            },
          });

          if (!lookup.ok) {
            processError = `resource_lookup_${lookup.status}`;
          } else {
            const data = (await lookup.json()) as Record<string, unknown>;
            const sellerId = resourceSellerId(data);
            if (sellerId && sellerId !== mlUserId) {
              processError = "resource_owner_mismatch";
            } else if (topic === "items" || topic === "items_prices") {
              const mlId = String(
                (data["id"] as string | undefined) ?? resource.split("/").pop() ?? "",
              );
              const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
              if (typeof data["title"] === "string") patch["title"] = data["title"];
              if (typeof data["price"] === "number") {
                patch["price_cents"] = Math.round(data["price"] * 100);
              }
              if (typeof data["available_quantity"] === "number") {
                patch["stock"] = data["available_quantity"];
              }
              if (typeof data["permalink"] === "string") {
                patch["source_permalink"] = data["permalink"];
              }

              const { data: listing } = await supabaseAdmin
                .from("listings")
                .select("id")
                .eq("user_id", userId)
                .eq("source_ml_id", mlId)
                .maybeSingle();

              if (listing) {
                await supabaseAdmin.from("listings").update(patch as never).eq("id", listing.id);
              }

              await supabaseAdmin.from("activity_events").insert({
                user_id: userId,
                kind: "ml_item_updated",
                message: listing
                  ? `Anúncio ${mlId} sincronizado pelo Mercado Livre`
                  : `Notificação recebida para o anúncio ${mlId}`,
                meta: { ml_item_id: mlId, topic },
              });
            } else {
              await supabaseAdmin.from("activity_events").insert({
                user_id: userId,
                kind: "ml_notification",
                message: `Notificação ${topic} recebida do Mercado Livre`,
                meta: {
                  topic,
                  resource,
                  status: (data["status"] as string | undefined) ?? null,
                },
              });
            }
          }
        } catch (error) {
          processError = error instanceof Error ? error.message : "unknown_error";
          console.error("ml webhook processing failed", processError);
        }

        await supabaseAdmin
          .from("ml_notifications")
          .update({
            processed: !processError,
            processed_at: processError ? null : new Date().toISOString(),
            error: processError,
          })
          .eq("id", logged!.id);

        return json({ ok: !processError, topic });
      },
    },
  },
});
