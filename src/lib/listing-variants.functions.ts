import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ listingId: z.string().uuid(), count: z.union([z.literal(5), z.literal(10)]) });
function firstRow<T>(data: T | T[] | null): T | null { return Array.isArray(data) ? (data[0] ?? null) : data; }

type AdQuota = { quota?: number; used?: number; remaining?: number };

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

    if (listingError || !listing) return { ok: false as const, reason: "Anúncio não encontrado." };

    // Usa a mesma fonte de verdade exibida no painel do cliente. O antigo
    // ad_quota_summary podia divergir de claim_listing_quota em bancos que
    // receberam migrations em momentos diferentes.
    const { data: quotaData, error: quotaError } = await supabaseAdmin.rpc("my_ad_quota");
    if (quotaError) {
      console.error("[variants quota]", quotaError.message);
      return { ok: false as const, reason: "Não foi possível validar sua franquia de anúncios agora." };
    }

    const adQuota = firstRow(quotaData as unknown as AdQuota | AdQuota[]);
    const remaining = Number(adQuota?.remaining ?? 0);
    if (remaining < data.count) {
      return {
        ok: false as const,
        reason: `Você tem ${remaining} anúncio(s) disponível(is) neste ciclo e precisa de ${data.count} para criar todas as variações.`,
      };
    }

    const { getAiQuota } = await import("./ai-quota.server");
    const aiQuota = await getAiQuota(context.userId);
    if (aiQuota.remaining < 1) {
      return { ok: false as const, reason: `Seus créditos de IA acabaram (${aiQuota.used}/${aiQuota.credit_limit}).` };
    }

    const { aiJson, cleanOptimizedTitle, titlesPrompt } = await import("./ai.server");
    const generated = await aiJson<{ titles?: { title?: string; score?: number; keywords?: string[] }[] }>(
      titlesPrompt({ title: listing.title, description: listing.description, category: listing.category, count: data.count }),
    );
    if (!generated.ok) return generated;

    const uniqueTitles = Array.from(new Set(
      (generated.result.titles ?? [])
        .map((item) => cleanOptimizedTitle(String(item?.title ?? "")))
        .filter((title) => title.length >= 3),
    )).slice(0, data.count);

    if (uniqueTitles.length < data.count) {
      return { ok: false as const, reason: "A IA não retornou variações de título suficientes. Tente novamente." };
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
            ? `${created.length} anúncio(s) foram criados antes de ocorrer um erro ao salvar a próxima variação. Eles foram mantidos porque já consumiram a franquia.`
            : "Não foi possível salvar as variações.",
          created,
        };
      }

      const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_listing_quota", {
        _user_id: context.userId,
        _listing_id: copy.id,
      });

      if (claimError || claimed !== true) {
        // Esta cópia ainda não consumiu a franquia, então pode ser removida.
        // As anteriores são mantidas: claim_listing_quota consome uma franquia
        // persistente, que não deve ser "devolvida" ao apagar o anúncio.
        await supabaseAdmin.from("listings").delete().eq("id", copy.id).eq("user_id", context.userId);
        if (claimError) console.error("[variants claim]", claimError.message);
        return {
          ok: false as const,
          reason: created.length
            ? `${created.length} anúncio(s) foram criados antes de a franquia disponível mudar. Os anúncios já criados foram mantidos.`
            : claimError
              ? "Não foi possível registrar a franquia das variações agora. Tente novamente."
              : "A franquia foi alterada antes da criação. Atualize a página e tente novamente.",
          created,
        };
      }

      created.push({ id: copy.id, title: copy.title });
    }

    // Só cobra o crédito quando as 5/10 variações realmente foram criadas.
    const { consumeAiQuota } = await import("./ai-quota.server");
    const consumed = await consumeAiQuota(context.userId, 1);
    if (!consumed.ok) {
      // Não apaga os rascunhos: eles já possuem claims e apagar não devolveria
      // a franquia consumida. Reporta a inconsistência sem perder o trabalho.
      return {
        ok: false as const,
        reason: `${consumed.reason} As ${created.length} variações já criadas foram mantidas na sua lista de anúncios.`,
        created,
      };
    }

    await supabaseAdmin.from("activity_events").insert({
      user_id: context.userId,
      kind: "ai_variants_created",
      message: `${created.length} variações de anúncio criadas com IA`,
      meta: { listing_id: data.listingId, count: created.length },
    });

    return { ok: true as const, created };
  });
