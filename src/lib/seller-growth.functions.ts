import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Opportunity = {
  key: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  count: number;
  action_to: string;
};

export const getSellerGrowthOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const [{ data: listings }, { data: connection }, { data: quota }] = await Promise.all([
      db.from("listings").select("id,title,status,stock,price_cents,cost_cents,fees_cents,ai_score,images,attributes,updated_at"),
      db.from("ml_connections").select("connected,last_sync_at,listings_count").maybeSingle(),
      db.rpc("my_ad_quota"),
    ]);

    const rows = listings ?? [];
    const opportunities: Opportunity[] = [];
    const lowStock = rows.filter((r: any) => Number(r.stock ?? 0) <= 3 && r.status === "active");
    const noCost = rows.filter((r: any) => r.status === "active" && !r.cost_cents);
    const weakAi = rows.filter((r: any) => r.status !== "closed" && Number(r.ai_score ?? 0) < 70);
    const noImages = rows.filter((r: any) => !Array.isArray(r.images) || r.images.length < 3);
    const incomplete = rows.filter((r: any) => !r.title || !r.price_cents || !r.attributes || (Array.isArray(r.attributes) && r.attributes.length === 0));
    const lowMargin = rows.filter((r: any) => {
      const price = Number(r.price_cents ?? 0);
      const cost = Number(r.cost_cents ?? 0);
      const fees = Number(r.fees_cents ?? 0);
      return price > 0 && cost > 0 && ((price - cost - fees) / price) * 100 < 15;
    });

    if (lowStock.length) opportunities.push({ key: "low-stock", severity: "high", title: "Estoque baixo", description: "Anúncios ativos podem perder vendas por falta de estoque.", count: lowStock.length, action_to: "/estoque" });
    if (lowMargin.length) opportunities.push({ key: "low-margin", severity: "high", title: "Margem apertada", description: "Produtos com margem estimada abaixo de 15%.", count: lowMargin.length, action_to: "/estoque" });
    if (weakAi.length) opportunities.push({ key: "weak-ai", severity: "medium", title: "Anúncios para otimizar", description: "Títulos e conteúdo podem melhorar com ANÚNCIO AI.", count: weakAi.length, action_to: "/anuncios" });
    if (noImages.length) opportunities.push({ key: "images", severity: "medium", title: "Poucas imagens", description: "Anúncios com menos de 3 imagens merecem revisão.", count: noImages.length, action_to: "/anuncios" });
    if (noCost.length) opportunities.push({ key: "missing-cost", severity: "low", title: "Custo não informado", description: "Cadastre custo e taxas para enxergar lucro real.", count: noCost.length, action_to: "/estoque" });
    if (incomplete.length) opportunities.push({ key: "incomplete", severity: "medium", title: "Cadastro incompleto", description: "Anúncios com campos importantes ausentes.", count: incomplete.length, action_to: "/anuncios" });
    if (!connection?.connected) opportunities.unshift({ key: "ml-disconnected", severity: "high", title: "Mercado Livre desconectado", description: "Reconecte para sincronizar anúncios, vendas e automações.", count: 1, action_to: "/integracoes" });

    let sales = { orders: 0, revenue_cents: 0, ticket_cents: 0 };
    if (connection?.connected) {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      try {
        const { fetchSellerOrders } = await import("@/lib/orders.server");
        const result = await fetchSellerOrders(context.userId, from.toISOString(), now.toISOString());
        if (result.ok) {
          const paid = result.orders.filter((o) => !["cancelled", "invalid"].includes(o.status));
          const revenue = paid.reduce((sum, o) => sum + Math.round((o.paid_amount ?? o.total_amount) * 100), 0);
          sales = { orders: paid.length, revenue_cents: revenue, ticket_cents: paid.length ? Math.round(revenue / paid.length) : 0 };
        }
      } catch (error) {
        console.error("growth orders summary failed", error);
      }
    }

    const q = Array.isArray(quota) ? quota[0] : quota;
    const weight = { high: 0, medium: 1, low: 2 } as const;
    return {
      opportunities: opportunities.sort((a, b) => weight[a.severity] - weight[b.severity]),
      score: Math.max(0, 100 - opportunities.reduce((sum, o) => sum + (o.severity === "high" ? 18 : o.severity === "medium" ? 9 : 4), 0)),
      sales,
      catalog: { total: rows.length, active: rows.filter((r: any) => r.status === "active").length, value_cents: rows.reduce((sum: number, r: any) => sum + Number(r.price_cents ?? 0), 0) },
      quota: { quota: q?.quota ?? 0, used: q?.used ?? 0, remaining: q?.remaining ?? 0 },
      connection: connection ?? null,
    };
  });

export const calculateSmartPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ cost_cents: z.number().int().positive(), fees_percent: z.number().min(0).max(60).default(16), fixed_fees_cents: z.number().int().min(0).default(0), target_margin_percent: z.number().min(1).max(80).default(20) }).parse(data))
  .handler(async ({ data }) => {
    const variable = data.fees_percent / 100;
    const margin = data.target_margin_percent / 100;
    const denominator = 1 - variable - margin;
    if (denominator <= 0.05) throw new Error("Margem e taxas incompatíveis.");
    const suggested = Math.ceil((data.cost_cents + data.fixed_fees_cents) / denominator);
    const fees = Math.round(suggested * variable) + data.fixed_fees_cents;
    const profit = suggested - data.cost_cents - fees;
    return { suggested_price_cents: suggested, estimated_fees_cents: fees, estimated_profit_cents: profit, estimated_margin_percent: suggested ? Math.round((profit / suggested) * 10000) / 100 : 0 };
  });

