import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublishOutcome =
  | { ok: true; ml_item_id: string; permalink: string | null; remaining: number }
  | { ok: false; reason: string; code?: "quota" | "ml" };

/**
 * Publica um rascunho de verdade no Mercado Livre.
 * Limite do plano é validado e consumido no backend — rascunho não consome.
 */
export const publishListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ listing_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PublishOutcome> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: quotaRows } = await supabaseAdmin.rpc("ad_quota_summary", { _user_id: context.userId });
    const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
    if ((quota?.remaining ?? 0) < 1) {
      return { ok: false, reason: "Você atingiu o limite de publicações do seu plano.", code: "quota" };
    }

    const { publishListingToMl } = await import("./ml.server");
    const result = await publishListingToMl(context.userId, data.listing_id);
    if (!result.ok) return { ok: false, reason: result.reason, code: "ml" };

    const { data: consumed } = await supabaseAdmin.rpc("consume_ad_quota", {
      _user_id: context.userId,
      _amount: 1,
    });

    await supabaseAdmin
      .from("listings")
      .update({
        status: "active",
        published_ml_id: result.mlItemId,
        published_at: new Date().toISOString(),
        source_permalink: result.permalink,
      })
      .eq("id", data.listing_id)
      .eq("user_id", context.userId);

    await supabaseAdmin.from("activity_events").insert({
      user_id: context.userId,
      kind: "listing_published",
      message: `Anúncio publicado no Mercado Livre (${result.mlItemId})`,
      meta: { listing_id: data.listing_id, ml_item_id: result.mlItemId, quota_consumed: consumed === true },
    });

    const { data: after } = await supabaseAdmin.rpc("ad_quota_summary", { _user_id: context.userId });
    const afterRow = Array.isArray(after) ? after[0] : after;

    return { ok: true, ml_item_id: result.mlItemId, permalink: result.permalink, remaining: afterRow?.remaining ?? 0 };
  });

/** Verifica quantas publicações podem ser feitas antes de duplicar em massa. */
export const checkBulkAllowance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ requested: z.number().int().min(1).max(1000) }).parse(data))
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
