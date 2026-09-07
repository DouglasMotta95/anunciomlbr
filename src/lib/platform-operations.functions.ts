import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleSchema = z.enum(["manager", "operator", "viewer"]);
const operationSchema = z.enum(["pause", "activate", "price_simulation", "stock_review", "listing_review", "copy_draft"]);

export const getPlatformFoundation = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase as any;
  const [accounts, members, operations, kits, listings] = await Promise.all([
    db.from("seller_accounts").select("*").eq("owner_user_id", context.userId).order("created_at", { ascending: false }),
    db.from("workspace_members").select("*").eq("owner_user_id", context.userId).order("created_at", { ascending: false }),
    db.from("bulk_operations").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(20),
    db.from("product_kits").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }),
    db.from("listings").select("id,title,ml_id,status,price_cents").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(200),
  ]);
  return { accounts: accounts.data ?? [], members: members.data ?? [], operations: operations.data ?? [], kits: kits.data ?? [], listings: listings.data ?? [] };
});

export const syncPrimarySellerAccount = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase as any;
  const { data: connection } = await db.from("ml_connections").select("ml_user_id,nickname,connected").eq("user_id", context.userId).maybeSingle();
  if (!connection?.ml_user_id) return { ok: false as const, reason: "missing_connection" };
  const mlUserId = String(connection.ml_user_id);
  const values = { nickname: connection.nickname ?? null, label: connection.nickname || "Conta principal", status: connection.connected ? "connected" : "disconnected", is_primary: true, updated_at: new Date().toISOString() };
  const { data: existing, error: lookupError } = await db.from("seller_accounts").select("id").eq("owner_user_id", context.userId).eq("ml_user_id", mlUserId).maybeSingle();
  if (lookupError) return { ok: false as const, reason: lookupError.message };
  const write = existing?.id
    ? await db.from("seller_accounts").update(values).eq("id", existing.id).eq("owner_user_id", context.userId)
    : await db.from("seller_accounts").insert({ owner_user_id: context.userId, ml_user_id: mlUserId, ...values });
  if (write.error) return { ok: false as const, reason: write.error.message };
  return { ok: true as const };
});

export const inviteWorkspaceMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ email: z.string().email(), role: roleSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const email = data.email.trim().toLowerCase();
    const { error } = await db.from("workspace_members").upsert({ owner_user_id: context.userId, member_email: email, role: data.role, status: "invited", updated_at: new Date().toISOString() }, { onConflict: "owner_user_id,member_email" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createBulkOperation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ operationType: operationSchema, listingIds: z.array(z.string().uuid()).min(1).max(200), payload: z.record(z.string(), z.unknown()).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const uniqueIds = [...new Set(data.listingIds)];
    const { data: owned } = await db.from("listings").select("id").eq("user_id", context.userId).in("id", uniqueIds);
    const ownedIds = (owned ?? []).map((row: { id: string }) => row.id);
    if (ownedIds.length !== uniqueIds.length) throw new Error("Há anúncios que não pertencem a esta conta.");
    const { data: row, error } = await db.from("bulk_operations").insert({ user_id: context.userId, operation_type: data.operationType, target_listing_ids: ownedIds, payload: data.payload ?? {}, status: "simulated", dry_run: true, result: { target_count: ownedIds.length, external_write: false } }).select("id,status,dry_run,result").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createProductKit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ name: z.string().trim().min(2).max(100), sku: z.string().trim().max(80).optional(), listingIds: z.array(z.string().uuid()).min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const uniqueIds = [...new Set(data.listingIds)];
    const { data: owned } = await db.from("listings").select("id").eq("user_id", context.userId).in("id", uniqueIds);
    const ids = (owned ?? []).map((row: { id: string }) => row.id);
    if (ids.length !== uniqueIds.length) throw new Error("Kit contém anúncio inválido.");
    const quantities = Object.fromEntries(ids.map((id: string) => [id, 1]));
    const { data: row, error } = await db.from("product_kits").insert({ user_id: context.userId, name: data.name, sku: data.sku || null, component_listing_ids: ids, component_quantities: quantities }).select("id,name,sku,enabled").single();
    if (error) throw new Error(error.message);
    return row;
  });
