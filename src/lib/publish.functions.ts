import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublishOutcome =
  | { ok: true; ml_item_id: string; permalink: string | null; remaining: number }
  | { ok: false; reason: string; code?: "quota" | "ml" };

async function getRemainingAds(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: after } = await supabaseAdmin.rpc("ad_quota_summary", { _user_id: userId });
  const afterRow = Array.isArray(after) ? after[0] : after;
  return afterRow?.remaining ?? 0;
}

/**
 * Publica um rascunho de verdade no Mercado Livre.
 * A franquia é consumida quando o anúncio é criado/copiado/duplicado no ANÚNCIO ML,
 * portanto publicar um rascunho já existente não cobra uma segunda unidade.
 */
export const publishListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ listing_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PublishOutcome> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotência: uma repetição do clique/retry não pode criar outro anúncio no ML.
    const { data: existing, error: existingError } = await context.supabase
      .from("listings")
      .select("published_ml_id, source_permalink")
      .eq("id", data.listing_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existingError) return { ok: false, reason: "Não foi possível validar o anúncio antes da publicação.", code: "ml" };
    if (!existing) return { ok: false, reason: "Anúncio não encontrado.", code: "ml" };
    if (existing.published_ml_id) {
      return {
        ok: true,
        ml_item_id: String(existing.published_ml_id),
        permalink: existing.source_permalink ?? null,
        remaining: await getRemainingAds(context.userId),
      };
    }

    const { publishListingToMl } = await import("./ml.server");
    const result = await publishListingToMl(context.userId, data.listing_id);
    if (!result.ok) return { ok: false, reason: result.reason, code: "ml" };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("listings")
      .update({
        status: "active",
        published_ml_id: result.mlItemId,
        published_at: new Date().toISOString(),
        source_permalink: result.permalink,
      })
      .eq("id", data.listing_id)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      console.error("listing published on ML but local persistence failed", {
        listingId: data.listing_id,
        mlItemId: result.mlItemId,
      });
      return {
        ok: false,
        reason: `O anúncio foi criado no Mercado Livre (${result.mlItemId}), mas o painel não conseguiu salvar o vínculo. Não publique novamente; atualize a página e procure o anúncio pelo código informado.`,
        code: "ml",
      };
    }

    const { error: activityError } = await supabaseAdmin.from("activity_events").insert({
      user_id: context.userId,
      kind: "listing_published",
      message: `Anúncio publicado no Mercado Livre (${result.mlItemId})`,
      meta: { listing_id: data.listing_id, ml_item_id: result.mlItemId },
    });
    if (activityError) console.error("listing publish activity log failed", activityError.message);

    return {
      ok: true,
      ml_item_id: result.mlItemId,
      permalink: result.permalink,
      remaining: await getRemainingAds(context.userId),
    };
  });

/** Verifica quantos anúncios ainda podem ser criados/duplicados no ciclo atual. */
export const checkBulkAllowance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ requested: z.number().int().min(1).max(1000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.rpc("my_ad_quota");
    const row = Array.isArray(rows) ? rows[0] : rows;
    const remaining = row?.remaining ?? 0;
    return {
      remaining,
      allowed: Math.min(data.requested, remaining),
      blocked: data.requested > remaining,
    };
  });
