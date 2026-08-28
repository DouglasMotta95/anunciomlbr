import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Acesso administrativo negado.");
}

export const adminSearchCreditClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ search: z.string().trim().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const term = data.search.replace(/[,%]/g, " ").trim();
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name")
      .or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error("Não foi possível buscar os clientes.");
    return { clients: rows ?? [] };
  });

export const adminListCreditPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("plans")
      .select("id,code,name,kind,ai_credits,ad_quota,period_months")
      .in("kind", ["ai_package", "ad_package"])
      .eq("active", true)
      .order("sort_order");
    if (error) throw new Error("Não foi possível carregar os pacotes de créditos.");
    return { packages: data ?? [] };
  });

export const adminGrantCreditPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        package_id: z.string().uuid(),
        note: z.string().trim().max(240).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: client }, { data: pack, error: packError }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,full_name").eq("id", data.user_id).maybeSingle(),
      supabaseAdmin
        .from("plans")
        .select("id,code,name,kind,ai_credits,ad_quota,period_months")
        .eq("id", data.package_id)
        .eq("active", true)
        .in("kind", ["ai_package", "ad_package"])
        .maybeSingle(),
    ]);
    if (!client) throw new Error("Cliente não encontrado.");
    if (packError || !pack) throw new Error("Pacote de créditos inválido.");

    const isAi = pack.kind === "ai_package";
    const amount = isAi ? Number(pack.ai_credits ?? 0) : Number(pack.ad_quota ?? 0);
    if (amount <= 0) throw new Error("Este pacote não possui créditos válidos.");

    const startsAt = new Date();
    const expiresAt = new Date(startsAt);
    expiresAt.setMonth(expiresAt.getMonth() + Number(pack.period_months ?? 12));
    const { data: code, error: codeError } = await supabaseAdmin.rpc("generate_license_code", {
      _plan_code: pack.code ?? (isAi ? "ai" : "ads"),
    });
    if (codeError || !code) throw new Error("Não foi possível gerar a licença do crédito.");

    const { data: license, error: licenseError } = await supabaseAdmin
      .from("licenses")
      .insert({
        code: code as string,
        plan_id: pack.id,
        period: "annual",
        origin: "admin",
        status: "active",
        user_id: data.user_id,
        activated_at: startsAt.toISOString(),
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        ads_quota: isAi ? null : amount,
        ads_used: 0,
        ai_credits_used: 0,
        note: data.note ? `admin:${context.userId} · ${data.note}` : `admin:${context.userId}`,
      })
      .select("id,code")
      .single();
    if (licenseError || !license) throw new Error("Não foi possível adicionar os créditos ao cliente.");

    await supabaseAdmin.from("activity_events").insert({
      user_id: data.user_id,
      kind: isAi ? "admin_ai_credits_granted" : "admin_ad_credits_granted",
      message: isAi
        ? `${amount} créditos de IA adicionados pelo administrador`
        : `${amount} anúncios extras adicionados pelo administrador`,
      meta: {
        admin_user_id: context.userId,
        package_id: pack.id,
        package_code: pack.code,
        amount,
        license_id: license.id,
      },
    });

    return {
      ok: true as const,
      kind: isAi ? ("ai" as const) : ("ads" as const),
      amount,
      license_code: license.code,
      client: client.email ?? client.full_name ?? client.id,
    };
  });
