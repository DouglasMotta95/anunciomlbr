import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

export const activateLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ code: z.string().min(6) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.trim().toUpperCase();
    const { data: license, error } = await supabaseAdmin.from("licenses").select("*, plans(code,name,kind,period_months)").eq("code", code).maybeSingle();
    if (error) throw new Error("Falha ao consultar a licença.");
    if (!license) return { ok: false as const, reason: "Licença não encontrada." };
    if (license.status === "cancelled" || license.status === "suspended") return { ok: false as const, reason: "Esta licença está suspensa ou cancelada." };
    if (license.expires_at && new Date(license.expires_at) < new Date()) return { ok: false as const, reason: "Esta licença está expirada." };
    if (license.user_id && license.user_id !== context.userId) return { ok: false as const, reason: "Esta licença já está vinculada a outra conta." };

    const months = license.plans?.kind === "ad_package" ? (license.plans?.period_months ?? 12) : (PERIOD_MONTHS[license.period] ?? 1);
    const startsAt = license.starts_at ?? new Date().toISOString();
    const expiresAt = license.expires_at ?? new Date(new Date(startsAt).setMonth(new Date(startsAt).getMonth() + months)).toISOString();
    const { error: updateError } = await supabaseAdmin.from("licenses").update({ user_id: context.userId, status: "active", starts_at: startsAt, activated_at: new Date().toISOString(), expires_at: expiresAt }).eq("id", license.id);
    if (updateError) throw new Error("Não foi possível ativar a licença.");
    await supabaseAdmin.from("activity_events").insert({ user_id: context.userId, kind: license.plans?.kind === "ad_package" ? "ad_package_activated" : "license_activated", message: license.plans?.kind === "ad_package" ? `Pacote ${license.plans?.name ?? code} ativado` : `Licença ${code} ativada`, meta: { license_id: license.id } });
    return { ok: true as const, license: { code, plan: license.plans?.name ?? null, expires_at: expiresAt } };
  });

const generateSchema = z.object({
  plan_id: z.string().uuid(), period: z.enum(["monthly", "quarterly", "semiannual", "annual"]),
  origin: z.enum(["mercado_pago", "pix_manual", "courtesy", "promo", "partner", "admin"]),
  quantity: z.number().int().min(1).max(500), user_id: z.string().uuid().nullish(), starts_at: z.string().nullish(), expires_at: z.string().nullish(), note: z.string().max(500).nullish(),
});

export const generateLicenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => generateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin.from("plans").select("code,kind,period_months,ad_quota").eq("id", data.plan_id).maybeSingle();
    const months = plan?.kind === "ad_package" ? (plan.period_months ?? 12) : (PERIOD_MONTHS[data.period] ?? 1);
    const startsAt = data.starts_at ?? new Date().toISOString();
    const expiresAt = data.expires_at ?? new Date(new Date(startsAt).setMonth(new Date(startsAt).getMonth() + months)).toISOString();
    const rows = [];
    for (let i = 0; i < data.quantity; i += 1) {
      const { data: code, error: codeError } = await supabaseAdmin.rpc("generate_license_code", { _plan_code: plan?.code ?? "gen" });
      if (codeError) throw new Error("Falha ao gerar código de licença.");
      rows.push({ code: code as string, plan_id: data.plan_id, period: plan?.kind === "ad_package" ? "annual" : data.period, origin: data.origin, status: data.user_id ? ("active" as const) : ("available" as const), user_id: data.user_id ?? null, activated_at: data.user_id ? new Date().toISOString() : null, starts_at: startsAt, expires_at: expiresAt, ads_quota: plan?.kind === "ad_package" ? plan.ad_quota : null, note: data.note ?? null, created_by: context.userId });
    }
    const { data: inserted, error } = await supabaseAdmin.from("licenses").insert(rows).select("*");
    if (error) throw new Error("Não foi possível criar as licenças.");
    return { created: inserted?.length ?? 0, licenses: inserted ?? [] };
  });
