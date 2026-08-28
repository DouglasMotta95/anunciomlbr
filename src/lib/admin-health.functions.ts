import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCapability } from "@/lib/permissions.server";

export type HealthState = "ok" | "warning" | "error";

export const adminGetSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCapability(context, "admin.access");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      mlConnected,
      expiringLicenses,
      expiredLicenses,
      failedPayments,
      pendingPayments,
      recentMlEvents,
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

    const services = [
      { key: "supabase", label: "Supabase / Banco", state: config.supabase ? "ok" : "error", detail: config.supabase ? "Backend configurado" : "Configuração do backend incompleta" },
      { key: "mercadoLivre", label: "Mercado Livre", state: config.mercadoLivre ? "ok" : "error", detail: config.mercadoLivre ? `${mlConnected.count ?? 0} conta(s) conectada(s)` : "Credenciais OAuth incompletas" },
      { key: "mercadoPago", label: "Mercado Pago", state: config.mercadoPago ? "ok" : "warning", detail: config.mercadoPago ? "Token configurado" : "Token de pagamento ausente" },
      { key: "ai", label: "Inteligência artificial", state: config.ai ? "ok" : "warning", detail: aiProvider ? `${aiProvider} configurado` : "Chave de IA ausente" },
      { key: "webhook", label: "Webhook Mercado Pago", state: config.webhookMercadoPago ? "ok" : "warning", detail: config.webhookMercadoPago ? "Assinatura configurada" : "Secret de assinatura não configurado" },
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
