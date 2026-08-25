import { createFileRoute } from "@tanstack/react-router";

/** Rota temporária de QA: valida a sincronização inicial. Protegida por segredo de cron. */
export const Route = createFileRoute("/api/public/ml/dev-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("unauthorized", { status: 401 });
        }
        const body = (await request.json()) as {
          userId?: string;
          seed?: boolean;
          expire?: boolean;
        };
        if (!body.userId) return new Response("missing userId", { status: 400 });

        const { getAppAccessToken, syncUserListings } = await import("@/lib/ml.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (body.seed) {
          const token = await getAppAccessToken();
          if (!token) return Response.json({ ok: false, reason: "no_app_token" });
          const me = await fetch("https://api.mercadolibre.com/users/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!me.ok) return Response.json({ ok: false, reason: `users_me_${me.status}` });
          const profile = (await me.json()) as { id: number; nickname: string };

          await supabaseAdmin.from("ml_tokens").upsert(
            {
              user_id: body.userId,
              access_token: token,
              refresh_token: body.expire ? "TG-refresh-invalido" : null,
              expires_at: new Date(
                Date.now() + (body.expire ? -60_000 : 6 * 60 * 60 * 1000),
              ).toISOString(),
            },
            { onConflict: "user_id" },
          );
          await supabaseAdmin.from("ml_connections").upsert(
            {
              user_id: body.userId,
              connected: true,
              ml_user_id: String(profile.id),
              nickname: profile.nickname,
            },
            { onConflict: "user_id" },
          );
          return Response.json({ ok: true, seeded: profile.nickname });
        }

        return Response.json(await syncUserListings(body.userId, 10));
      },
    },
  },
});
