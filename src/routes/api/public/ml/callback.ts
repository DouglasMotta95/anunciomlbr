import { createFileRoute } from "@tanstack/react-router";

/**
 * Callback OAuth oficial do Mercado Livre.
 * Troca o `code` pelo token de acesso e guarda os tokens em tabela restrita.
 */
export const Route = createFileRoute("/api/public/ml/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const userId = url.searchParams.get("state");
        const appOrigin = process.env["APP_PUBLIC_URL"] ?? url.origin;

        const clientId = process.env["ML_CLIENT_ID"];
        const clientSecret = process.env["ML_CLIENT_SECRET"];
        const redirectUri = process.env["ML_REDIRECT_URI"];

        if (!clientId || !clientSecret || !redirectUri) {
          return Response.redirect(`${appOrigin}/onboarding?ml=not_configured`, 302);
        }
        if (!code || !userId) {
          return Response.redirect(`${appOrigin}/onboarding?ml=invalid_callback`, 302);
        }

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
          return Response.redirect(`${appOrigin}/onboarding?ml=token_error`, 302);
        }

        const token = (await tokenResponse.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
          user_id?: number | string;
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

        return Response.redirect(`${appOrigin}/onboarding?ml=connected`, 302);
      },
    },
  },
});