export const getReferralSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data: code, error } = await db.rpc("ensure_referral_code");
    if (error) throw new Error("Não foi possível gerar seu código de indicação.");
    const { data: referrals } = await db.from("referrals").select("id,status,reward_ads,created_at").eq("referrer_user_id", context.userId).order("created_at", { ascending: false });
    return { code: String(code), total: referrals?.length ?? 0, converted: (referrals ?? []).filter((r: any) => ["converted", "rewarded"].includes(r.status)).length, rewarded_ads: (referrals ?? []).filter((r: any) => r.status === "rewarded").reduce((sum: number, r: any) => sum + Number(r.reward_ads ?? 0), 0), referrals: referrals ?? [] };
  });

export const listCompetitorWatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data, error } = await db.from("competitor_watch").select("*").order("created_at", { ascending: false });
    if (error) throw new Error("Não foi possível carregar o radar.");
    return data ?? [];
  });

export const addCompetitorWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ml_item_id: z.string().trim().regex(/^MLB\d+$/i), title: z.string().max(200).nullish(), permalink: z.string().url().nullish() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const itemId = data.ml_item_id.toUpperCase();
    const { data: row, error } = await db.from("competitor_watch").upsert({ user_id: context.userId, ml_item_id: itemId, title: data.title ?? null, permalink: data.permalink ?? null }, { onConflict: "user_id,ml_item_id" }).select("*").single();
    if (error) throw new Error("Não foi possível adicionar ao radar.");
    return row;
  });

export const refreshCompetitorWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data: watched } = await db.from("competitor_watch").select("*").eq("user_id", context.userId).limit(50);
    if (!watched?.length) return { updated: 0 };
    const { getValidMlAccessToken } = await import("@/lib/ml.server");
    const token = await getValidMlAccessToken(context.userId);
    if (!token.ok) throw new Error("Reconecte o Mercado Livre para atualizar o radar.");
    let updated = 0;
    for (const row of watched) {
      try {
        const response = await fetch(`https://api.mercadolibre.com/items/${encodeURIComponent(row.ml_item_id)}`, { headers: { Authorization: `Bearer ${token.accessToken}`, Accept: "application/json" } });
        if (!response.ok) continue;
        const item = await response.json() as { title?: string; price?: number; status?: string; permalink?: string };
        await db.from("competitor_watch").update({ title: item.title ?? row.title, last_price_cents: typeof item.price === "number" ? Math.round(item.price * 100) : row.last_price_cents, last_status: item.status ?? row.last_status, permalink: item.permalink ?? row.permalink, last_checked_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", context.userId);
        updated += 1;
      } catch { /* um item não bloqueia os demais */ }
    }
    return { updated };
  });

export const removeCompetitorWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { error } = await db.from("competitor_watch").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível remover do radar.");
    return { ok: true as const };
  });

export const getResellerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data: reseller } = await db.from("resellers").select("*").eq("user_id", context.userId).maybeSingle();
    if (!reseller || reseller.status !== "active") return { enabled: false as const };
    const { data: sales } = await db.from("reseller_sales").select("*, plans(name)").eq("reseller_id", reseller.id).order("created_at", { ascending: false }).limit(100);
    return { enabled: true as const, reseller, sales: sales ?? [] };
  });

export const adminListResellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertCapability } = await import("@/lib/permissions.server");
    await assertCapability(context, "admin.access");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db.from("resellers").select("*").order("created_at", { ascending: false });
    if (error) throw new Error("Não foi possível listar revendedores.");
    return data ?? [];
  });

export const adminCreateReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ name: z.string().min(2).max(120), email: z.string().email(), user_id: z.string().uuid().nullish(), discount_percent: z.number().min(0).max(80).default(20), wallet_cents: z.number().int().min(0).default(0) }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertCapability, logAudit } = await import("@/lib/permissions.server");
    await assertCapability(context, "licenses.generate");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    let resolvedUserId = data.user_id ?? null;
    if (!resolvedUserId) {
      const { data: profile } = await db.from("profiles").select("id").ilike("email", data.email.trim()).maybeSingle();
      resolvedUserId = profile?.id ?? null;
    }
    const payload = { name: data.name, email: data.email.trim().toLowerCase(), user_id: resolvedUserId, discount_percent: data.discount_percent, wallet_cents: data.wallet_cents, created_by: context.userId };
    const { data: row, error } = await db.from("resellers").insert(payload).select("*").single();
    if (error) throw new Error(error.code === "23505" ? "Este usuário já está cadastrado como revendedor." : "Não foi possível criar o revendedor.");
    await logAudit({ actorId: context.userId, action: "reseller.create", entity: "reseller", entityId: row.id, details: { email: data.email, linked_user: !!resolvedUserId, discount_percent: data.discount_percent } });
    return row;
  });
