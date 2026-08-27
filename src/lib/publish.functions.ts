import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublishOutcome =
  | { ok: true; ml_item_id: string; permalink: string | null; remaining: number }
  | { ok: false; reason: string; code?: "quota" | "ml" };

const idsSchema = z.object({ listing_ids: z.array(z.string().uuid()).min(1).max(200) });

function localIssues(listing: any): string[] {
  const issues: string[] = [];
  if (!String(listing?.title ?? "").trim()) issues.push("Título ausente");
  if (String(listing?.title ?? "").length > 60) issues.push("Título acima de 60 caracteres");
  if (!listing?.category) issues.push("Categoria ausente");
  if (!listing?.price_cents || listing.price_cents <= 0) issues.push("Preço inválido");
  if (listing?.stock == null || listing.stock < 0) issues.push("Estoque inválido");
  if (!Array.isArray(listing?.images) || listing.images.length === 0) issues.push("Sem imagem");
  return issues;
}

export const validateListingsForPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: listings, error } = await context.supabase
      .from("listings")
      .select("id,title,category,price_cents,stock,images,status,published_ml_id")
      .eq("user_id", context.userId)
      .in("id", data.listing_ids);
    if (error) return { ok: false as const, reason: "Não foi possível validar os anúncios.", items: [] };
    const items = (listings ?? []).map((listing: any) => {
      const issues = localIssues(listing);
      if (listing.published_ml_id) issues.push("Anúncio já publicado no Mercado Livre");
      return { id: listing.id, title: listing.title, ready: issues.length === 0, issues };
    });
    return { ok: true as const, items, ready: items.filter((i) => i.ready).length, blocked: items.filter((i) => !i.ready).length };
  });

export const publishListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ listing_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PublishOutcome> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quotaRows } = await supabaseAdmin.rpc("ad_quota_summary", { _user_id: context.userId });
    const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
    if ((quota?.remaining ?? 0) < 1) return { ok: false, reason: "Você atingiu o limite de publicações do seu plano.", code: "quota" };

    const { publishListingToMl } = await import("./ml.server");
    const result = await publishListingToMl(context.userId, data.listing_id);
    if (!result.ok) return { ok: false, reason: result.reason, code: "ml" };

    const { data: consumed } = await supabaseAdmin.rpc("consume_ad_quota", { _user_id: context.userId, _amount: 1 });
    await supabaseAdmin.from("listings").update({
      status: "active", published_ml_id: result.mlItemId, published_at: new Date().toISOString(), source_permalink: result.permalink,
    }).eq("id", data.listing_id).eq("user_id", context.userId);
    await supabaseAdmin.from("activity_events").insert({
      user_id: context.userId, kind: "listing_published", message: `Anúncio publicado no Mercado Livre (${result.mlItemId})`,
      meta: { listing_id: data.listing_id, ml_item_id: result.mlItemId, quota_consumed: consumed === true },
    });
    const { data: after } = await supabaseAdmin.rpc("ad_quota_summary", { _user_id: context.userId });
    const afterRow = Array.isArray(after) ? after[0] : after;
    return { ok: true, ml_item_id: result.mlItemId, permalink: result.permalink, remaining: afterRow?.remaining ?? 0 };
  });

export const publishListingsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.rpc("ad_quota_summary", { _user_id: context.userId });
    const quota = Array.isArray(rows) ? rows[0] : rows;
    let remaining = Number(quota?.remaining ?? 0);
    if (remaining < 1) return { ok: false as const, reason: "Você atingiu o limite de publicações do seu plano.", results: [] };

    const { data: listings } = await supabaseAdmin.from("listings").select("*").eq("user_id", context.userId).in("id", data.listing_ids);
    const byId = new Map((listings ?? []).map((l: any) => [l.id, l]));
    const { publishListingToMl } = await import("./ml.server");
    const results: Array<{ id: string; ok: boolean; ml_item_id?: string; reason?: string }> = [];

    for (const id of data.listing_ids) {
      if (remaining < 1) { results.push({ id, ok: false, reason: "Limite do plano atingido" }); continue; }
      const listing: any = byId.get(id);
      const issues = listing ? localIssues(listing) : ["Anúncio não encontrado"];
      if (listing?.published_ml_id) issues.push("Anúncio já publicado");
      if (issues.length) { results.push({ id, ok: false, reason: issues.join(" · ") }); continue; }
      const result = await publishListingToMl(context.userId, id);
      if (!result.ok) { results.push({ id, ok: false, reason: result.reason }); continue; }
      const { data: consumed } = await supabaseAdmin.rpc("consume_ad_quota", { _user_id: context.userId, _amount: 1 });
      await supabaseAdmin.from("listings").update({ status: "active", published_ml_id: result.mlItemId, published_at: new Date().toISOString(), source_permalink: result.permalink }).eq("id", id).eq("user_id", context.userId);
      results.push({ id, ok: true, ml_item_id: result.mlItemId });
      if (consumed === true) remaining -= 1;
    }
    const success = results.filter((r) => r.ok).length;
    await supabaseAdmin.from("activity_events").insert({ user_id: context.userId, kind: "bulk_publish", message: `Publicação em massa: ${success} sucesso(s), ${results.length - success} pendência(s)`, meta: { total: results.length, success } });
    return { ok: true as const, results, success, failed: results.length - success };
  });

export const checkBulkAllowance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ requested: z.number().int().min(1).max(1000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.rpc("my_ad_quota");
    const row = Array.isArray(rows) ? rows[0] : rows;
    const remaining = row?.remaining ?? 0;
    return { remaining, allowed: Math.min(data.requested, remaining), blocked: data.requested > remaining };
  });
