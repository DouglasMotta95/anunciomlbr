import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook oficial de notificações da aplicação Mercado Livre.
 *
 * Segurança:
 * - valida formato/origem do payload (application_id precisa bater com ML_CLIENT_ID);
 * - nunca confia no corpo recebido: sempre relê o recurso na API oficial usando o
 *   token do vendedor guardado em `ml_tokens` (nunca exposto na resposta);
 * - idempotente: notificações repetidas (mesmo tópico + recurso + horário de envio)
 *   são descartadas pelo índice único de `ml_notifications`;
 * - responde 200 rapidamente para o Mercado Livre não reenfileirar.
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/webhooks/mercadolivre")({
  server: {
    handlers: {
      // O Mercado Livre valida a URL com um GET simples antes de salvar.
      GET: async () => json({ ok: true, service: "anuncio-ml-ml-webhook" }),

      POST: async ({ request }) => {
        const clientId = process.env["ML_CLIENT_ID"];

        let payload: MlNotification;
        try {
          payload = (await request.json()) as MlNotification;
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const topic = (payload.topic ?? "").trim();
        const resource = (payload.resource ?? "").trim();
        const mlUserId = payload.user_id != null ? String(payload.user_id) : null;
        const applicationId = payload.application_id != null ? String(payload.application_id) : null;

        if (!topic || !resource) return json({ ok: false, reason: "missing_topic_or_resource" }, 400);

        // Origem: a notificação precisa ser da nossa aplicação.
        if (!clientId) return json({ ok: false, reason: "not_configured" }, 503);
        if (!applicationId || applicationId !== String(clientId)) {
          return json({ ok: false, reason: "unknown_application" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Resolve o usuário do ANÚNCIO ML pela conta ML conectada.
        let userId: string | null = null;
        if (mlUserId) {
          const { data: connection } = await supabaseAdmin
            .from("ml_connections")
            .select("user_id")
            .eq("ml_user_id", mlUserId)
            .maybeSingle();
          userId = connection?.user_id ?? null;
        }

        // Idempotência: o índice único bloqueia reentregas do mesmo evento.
        const { data: logged, error: logError } = await supabaseAdmin
          .from("ml_notifications")
          .insert({
            notification_id:
              payload._id ??
              `${applicationId}:${topic}:${resource}:${payload.sent ?? "unspecified"}`,
            topic,
            resource,
            ml_user_id: mlUserId,
            application_id: applicationId,
            user_id: userId,
            attempts: payload.attempts ?? 1,
            payload: payload as never,
            sent_at: payload.sent ?? null,
          })
          .select("id")
          .maybeSingle();

        if (logError) {
          // 23505 = violação de unicidade -> já processamos este evento.
          if ((logError as { code?: string }).code === "23505") {
            return json({ ok: true, deduped: true });
          }
          console.error("ml webhook log failed", logError.message);
          return json({ ok: false, reason: "log_failed" }, 500);
        }

        if (!SUPPORTED_TOPICS.has(topic)) {
          await supabaseAdmin
            .from("ml_notifications")
            .update({ processed: true, processed_at: new Date().toISOString(), error: "topic_ignored" })
            .eq("id", logged!.id);
          return json({ ok: true, ignored: topic });
        }

        // Sem usuário conectado não há token para consultar o recurso oficial.
        if (!userId) {
          await supabaseAdmin
            .from("ml_notifications")
            .update({ processed: true, processed_at: new Date().toISOString(), error: "seller_not_connected" })
            .eq("id", logged!.id);
          return json({ ok: true, ignored: "seller_not_connected" });
        }

        // Token válido (renova via refresh_token quando necessário).
        const { getValidMlAccessToken } = await import("@/lib/ml.server");
        const tokenState = await getValidMlAccessToken(userId);

        if (!tokenState.ok) {
          await supabaseAdmin
            .from("ml_notifications")
            .update({ processed: false, error: tokenState.reason })
            .eq("id", logged!.id);
          return json({ ok: true, pending: tokenState.reason });
        }
        const accessToken = tokenState.accessToken;

        let processError: string | null = null;
        try {
          const lookup = await fetch(`https://api.mercadolibre.com${resource}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          });

          if (!lookup.ok) {
            processError = `resource_lookup_${lookup.status}`;
          } else {
            const data = (await lookup.json()) as Record<string, unknown>;

            if (topic === "items" || topic === "items_prices") {
              const mlId = String((data["id"] as string | undefined) ?? resource.split("/").pop() ?? "");
              const patch: Record<string, unknown> = {
                updated_at: new Date().toISOString(),
              };
              if (typeof data["title"] === "string") patch["title"] = data["title"];
              if (typeof data["price"] === "number") patch["price_cents"] = Math.round(data["price"] * 100);
              if (typeof data["available_quantity"] === "number") patch["stock"] = data["available_quantity"];
              if (typeof data["permalink"] === "string") patch["source_permalink"] = data["permalink"];

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
              // orders / orders_v2 / created_orders / questions / messages / shipments
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

        // Sempre 200: o Mercado Livre reenvia em caso de erro HTTP.
        return json({ ok: !processError, topic });
      },
    },
  },
});
