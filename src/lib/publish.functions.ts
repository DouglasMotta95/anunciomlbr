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
    const adminListings = supabaseAdmin.from("listings") as any;

    const { data: existing, error: existingError } = await adminListings
      .select("published_ml_id,source_permalink,publishing_claim_token,publishing_claimed_at")
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
    if (existing.publishing_claim_token) {
      return {
        ok: false,
        reason: "Este anúncio já está com uma publicação em andamento. Atualize a página antes de tentar novamente.",
        code: "ml",
      };
    }

    // Claim atômico no banco. Se duas requisições chegarem juntas, apenas uma
    // consegue trocar NULL por seu token; a outra recebe zero linhas atualizadas.
    const claimToken = globalThis.crypto.randomUUID();
    const claimedAt = new Date().toISOString();
    const { data: claim, error: claimError } = await adminListings
      .update({ publishing_claim_token: claimToken, publishing_claimed_at: claimedAt })
      .eq("id", data.listing_id)
      .eq("user_id", context.userId)
      .is("published_ml_id", null)
      .is("publishing_claim_token", null)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("listing publication claim failed", claimError.message);
      return { ok: false, reason: "Não foi possível reservar este anúncio para publicação.", code: "ml" };
    }
    if (!claim) {
      const { data: raced } = await adminListings
        .select("published_ml_id,source_permalink")
        .eq("id", data.listing_id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (raced?.published_ml_id) {
        return {
          ok: true,
          ml_item_id: String(raced.published_ml_id),
          permalink: raced.source_permalink ?? null,
          remaining: await getRemainingAds(context.userId),
        };
      }
      return {
        ok: false,
        reason: "Este anúncio já está com uma publicação em andamento. Aguarde e atualize a página.",
        code: "ml",
      };
    }

    const releaseClaim = async () => {
      const { error } = await adminListings
        .update({ publishing_claim_token: null, publishing_claimed_at: null })
        .eq("id", data.listing_id)
        .eq("user_id", context.userId)
        .eq("publishing_claim_token", claimToken)
        .is("published_ml_id", null);
      if (error) console.error("listing publication claim release failed", error.message);
    };

    const { publishListingToMl } = await import("./ml.server");
    let result: Awaited<ReturnType<typeof publishListingToMl>>;
    try {
      result = await publishListingToMl(context.userId, data.listing_id);
    } catch (error) {
      // Falha de rede é ambígua: o ML pode ter criado o anúncio e a resposta ter
      // se perdido. Mantemos o claim para impedir um retry que poderia duplicá-lo.
      console.error("listing publication returned ambiguous network failure", {
        listingId: data.listing_id,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        ok: false,
        reason: "A comunicação com o Mercado Livre foi interrompida durante a publicação. Não publique novamente agora; atualize a página e confira sua conta do Mercado Livre.",
        code: "ml",
      };
    }

    if (!result.ok) {
      // Uma resposta explícita de recusa do ML é segura para retry.
      await releaseClaim();
      return { ok: false, reason: result.reason, code: "ml" };
    }

    const { data: updated, error: updateError } = await adminListings
      .update({
        status: "active",
        published_ml_id: result.mlItemId,
        published_at: new Date().toISOString(),
        source_permalink: result.permalink,
        publishing_claim_token: null,
        publishing_claimed_at: null,
      })
      .eq("id", data.listing_id)
      .eq("user_id", context.userId)
      .eq("publishing_claim_token", claimToken)
      .is("published_ml_id", null)
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
