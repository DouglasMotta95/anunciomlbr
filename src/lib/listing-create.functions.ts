import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const draftSchema = z.object({
  title: z.string().trim().min(3).max(60),
  description: z.string().optional().nullable(),
  price_cents: z.number().int().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative().default(1),
  sku: z.string().trim().max(120).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  condition: z.string().trim().max(40).optional().nullable(),
  images: z.array(z.string().url()).max(20).optional(),
  attributes: z.unknown().optional(),
  source_ml_id: z.string().trim().max(80).optional().nullable(),
  source_permalink: z.string().url().optional().nullable(),
  dedupe_source: z.boolean().optional().default(false),
});

type DraftInput = z.infer<typeof draftSchema>;

type QuotaRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
};

function cleanTitle(value: string) {
  return value
    .replace(/\s*\((?:copy|cópia)\)\s*$/gi, "")
    .replace(/\s+\b(?:copy|cópia)\b\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

async function claimQuotaOrRollback(userId: string, listingId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const quotaClient = supabaseAdmin as unknown as QuotaRpcClient;
  const { data: claimed, error } = await quotaClient.rpc("claim_listing_quota", {
    _user_id: userId,
    _listing_id: listingId,
  });

  if (error || claimed !== true) {
    await supabaseAdmin.from("listings").delete().eq("id", listingId).eq("user_id", userId);
    if (error) console.error("listing quota claim failed", error.message);
    return {
      ok: false as const,
      reason: error
        ? "Não foi possível validar sua franquia de criações agora. Tente novamente; se continuar, confira a Central da assinatura."
        : "Você atingiu a franquia de criações e clonagens deste ciclo. Seus anúncios existentes continuam ativos. Compre anúncios extras na Central da assinatura ou faça upgrade para criar novos.",
    };
  }

  return { ok: true as const };
}

async function createDraftForUser(userId: string, input: DraftInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (input.dedupe_source && input.source_ml_id) {
    const { data: existing } = await supabaseAdmin
      .from("listings")
      .select("id")
      .eq("user_id", userId)
      .eq("source_ml_id", input.source_ml_id)
      .maybeSingle();
    if (existing?.id) return { ok: true as const, id: existing.id, existed: true as const };
  }

  const title = cleanTitle(input.title);
  if (title.length < 3) return { ok: false as const, reason: "Informe um título válido." };

  const { data: created, error } = await supabaseAdmin
    .from("listings")
    .insert({
      user_id: userId,
      status: "draft",
      title,
      description: input.description ?? null,
      price_cents: input.price_cents ?? null,
      stock: input.stock,
      sku: input.sku ?? null,
      category: input.category ?? null,
      condition: input.condition ?? null,
      images: (input.images ?? []) as never,
      attributes: (input.attributes ?? []) as never,
      source_ml_id: input.source_ml_id ?? null,
      source_permalink: input.source_permalink ?? null,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("listing draft insert failed", error?.message);
    return { ok: false as const, reason: "Não foi possível criar o anúncio." };
  }

  const quota = await claimQuotaOrRollback(userId, created.id);
  if (!quota.ok) return quota;
  return { ok: true as const, id: created.id, existed: false as const };
}

/** Cria/importa/clona um anúncio e consome 1 unidade da franquia somente após a inserção ter sucesso. */
export const createListingDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => draftSchema.parse(data))
  .handler(async ({ data, context }) => createDraftForUser(context.userId, data));

/** Duplica um anúncio interno mantendo título limpo, preço, imagens e atributos. */
export const duplicateListingDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ listing_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: listing, error } = await supabaseAdmin
      .from("listings")
      .select(
        "title,description,price_cents,stock,sku,category,condition,images,attributes,cost_cents,fees_cents,ai_score,source_permalink",
      )
      .eq("id", data.listing_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error || !listing) return { ok: false as const, reason: "Anúncio não encontrado." };

    const { data: created, error: insertError } = await supabaseAdmin
      .from("listings")
      .insert({
        ...listing,
        user_id: context.userId,
        status: "draft",
        title: cleanTitle(String(listing.title ?? "")),
      })
      .select("id")
      .single();

    if (insertError || !created) {
      console.error("listing duplicate failed", insertError?.message);
      return { ok: false as const, reason: "Não foi possível criar a cópia." };
    }

    const quota = await claimQuotaOrRollback(context.userId, created.id);
    if (!quota.ok) return quota;
    return { ok: true as const, id: created.id };
  });
