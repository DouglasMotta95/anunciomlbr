const ML_API = "https://api.mercadolibre.com";

type SyncResult =
  | { ok: true; imported: number; updated: number; total: number }
  | { ok: false; reason: string };

type SearchPage = { results?: string[]; paging?: { total?: number }; scroll_id?: string };

async function fetchAllIds(mlUserId: string, headers: Record<string, string>, hardCap = 1000) {
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (values: string[]) => {
    for (const id of values) if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
  };

  for (let offset = 0; offset < Math.min(hardCap, 1000); offset += 100) {
    const response = await fetch(`${ML_API}/users/${encodeURIComponent(mlUserId)}/items/search?limit=100&offset=${offset}`, { headers });
    if (!response.ok) return ids.length ? { ok: true as const, ids } : { ok: false as const, reason: `items_search_${response.status}` };
    const page = await response.json() as SearchPage;
    const results = page.results ?? [];
    push(results);
    const total = page.paging?.total ?? ids.length;
    if (results.length < 100 || ids.length >= total || ids.length >= hardCap) return { ok: true as const, ids: ids.slice(0, hardCap) };
  }
  return { ok: true as const, ids: ids.slice(0, hardCap) };
}

export async function syncUserListingsFast(userId: string, limit = 1000): Promise<SyncResult> {
  const [{ supabaseAdmin }, { getValidMlAccessToken }] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("@/lib/ml.server"),
  ]);

  const token = await getValidMlAccessToken(userId);
  if (!token.ok) return { ok: false, reason: token.reason };
  const headers = { Authorization: `Bearer ${token.accessToken}`, Accept: "application/json" };

  const { data: stored } = await supabaseAdmin.from("ml_connections").select("ml_user_id,nickname").eq("user_id", userId).maybeSingle();
  let mlUserId = stored?.ml_user_id ?? token.mlUserId;
  let nickname = stored?.nickname ?? null;

  if (!mlUserId) {
    const me = await fetch(`${ML_API}/users/me`, { headers });
    if (!me.ok) return { ok: false, reason: `identity_${me.status}` };
    const profile = await me.json() as { id?: string | number; nickname?: string };
    mlUserId = profile.id != null ? String(profile.id) : null;
    nickname = profile.nickname ?? nickname;
  }
  if (!mlUserId) return { ok: false, reason: "missing_ml_user_id" };

  await supabaseAdmin.from("ml_connections").upsert({ user_id: userId, ml_user_id: mlUserId, nickname, connected: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  const found = await fetchAllIds(mlUserId, headers, Math.max(1, limit));
  if (!found.ok) return { ok: false, reason: found.reason };
  if (!found.ids.length) {
    await supabaseAdmin.from("ml_connections").update({ listings_count: 0, last_sync_at: new Date().toISOString() }).eq("user_id", userId);
    return { ok: false, reason: "no_items" };
  }

  let imported = 0;
  let updated = 0;
  for (let i = 0; i < found.ids.length; i += 20) {
    const chunk = found.ids.slice(i, i + 20);
    const response = await fetch(`${ML_API}/items?ids=${chunk.join(",")}&attributes=id,title,price,available_quantity,permalink,category_id,condition,pictures,thumbnail,status`, { headers });
    if (!response.ok) return { ok: false, reason: `items_fetch_${response.status}` };
    const batch = await response.json() as Array<{ code?: number; body?: Record<string, unknown> }>;
    const valid = batch.filter(entry => entry.code === 200 && entry.body?.["id"]);
    const sourceIds = valid.map(entry => String(entry.body!["id"]));

    const { data: existing } = await supabaseAdmin.from("listings").select("id,source_ml_id").eq("user_id", userId).in("source_ml_id", sourceIds.length ? sourceIds : ["__none__"]);
    const idsBySource = new Map((existing ?? []).map(row => [String(row.source_ml_id), String(row.id)]));

    const rows = valid.map(entry => {
      const item = entry.body!;
      const sourceId = String(item["id"]);
      const pictures = Array.isArray(item["pictures"])
        ? (item["pictures"] as Array<{ secure_url?: string; url?: string }>).map(p => p.secure_url ?? p.url).filter((v): v is string => !!v)
        : [];
      const thumbnail = typeof item["thumbnail"] === "string" ? item["thumbnail"] : null;
      const status = String(item["status"] ?? "");
      const existingId = idsBySource.get(sourceId);
      return {
        id: existingId ?? crypto.randomUUID(),
        user_id: userId,
        source_ml_id: sourceId,
        source_permalink: typeof item["permalink"] === "string" ? item["permalink"] : null,
        published_ml_id: sourceId,
        title: String(item["title"] ?? "Anúncio sem título"),
        price_cents: typeof item["price"] === "number" ? Math.round((item["price"] as number) * 100) : null,
        stock: typeof item["available_quantity"] === "number" ? item["available_quantity"] : 0,
        category: typeof item["category_id"] === "string" ? item["category_id"] : null,
        condition: typeof item["condition"] === "string" ? item["condition"] : null,
        images: pictures.length ? pictures : thumbnail ? [thumbnail] : [],
        status: status === "active" ? "active" : status === "paused" ? "paused" : "draft",
        updated_at: new Date().toISOString(),
      };
    });

    if (!rows.length) continue;
    const { error } = await supabaseAdmin.from("listings").upsert(rows as never, { onConflict: "id" });
    if (error) {
      console.error("fast ML sync batch failed", error.message);
      return { ok: false, reason: error.message };
    }
    for (const row of rows) {
      if (idsBySource.has(row.source_ml_id)) updated += 1;
      else imported += 1;
    }
  }

  const now = new Date().toISOString();
  await supabaseAdmin.from("ml_connections").update({ connected: true, listings_count: found.ids.length, last_sync_at: now, updated_at: now }).eq("user_id", userId);
  await supabaseAdmin.from("activity_events").insert({ user_id: userId, kind: "ml_sync", message: `Sincronização: ${imported} novos e ${updated} atualizados`, meta: { imported, updated, total: found.ids.length, mode: "batch" } });
  return { ok: true, imported, updated, total: found.ids.length };
}
