import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "@/lib/permissions.server";

export type HealthState = "ok" | "warning" | "error";

const EXPECTED_AI: Record<string, number> = {
  starter: 100,
  pro: 300,
  premium: 750,
  business: 1000,
};

const EXPECTED_PACKAGES = [
  "ai_extra_100",
  "ai_extra_300",
  "ai_extra_750",
  "ai_extra_1500",
  "ads_extra_25",
  "ads_extra_100",
  "ads_extra_300",
  "ads_extra_1000",
] as const;

export const adminGetSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCapability(context, "admin.access");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const migratedDb = supabaseAdmin as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message?: string } | null }>;
    };

    const [
      mlConnected,
      expiringLicenses,
      expiredLicenses,
      failedPayments,
      pendingPayments,
      recentMlEvents,
      planCatalog,
      aiRpc,
      quotaClaims,
      imageBucket,
    ] = await Promise.all([
      supabaseAdmin.from("ml_connections").select("user_id", { count: "exact", head: true }).eq("connected", true),
      supabaseAdmin.from("licenses").select("id", { count: "exact", head: true }).eq("status", "active").not("expires_at", "is", null).lte("expires_at", in7Days).gte("expires_at", now.toISOString()),
      supabaseAdmin.from("licenses").select("id", { count: "exact", head: true }).or(`status.eq.expired,and(status.eq.active,expires_at.lt.${now.toISOString()})`),
      supabaseAdmin.from("payments").select("id", { count: "exact", head: true }).in("status", ["rejected", "cancelled"]),
      supabaseAdmin.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin
        .from("activity_events")
        .select("id", { count: "exact", head: true })
        .in("kind", ["ml_notification", "ml_item_updated"])
        .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
      supabaseAdmin.from("plans").select("code,ai_credits,kind,active,features"),
      migratedDb.rpc("ai_credit_status", { p_user_id: context.userId }),
      supabaseAdmin.from("listing_quota_claims").select("listing_id", { count: "exact", head: true }),
      supabaseAdmin.storage.getBucket("ai-listing-images"),
    ]);

    const aiProvider = process.env["LOVABLE_API_KEY"]
      ? "Lovable AI"
      : process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"]
        ? "Gemini"
        : null;

    const config = {
      supabase: !!process.env["SUPABASE_URL"] && !!process.env["SUPABASE_SERVICE_ROLE_KEY"],
      mercadoLivre: !!process.env["ML_CLIENT_ID"] && !!process.env["ML_CLIENT_SECRET"] && !!process.env["ML_REDIRECT_URI"],
      mercadoPago: !!process.env["MERCADOPAGO_ACCESS_TOKEN"],
      ai: !!aiProvider,
      webhookMercadoPago: !!process.env["MERCADOPAGO_WEBHOOK_SECRET"],
    };

    const catalogRows = planCatalog.data ?? [];
    const mainPlansCurrent = Object.entries(EXPECTED_AI).every(([code, expected]) => {
      const row = catalogRows.find((plan: any) => plan.code === code && plan.active !== false);
      return Number(row?.ai_credits) === expected;
    });
    const packagesCurrent = EXPECTED_PACKAGES.every((code) =>
      catalogRows.some((plan: any) => plan.code === code && plan.active === true),
    );
    const imageCostCatalogCurrent = ["ai_extra_100", "ai_extra_300", "ai_extra_750", "ai_extra_1500"].every((code) => {
      const row = catalogRows.find((plan: any) => plan.code === code && plan.active === true);
      return Array.isArray(row?.features) && row.features.some((feature: unknown) => String(feature).includes("3 créditos por imagem"));
    });
    const migrationsOk =
      !planCatalog.error &&
      !aiRpc.error &&
      !quotaClaims.error &&
      !imageBucket.error &&
      mainPlansCurrent &&
      packagesCurrent &&
      imageCostCatalogCurrent;
    const migrationDetail = migrationsOk
      ? "Catálogo v3, RPC de créditos, franquia de anúncios e bucket de imagens confirmados no ambiente"
      : [
          !mainPlansCurrent ? "franquias dos planos desatualizadas" : null,
          !packagesCurrent ? "pacotes extras ausentes/desativados" : null,
          !imageCostCatalogCurrent ? "catálogo ainda não informa 3 créditos por imagem" : null,
          aiRpc.error ? "RPC de créditos indisponível" : null,
          quotaClaims.error ? "infraestrutura de franquia de anúncios indisponível" : null,
          imageBucket.error ? "bucket de imagens IA indisponível" : null,
        ].filter(Boolean).join(" · ") || "não foi possível validar o estado do banco";

    const services = [
      { key: "supabase", label: "Banco / Backend", state: config.supabase ? "ok" : "error", detail: config.supabase ? "Backend configurado" : "Configuração do backend incompleta" },
      { key: "migrations", label: "Migrations e catálogo", state: migrationsOk ? "ok" : "warning", detail: migrationDetail },
      { key: "mercadoLivre", label: "Mercado Livre", state: config.mercadoLivre ? "ok" : "error", detail: config.mercadoLivre ? `${mlConnected.count ?? 0} conta(s) conectada(s)` : "Credenciais OAuth incompletas" },
      { key: "mercadoPago", label: "Mercado Pago", state: config.mercadoPago ? "ok" : "error", detail: config.mercadoPago ? "Token configurado" : "Token de pagamento ausente" },
      { key: "ai", label: "Inteligência artificial", state: config.ai ? "ok" : "warning", detail: aiProvider ? `${aiProvider} configurado` : "Chave de IA ausente" },
      { key: "webhook", label: "Webhook Mercado Pago", state: config.webhookMercadoPago ? "ok" : "error", detail: config.webhookMercadoPago ? "Assinatura configurada" : "Secret de assinatura não configurado — pagamentos não serão liberados até configurar" },
    ] as Array<{ key: string; label: string; state: HealthState; detail: string }>;

    const attention = [
      { label: "Licenças vencendo em até 7 dias", count: expiringLicenses.count ?? 0, severity: (expiringLicenses.count ?? 0) > 0 ? "warning" : "ok" },
      { label: "Licenças vencidas", count: expiredLicenses.count ?? 0, severity: (expiredLicenses.count ?? 0) > 0 ? "warning" : "ok" },
      { label: "Pagamentos recusados/cancelados", count: failedPayments.count ?? 0, severity: (failedPayments.count ?? 0) > 0 ? "warning" : "ok" },
      { label: "Pagamentos pendentes", count: pendingPayments.count ?? 0, severity: (pendingPayments.count ?? 0) > 0 ? "warning" : "ok" },
      { label: "Notificações ML nas últimas 24h", count: recentMlEvents.count ?? 0, severity: "ok" },
    ] as const;

    return { services, attention, checkedAt: now.toISOString() };
  });
