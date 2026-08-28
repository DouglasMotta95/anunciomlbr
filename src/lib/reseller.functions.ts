import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resellerIssueLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        plan_id: z.string().uuid(),
        period: z.enum(["monthly", "quarterly", "semiannual", "annual"]),
        customer_email: z.string().email().nullish(),
        customer_name: z.string().max(120).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: result, error } = await db.rpc("reseller_issue_license", {
      p_plan_id: data.plan_id,
      p_period: data.period,
    });
    if (error) {
      if (error.message.includes("insufficient_reseller_wallet")) {
        throw new Error("Saldo insuficiente para emitir esta licença.");
      }
      if (error.message.includes("reseller_not_active")) {
        throw new Error("Seu cadastro de revendedor não está ativo.");
      }
      throw new Error("Não foi possível emitir a licença agora.");
    }

    const row = Array.isArray(result) ? result[0] : result;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: reseller } = await admin
      .from("resellers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (reseller?.id) {
      await admin.from("reseller_wallet_transactions").insert({
        reseller_id: reseller.id,
        amount_cents: -Number(row?.reseller_cost_cents ?? 0),
        kind: "license_debit",
        reference: String(row?.license_code ?? ""),
      });
      if (data.customer_email) {
        await admin.from("reseller_customers").upsert(
          {
            reseller_id: reseller.id,
            customer_email: data.customer_email.toLowerCase(),
            customer_name: data.customer_name ?? null,
            last_license_code: String(row?.license_code ?? ""),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "reseller_id,customer_email" },
        );
      }
    }

    return {
      license_code: row?.license_code as string,
      reseller_cost_cents: Number(row?.reseller_cost_cents ?? 0),
      suggested_sale_cents: Number(row?.suggested_sale_cents ?? 0),
      wallet_remaining_cents: Number(row?.wallet_remaining_cents ?? 0),
    };
  });

export const getResellerProfessionalSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: reseller } = await db
      .from("resellers")
      .select("id,status,wallet_cents,discount_percent,total_sales_cents,total_commission_cents")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!reseller) return { enabled: false as const, customers: [], wallet: [] };

    const [{ data: customers }, { data: wallet }] = await Promise.all([
      db
        .from("reseller_customers")
        .select("*")
        .eq("reseller_id", reseller.id)
        .order("updated_at", { ascending: false })
        .limit(50),
      db
        .from("reseller_wallet_transactions")
        .select("*")
        .eq("reseller_id", reseller.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      enabled: true as const,
      reseller,
      customers: customers ?? [],
      wallet: wallet ?? [],
    };
  });

export const adminUpdateReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        wallet_delta_cents: z.number().int().min(-100000000).max(100000000).default(0),
        discount_percent: z.number().min(0).max(80).optional(),
        status: z.enum(["active", "suspended", "closed"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertCapability, logAudit } = await import("@/lib/permissions.server");
    await assertCapability(context, "licenses.generate");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: current } = await db
      .from("resellers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) throw new Error("Revendedor não encontrado.");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.discount_percent !== undefined) patch["discount_percent"] = data.discount_percent;
    if (data.status !== undefined) patch["status"] = data.status;
    if (data.wallet_delta_cents !== 0) {
      patch["wallet_cents"] = Math.max(
        0,
        Number(current?.["wallet_cents"] ?? 0) + data.wallet_delta_cents,
      );
    }

    const { data: updated, error } = await db
      .from("resellers")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error("Não foi possível atualizar o revendedor.");

    if (data.wallet_delta_cents !== 0) {
      await db.from("reseller_wallet_transactions").insert({
        reseller_id: data.id,
        amount_cents: data.wallet_delta_cents,
        kind: "adjustment",
        reference: "admin",
      });
    }

    await logAudit({
      actorId: context.userId,
      action: "reseller.update",
      entity: "reseller",
      entityId: data.id,
      details: {
        wallet_delta_cents: data.wallet_delta_cents,
        ...(data.discount_percent !== undefined
          ? { discount_percent: data.discount_percent }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
    return updated;
  });
