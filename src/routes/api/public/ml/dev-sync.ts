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
        const { userId } = (await request.json()) as { userId?: string };
        if (!userId) return new Response("missing userId", { status: 400 });
        const { syncUserListings } = await import("@/lib/ml.server");
        return Response.json(await syncUserListings(userId, 10));
      },
    },
  },
})
