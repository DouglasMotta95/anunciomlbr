import { createFileRoute } from "@tanstack/react-router";

const PUBLIC_APP_ORIGIN = "https://anunciomlbr.lovable.app";
const PUBLIC_CALLBACK = `${PUBLIC_APP_ORIGIN}/api/public/ml/callback`;

function safeMlError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  return {
    error: typeof row["error"] === "string" ? row["error"] : undefined,
    message: typeof row["message"] === "string" ? row["message"] : undefined,
    error_description:
      typeof row["error_description"] === "string" ? row["error_description"] : undefined,
  };
}

/** Callback OAuth oficial do Mercado Livre com PKCE S256. */
export const Route = createFileRoute("/api/public/ml/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const fail = (reason: string) =>
          Response.redirect(`${PUBLIC_APP_ORIGIN}/integracoes?ml=${encodeURIComponent(reason)}`, 302);

        if (url.searchParams.get("error")) return fail("cancelled");

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return fail("invalid_callback");

        const clientId = process.env["ML_CLIENT_ID"]?.trim();
        const clientSecret = process.env["ML_CLIENT_SECRET"]?.trim();
        if (!clientId || !clientSecret) return fail("not_configured");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { deriveMlPkce } = await import("@/lib/ml-pkce.server");

        // Consome o state de forma atômica: se já tiver sido usado, não retorna linha.
        const { data: oauthState, error: stateError } = await supabaseAdmin
          .from("ml_oauth_states")
          .delete()
          .eq("state", state)
          .select("user_id, expires_at")
          .maybeSingle();

        if (stateError) {
          console.error("ML OAuth state consume failed", {
            code: stateError.code,
            message: stateError.message,
          });
          return fail("state_error");
        }
        if (!oauthState) return fail("invalid_state");
        if (new Date(oauthState.expires_at).getTime() < Date.now()) return fail("invalid_state");

        const userId = oauthState.user_id;
        const { verifier } = await deriveMlPkce(state, clientSecret);

        const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: PUBLIC_CALLBACK,
            code_verifier: verifier,
          }),
        });

        const tokenPayload = await tokenResponse.json().catch(() => null);
        if (!tokenResponse.ok) {
          console.error("ML OAuth PKCE token exchange failed", {
            stage: "authorization_code_exchange_pkce",
            status: tokenResponse.status,
            ...safeMlError(tokenPayload),
          });
          return fail("token_error");
        }

        const token = tokenPayload as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          user_id?: number | string;
        } | null;
        if (!token?.access_token) {
          console.error("ML OAuth PKCE token exchange returned no access_token", {
            stage: "authorization_code_exchange_pkce",
          });
          return fail("token_error");
        }

        let mlUserId = token.user_id != null ? String(token.user_id) : null;
        let nickname: string | null = null;

        try {
          const meResponse = await fetch("https://api.mercadolibre.com/users/me", {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              Accept: "application/json",
            },
          });
          const mePayload = await meResponse.json().catch(() => null);
          if (!meResponse.ok) {
            console.error("ML /users/me failed", {
              stage: "identify_user",
              status: meResponse.status,
              ...safeMlError(mePayload),
            });
          } else if (mePayload && typeof mePayload === "object") {
            const me = mePayload as { id?: number | string; nickname?: string };
            if (me.id != null) mlUserId = String(me.id);
            nickname = me.nickname ?? null;
          }
        } catch (error) {
          console.error("ML /users/me request failed", { stage: "identify_user", error });
        }

        if (!mlUserId) return fail("identity_error");

        const { error: tokenSaveError } = await supabaseAdmin.from("ml_tokens").upsert(
          {
            user_id: userId,
            access_token: token.access_token,
            refresh_token: token.refresh_token ?? null,
            expires_at: new Date(Date.now() + (token.expires_in ?? 21600) * 1000).toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (tokenSaveError) {
          console.error("ML token persist failed", {
            stage: "persist_token",
            code: tokenSaveError.code,
            message: tokenSaveError.message,
          });
          return fail("persist_error");
        }

        const { error: connectionSaveError } = await supabaseAdmin.from("ml_connections").upsert(
          {
            user_id: userId,
            connected: true,
            ml_user_id: mlUserId,
            nickname,
            last_sync_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (connectionSaveError) {
          console.error("ML connection persist failed", {
            stage: "persist_connection",
            code: connectionSaveError.code,
            message: connectionSaveError.message,
          });
          await supabaseAdmin.from("ml_tokens").delete().eq("user_id", userId);
          return fail("persist_error");
        }

        const { error: activityError } = await supabaseAdmin.from("activity_events").insert({
          user_id: userId,
          kind: "ml_connected",
          message: "Conta do Mercado Livre conectada",
          meta: { nickname, ml_user_id: mlUserId },
        });
        if (activityError) console.warn("ML activity log failed", activityError.message);

        let sync = "skipped";
        try {
          const { syncUserListings } = await import("@/lib/ml.server");
          const result = await syncUserListings(userId);
          sync = result.ok ? "ok" : result.reason;
        } catch (error) {
          console.error("ML initial sync failed", error);
          sync = "error";
        }

        return Response.redirect(
          `${PUBLIC_APP_ORIGIN}/integracoes?ml=connected&sync=${encodeURIComponent(sync)}`,
          302,
        );
      },
    },
  },
});
