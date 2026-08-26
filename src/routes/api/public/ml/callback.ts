import { createFileRoute } from "@tanstack/react-router";

/**
 * Callback OAuth oficial do Mercado Livre.
 *
 * Fluxo: valida erro/cancelamento -> valida e consome o `state` de uso único
 * (anti-CSRF, vinculado ao usuário que iniciou a conexão) -> troca o `code`
 * por tokens -> identifica a conta ML -> grava tokens e conexão no backend
 * -> dispara a sincronização inicial -> redireciona para /integracoes.
 *
 * Tokens e secrets jamais aparecem em URLs, logs ou respostas.
 */
export const Route = createFileRoute("/api/public/ml/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const appOrigin = process.env["APP_PUBLIC_URL"] ?? url.origin;
        const fail = (reason: string) =>
          Response.redirect(`${appOrigin}/integracoes?ml=${encodeURIComponent(reason)}`, 302);

        // Usuário cancelou ou o ML recusou a autorização.
        if (url.searchParams.get("error")) return fail("cancelled");

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return fail("invalid_callback");

        const clientId = process.env["ML_CLIENT_ID"];
        const clientSecret = process.env["ML_CLIENT_SECRET"];
        const redirectUri = process.env["ML_REDIRECT_URI"];
        if (!clientId || !clientSecret || !redirectUri) return fail("not_configured");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Valida o state: precisa existir, estar dentro da validade e ser de uso único.
        const { data: oauthState } = await supabaseAdmin
          .from("ml_oauth_states")
          .select("user_id, expires_at")
          .eq("state", state)
          .maybeSingle();
        if (!oauthState) return fail("invalid_state");

        // Consome o state imediatamente (uso único), mesmo se expirado.
        await supabaseAdmin.from("ml_oauth_states").delete().eq("state", state);
        if (new Date(oauthState.expires_at).getTime() < Date.now()) return fail("invalid_state");

        const userId = oauthState.user_id;

        const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          console.error("ML token exchange failed", tokenResponse.status);
          return fail("token_error");
        }

        const token = (await tokenResponse.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
          user_id?: number | string;
        };

        let nickname: string | null = null;
        try {
          const me = await fetch("https://api.mercadolibre.com/users/me", {
            headers: { Authorization: `Bearer ${token.access_token}` },
          });
          if (me.ok) nickname = ((await me.json()) as { nickname?: string }).nickname ?? null;
        } catch (error) {
          console.error("ML profile fetch failed", error);
        }

        await supabaseAdmin.from("ml_tokens").upsert(
          {
            user_id: userId,
            access_token: token.access_token,
            refresh_token: token.refresh_token ?? null,
            expires_at: new Date(Date.now() + (token.expires_in ?? 21600) * 1000).toISOString(),
          },
          { onConflict: "user_id" },
        );

        await supabaseAdmin.from("ml_connections").upsert(
          {
            user_id: userId,
            connected: true,
            ml_user_id: token.user_id ? String(token.user_id) : null,
            nickname,
            last_sync_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

        await supabaseAdmin.from("activity_events").insert({
          user_id: userId,
          kind: "ml_connected",
          message: "Conta do Mercado Livre conectada",
          meta: { nickname },
        });

        // Sincronização inicial dos anúncios do vendedor.
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
          `${appOrigin}/integracoes?ml=connected&sync=${encodeURIComponent(sync)}`,
          302,
        );
      },
    },
  },
});
