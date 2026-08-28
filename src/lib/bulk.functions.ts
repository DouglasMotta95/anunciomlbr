import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BulkItemStatus = "queued" | "processing" | "done" | "error";
export type BulkJobItem = {
  id: string;
  label: string;
  status: BulkItemStatus;
  message?: string | null;
  source?: Record<string, unknown> | null;
};
export type BulkJobKind =
  | "copy"
  | "duplicate"
  | "optimize"
  | "pause"
  | "activate"
  | "archive"
  | "delete";

const startSchema = z.object({
  kind: z.enum(["copy", "duplicate", "optimize", "pause", "activate", "archive", "delete"]),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        source: z.record(z.string(), z.unknown()).optional().nullable(),
      }),
    )
    .min(1)
    .max(200),
});

type QuotaRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
};

export const startBulkJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => startSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const items: BulkJobItem[] = data.items.map((item) => ({
      id: item.id,
      label: item.label,
      status: "queued",
      message: null,
      source: item.source ?? null,
    }));
    const { data: job, error } = await supabaseAdmin
      .from("bulk_jobs")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        status: "queued",
        total: items.length,
        processed: 0,
        failed: 0,
        payload: { items } as never,
      })
      .select("id")
      .single();
    if (error || !job) return { ok: false as const, reason: "Não foi possível criar o processamento." };
    await processBulkJob(job.id, context.userId, data.kind, items);
    return { ok: true as const, jobId: job.id };
  });

export const getBulkJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("bulk_jobs")
      .select("*")
      .eq("id", data.jobId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !job) return { ok: false as const, job: null };
    return { ok: true as const, job };
  });

