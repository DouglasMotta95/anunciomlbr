import { createFileRoute } from "@tanstack/react-router";

const PUBLIC_APP_ORIGIN = "https://anunciomlbr.lovable.app";
const PUBLIC_CALLBACK = `${PUBLIC_APP_ORIGIN}/api/public/ml/callback`;
const ML_API = "https://api.mercadolibre.com";

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

type ExistingBindingState = "active" | "stale" | "unknown";

async function inspectExistingBinding(
  supabaseAdmin: any,
  ownerUserId: string,
  expectedMlUserId: string,
  clientId: string,
  clientSecret: string,
): Promise<ExistingBindingState> {
  const { data: oldToken, error: tokenLookupError } = await supabaseAdmin
    .from("ml_tokens")
    .select("access_token,refresh_token,expires_at")
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (tokenLookupError) {
    console.error("ML stale binding token lookup failed", tokenLookupError.message);
    return "unknown";
  }
  if (!oldToken?.access_token) return "stale";

  const verifyToken = async (accessToken: string): Promise<ExistingBindingState> => {
    try {
      const response = await fetch(`${ML_API}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      if (response.status === 401 || response.status === 403) return "stale";
      if (!response.ok) return "unknown";
      const profile = (await response.json().catch(() => null)) as { id?: number | string } | null;
      if (profile?.id == null) return "unknown";
      return String(profile.id) === expectedMlUserId ? "active" : "stale";
    } catch (error) {
      console.error("ML stale binding verification failed", { ownerUserId, error });
      return "unknown";
    }
  };

  const expiresAt = oldToken.expires_at ? new Date(oldToken.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 5 * 60 * 1000) {
    return verifyToken(oldToken.access_token);
  }

  if (!oldToken.refresh_token) return "stale";

  try {
    const refreshResponse = await fetch(`${ML_API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: oldToken.refresh_token,
      }),
    });

    if ([400, 401, 403].includes(refreshResponse.status)) return "stale";
    if (!refreshResponse.ok) return "unknown";

    const refreshed = (await refreshResponse.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    } | null;
    if (!refreshed?.access_token) return "unknown";

    const state = await verifyToken(refreshed.access_token);
    if (state === "active") {
      const { error: refreshPersistError } = await supabaseAdmin.from("ml_tokens").upsert(
        {
          user_id: ownerUserId,
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? oldToken.refresh_token,
          expires_at: new Date(Date.now() + (refreshed.expires_in ?? 21600) * 1000).toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (refreshPersistError) {
        console.warn("ML refreshed old binding token could not be persisted", refreshPersistError.message);
      }
    }
    return state;
  } catch (error) {
    console.error("ML stale binding refresh failed", { ownerUserId, error });
    return "unknown";
  }
}

async function releaseStaleBinding(supabaseAdmin: any, ownerUserId: string, mlUserId: string) {
  const now = new Date().toISOString();
  const { error: disconnectError } = await supabaseAdmin
    .from("ml_connections")
    .update({ connected: false, updated_at: now })
    .eq("user_id", ownerUserId)
    .eq("ml_user_id", mlUserId)
    .eq("connected", true);
  if (disconnectError) throw disconnectError;

  const { error: tokenDeleteError } = await supabaseAdmin.from("ml_tokens").delete().eq("user_id", ownerUserId);
  if (tokenDeleteError) {
    await supabaseAdmin
      .from("ml_connections")
      .update({ connected: true, updated_at: new Date().toISOString() })
      .eq("user_id", ownerUserId)
      .eq("ml_user_id", mlUserId);
    throw tokenDeleteError;
  }

  await supabaseAdmin.from("ml_oauth_states").delete().eq("user_id", ownerUserId);
  await supabaseAdmin.from("activity_events").insert({
    user_id: ownerUserId,
    kind: "ml_stale_binding_released",
    message: "Vínculo antigo do Mercado Livre liberado após confirmação de credencial inválida.",
    meta: { ml_user_id: mlUserId },
  });
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

        const tokenResponse = await fetch(`${ML_API}/oauth/token`, {
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
          const meResponse = await fetch(`${ML_API}/users/me`, {
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

        // A garantia final contra duas conexões simultâneas continua no índice único
        // parcial. Antes de bloquear, porém, validamos se o vínculo antigo ainda possui
        // credencial utilizável. Somente 401/403, refresh 400/401/403, ausência de token
        // ou identidade divergente são considerados prova suficiente de vínculo obsoleto.
        // Erro de rede, 429 ou 5xx nunca provoca takeover automático.
        const { data: existingOwner, error: ownerLookupError } = await supabaseAdmin
          .from("ml_connections")
          .select("user_id")
          .eq("ml_user_id", mlUserId)
          .eq("connected", true)
          .neq("user_id", userId)
          .limit(1)
          .maybeSingle();
        if (ownerLookupError) {
          console.error("ML existing owner lookup failed", ownerLookupError.message);
          return fail("persist_error");
        }
        if (existingOwner?.user_id) {
          const bindingState = await inspectExistingBinding(
            supabaseAdmin,
            existingOwner.user_id,
            mlUserId,
            clientId,
            clientSecret,
          );
          if (bindingState === "active" || bindingState === "unknown") return fail("already_connected");
          try {
            await releaseStaleBinding(supabaseAdmin, existingOwner.user_id, mlUserId);
          } catch (error) {
            console.error("ML stale binding release failed", { existingOwner: existingOwner.user_id, mlUserId, error });
            return fail("persist_error");
          }
        }

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
          if (connectionSaveError.code === "23505") return fail("already_connected");
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
