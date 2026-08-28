import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  listingId: z.string().uuid(),
  count: z.union([z.literal(5), z.literal(10)]),
});

type QuotaRow = { remaining?: number; used?: number; credit_limit?: number };

function firstRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export const createAiListingVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: listing, error: listingError } = await supabaseAdmin
      .from("listings")
      .select("id,title,description,price_cents,stock,sku,category,condition,images,attributes,cost_cents,fees_cents,ai_score,source_permalink")
      .eq("id", data.listingId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (listingError || !listing) {
      return { ok: false as const, reason: "Anúncio não encontrado." };
    }

    const { data: adQuotaData, error: adQuotaError } = await supabaseAdmin.rpc("ad_quota_summary", {
      _user_id: context.userId,
    });
    if (adQuotaError) {
      console.error("[variants quota]", adQuotaError.message);
      return { ok: false as const, reason: "Não foi possível validar sua franquia de anúncios." };
    }
    const adQuota = firstRow(adQuotaData as unknown as { remaining?: number } | { remaining?: number }[]);
    if ((adQuota?.remaining ?? 0) < data.count) {
      return {
        ok: false as const,
        reason: `Você precisa de ${data.count} anúncios disponíveis no ciclo para criar essas variações.`,
      };
    }

    const { data: aiQuotaData, error: aiQuotaError } = await supabaseAdmin.rpc("ai_credit_status", {
      p_user_id: context.userId,
    });
    if (aiQuotaError) {
      console.error("[variants AI quota]", aiQuotaError.message);
      return { ok: false as const, reason: "Não foi possível validar seus créditos de IA." };
    }
    const aiQuota = firstRow(aiQuotaData as unknown as QuotaRow | QuotaRow[]);
    if ((aiQuota?.remaining ?? 0) < 1) {
      return {
        ok: false as const,
        reason: `Seus créditos de IA acabaram (${aiQuota?.used ?? 0}/${aiQuota?.credit_limit ?? 0}).`,
      };
    }

    const { aiJson, cleanOptimizedTitle, titlesPrompt } = await import("./ai.server");
    const generated = await aiJson<{ titles?: { title?: string; score?: number; keywords?: string[] }[] }>(
      titlesPrompt({
        title: listing.title,
        description: listing.description,
        category: listing.category,
        count: data.count,
      }),
    );
    if (!generated.ok) return generated;

    const uniqueTitles = Array.from(
      new Set(
        (generated.result.titles ?? [])
          .map((item) => cleanOptimizedTitle(String(item?.title ?? "")))
          .filter((title) => title.length >= 3),
      ),
    ).slice(0, data.count);

    if (uniqueTitles.length < data.count) {
      return {
        ok: false as const,
        reason: "A IA não retornou variações de título suficientes. Tente novamente.",
      };
    }

    const { data: consumeData, error: consumeError } = await supabaseAdmin.rpc("consume_ai_credit", {
      p_user_id: context.userId,
      p_amount: 1,
    });
    const consumed = firstRow(consumeData as unknown as { allowed?: boolean } | { allowed?: boolean }[]);
    if (consumeError || !consumed?.allowed) {
      if (consumeError) console.error("[variants AI consume]", consumeError.message);
      return { ok: false as const, reason: "Não foi possível registrar o uso da IA. Tente novamente." };
    }

    const created: { id: string; title: string }[] = [];
    for (const title of uniqueTitles) {
      const { data: copy, error } = await supabaseAdmin
        .from("listings")
        .insert({
          user_id: context.userId,
          title,
          description: listing.description,
          price_cents: listing.price_cents,
          stock: listing.stock,
          sku: listing.sku,
          category: listing.category,
          condition: listing.condition,
          images: listing.images,
          attributes: listing.attributes,
          cost_cents: listing.cost_cents,
          fees_cents: listing.fees_cents,
          ai_score: listing.ai_score,
          source_permalink: listing.source_permalink,
          source_ml_id: null,
          status: "draft",
        })
        .select("id,title")
        .single();

      if (error || !copy) {
        return {
          ok: false as const,
          reason: created.length
            ? `${created.length} variação(ões) foram criadas, mas o processo parou por um erro ao salvar a próxima.`
            : "Não foi possível salvar as variações.",
          created,
        };
      }

      const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_listing_quota", {
        _user_id: context.userId,
        _listing_id: copy.id,
      });
      if (claimError || claimed !== true) {
        await supabaseAdmin.from("listings").delete().eq("id", copy.id).eq("user_id", context.userId);
        return {
          ok: false as const,
          reason: created.length
            ? `${created.length} variação(ões) foram criadas antes do limite do ciclo ser atingido.`
            : "Limite de anúncios deste ciclo atingido.",
          created,
        };
      }

      created.push({ id: copy.id, title: copy.title });
    }

    return { ok: true as const, created };
  });