async function processBulkJob(
  jobId: string,
  userId: string,
  kind: BulkJobKind,
  items: BulkJobItem[],
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("bulk_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  let processed = 0;
  let failed = 0;
  const state = [...items];
  const persist = async () => {
    await supabaseAdmin
      .from("bulk_jobs")
      .update({
        processed,
        failed,
        payload: { items: state } as unknown as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  };

  for (const item of state) {
    item.status = "processing";
    await persist();
    try {
      await runBulkItem(kind, userId, item);
      item.status = "done";
      item.message = null;
      processed += 1;
    } catch (error) {
      item.status = "error";
      item.message = error instanceof Error ? error.message : "Erro inesperado";
      failed += 1;
    }
    await persist();
  }

  await supabaseAdmin
    .from("bulk_jobs")
    .update({
      status: failed > 0 && processed === 0 ? "error" : "done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  await supabaseAdmin.from("activity_events").insert({
    user_id: userId,
    kind: `bulk_${kind}`,
    message: `Processamento em massa concluído: ${processed} sucesso(s), ${failed} erro(s)`,
    meta: { jobId, kind, processed, failed, total: state.length },
  });
}

function normalizeHttps(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("http://") ? `https://${value.slice(7)}` : value;
}

function sourceImages(source: Record<string, unknown>): string[] {
  const provided = Array.isArray(source["images"])
    ? (source["images"] as unknown[])
        .map(normalizeHttps)
        .filter((value): value is string => !!value)
    : [];
  if (provided.length) return Array.from(new Set(provided));
  const thumbnail = normalizeHttps(source["thumbnail"]);
  return thumbnail ? [thumbnail] : [];
}

async function claimListingQuota(userId: string, listingId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const quotaClient = supabaseAdmin as unknown as QuotaRpcClient;
  const { data, error } = await quotaClient.rpc("claim_listing_quota", {
    _user_id: userId,
    _listing_id: listingId,
  });
  if (error || data !== true) {
    await supabaseAdmin.from("listings").delete().eq("id", listingId).eq("user_id", userId);
    if (error) console.error("bulk listing quota claim failed", error.message);
    throw new Error(
      error
        ? "Não foi possível validar sua franquia de criações agora. Tente novamente."
        : "Franquia de criações e clonagens deste ciclo atingida. Seus anúncios existentes continuam ativos; compre anúncios extras na Central da assinatura ou faça upgrade.",
    );
  }
}

async function checkBulkAiCredit(userId: string) {
  const { getAiQuota } = await import("./ai-quota.server");
  const quota = await getAiQuota(userId);
  if (quota.remaining < 1) {
    throw new Error(
      `Créditos de IA esgotados (${quota.used}/${quota.credit_limit}). Compre créditos extras de IA na Central da assinatura ou faça upgrade.`,
    );
  }
}

async function consumeBulkAiCredit(userId: string) {
  const { consumeAiQuota } = await import("./ai-quota.server");
  const result = await consumeAiQuota(userId, 1);
  if (!result.ok) throw new Error(result.reason);
}

async function runBulkItem(kind: BulkJobKind, userId: string, item: BulkJobItem) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (kind === "copy") {
    const source = item.source ?? {};
    const priceCents = typeof source["price_cents"] === "number" ? source["price_cents"] : null;
    const attributes = Array.isArray(source["attributes"]) ? source["attributes"] : [];
    const category = typeof source["category"] === "string" ? source["category"] : null;
    const condition = typeof source["condition"] === "string" ? source["condition"] : null;
    const sourcePermalink = typeof source["permalink"] === "string" ? source["permalink"] : null;
    const stock = typeof source["available_quantity"] === "number" ? source["available_quantity"] : 1;

    const { data: existing } = await supabaseAdmin
      .from("listings")
      .select("id")
      .eq("user_id", userId)
      .eq("source_ml_id", item.id)
      .maybeSingle();
    if (existing?.id) return;

    const { data: created, error } = await supabaseAdmin
      .from("listings")
      .insert({
        user_id: userId,
        title: String(source["title"] ?? item.label)
          .replace(/\s*\((?:copy|cópia)\)\s*$/i, "")
          .slice(0, 60),
        price_cents: priceCents,
        category,
        condition,
        status: "draft",
        source_ml_id: item.id,
        source_permalink: sourcePermalink,
        images: sourceImages(source) as unknown as never,
        attributes: attributes as unknown as never,
        stock,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Não foi possível clonar o anúncio.");
    await claimListingQuota(userId, created.id);
    return;
  }

  if (kind === "duplicate") {
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from("listings")
      .select(
        "title,description,price_cents,stock,sku,category,condition,images,attributes,cost_cents,fees_cents,ai_score,source_permalink",
      )
      .eq("id", item.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchError || !listing) throw new Error("Anúncio não encontrado.");

    const { cleanOptimizedTitle } = await import("./ai.server");
    const images = Array.isArray(listing.images) ? listing.images : [];
    const attributes = Array.isArray(listing.attributes) ? listing.attributes : [];
    const { data: created, error } = await supabaseAdmin
      .from("listings")
      .insert({
        user_id: userId,
        status: "draft",
        title: cleanOptimizedTitle(String(listing.title ?? item.label)),
        description: listing.description ?? null,
        price_cents: listing.price_cents ?? null,
        stock: listing.stock ?? null,
        sku: listing.sku ?? null,
        category: listing.category ?? null,
        condition: listing.condition ?? null,
        images: images as unknown as never,
        attributes: attributes as unknown as never,
        cost_cents: listing.cost_cents ?? null,
        fees_cents: listing.fees_cents ?? null,
        ai_score: listing.ai_score ?? null,
        source_permalink: listing.source_permalink ?? null,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Não foi possível criar a cópia.");
    await claimListingQuota(userId, created.id);
    return;
  }

  if (kind === "delete") {
    const { error } = await supabaseAdmin
      .from("listings")
      .delete()
      .eq("id", item.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  if (kind === "pause" || kind === "activate" || kind === "archive") {
    const nextStatus = kind === "pause" ? "paused" : kind === "activate" ? "active" : "closed";
    const { error } = await supabaseAdmin
      .from("listings")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  if (kind === "optimize") {
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from("listings")
      .select("id,title,description,category,price_cents,attributes,images")
      .eq("id", item.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchError || !listing) throw new Error("Anúncio não encontrado.");

    await checkBulkAiCredit(userId);
    const { aiJson, cleanOptimizedTitle, optimizationPrompt } = await import("./ai.server");
    const imagesCount = Array.isArray(listing.images) ? listing.images.length : 0;
    const out = await aiJson<{
      title?: string | undefined;
      description?: string | undefined;
      score_after?: number | undefined;
    }>(
      optimizationPrompt({
        title: String(listing.title ?? item.label),
        description: listing.description ?? null,
        category: listing.category ?? null,
        price_cents: listing.price_cents ?? null,
        attributes: listing.attributes ?? [],
        images_count: imagesCount,
      }),
    );
    if (!out.ok) throw new Error(out.reason);

    const parsed = out.result;
    if (!parsed.title || !parsed.description) {
      throw new Error("A IA não retornou título e descrição válidos.");
    }
    const cleanTitle = cleanOptimizedTitle(parsed.title);
    if (cleanTitle.length < 3) throw new Error("A IA não retornou um título válido.");

    await consumeBulkAiCredit(userId);
    const aiScore = Number.isFinite(parsed.score_after)
      ? Math.max(0, Math.min(100, Number(parsed.score_after)))
      : null;
    const { error: updateError } = await supabaseAdmin
      .from("listings")
      .update({
        title: cleanTitle,
        description: parsed.description.trim(),
        ai_score: aiScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("user_id", userId);
    if (updateError) throw new Error(updateError.message);
  }
}
