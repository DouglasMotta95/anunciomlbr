/**
 * Helpers server-only da integração oficial Mercado Livre.
 * Nunca importar em componentes: lê secrets e usa o cliente admin.
 */

const ML_API = "https://api.mercadolibre.com";

export type MlTokenState =
  | { ok: true; accessToken: string; mlUserId: string | null }
  | { ok: false; reason: string };

/**
 * Devolve um access_token válido para o usuário, renovando via refresh_token
 * quando estiver expirado (ou a menos de 5 min de expirar).
 */
export async function getValidMlAccessToken(userId: string): Promise<MlTokenState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row } = await supabaseAdmin
    .from("ml_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row?.access_token) return { ok: false, reason: "missing_token" };

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const stillValid = expiresAt - Date.now() > 5 * 60 * 1000;
  if (stillValid) return { ok: true, accessToken: row.access_token, mlUserId: null };

  const clientId = process.env["ML_CLIENT_ID"];
  const clientSecret = process.env["ML_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return { ok: false, reason: "not_configured" };
  if (!row.refresh_token) return { ok: false, reason: "missing_refresh_token" };

  const response = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
    }),
  });

  if (!response.ok) {
    console.error("ML refresh failed with status", response.status);
    await supabaseAdmin
      .from("ml_connections")
      .update({ connected: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { ok: false, reason: `refresh_failed_${response.status}` };
  }

  const token = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: number | string;
  };

  await supabaseAdmin.from("ml_tokens").upsert(
    {
      user_id: userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? row.refresh_token,
      expires_at: new Date(Date.now() + (token.expires_in ?? 21600) * 1000).toISOString(),
    },
    { onConflict: "user_id" },
  );

  return {
    ok: true,
    accessToken: token.access_token,
    mlUserId: token.user_id != null ? String(token.user_id) : null,
  };
}

export type MlSyncResult =
  | { ok: true; imported: number; updated: number; total: number }
  | { ok: false; reason: string };

/** Mensagens legíveis para os motivos técnicos de falha. */
export function describeMlSyncReason(reason: string): string {
  if (reason === "missing_token" || reason === "missing_refresh_token")
    return "Sua autorização do Mercado Livre expirou. Clique em “Conectar Mercado Livre” para reconectar.";
  if (reason.startsWith("refresh_failed"))
    return "O Mercado Livre recusou a renovação do acesso. Reconecte sua conta.";
  if (reason === "not_configured") return "Integração indisponível no momento. Fale com o suporte.";
  if (reason === "missing_ml_user_id")
    return "Não identificamos sua conta de vendedor. Reconecte o Mercado Livre.";
  if (reason.startsWith("items_search_401") || reason.startsWith("items_fetch_401"))
    return "Acesso expirado no Mercado Livre. Reconecte sua conta.";
  if (reason.startsWith("items_search_403") || reason.startsWith("items_fetch_403"))
    return "Sua conta autorizou o app sem permissão de leitura de anúncios. Reconecte concedendo todas as permissões.";
  if (reason.startsWith("items_search_") || reason.startsWith("items_fetch_"))
    return `A API do Mercado Livre respondeu ${reason.split("_").pop()}. Tente novamente em alguns minutos.`;
  if (reason === "no_items")
    return "Nenhum anúncio foi encontrado nesta conta do Mercado Livre.";
  return "Não foi possível sincronizar agora. Tente novamente.";
}

type MlSearchPage = {
  results?: string[];
  paging?: { total?: number };
  scroll_id?: string;
};

/**
 * Lista TODOS os IDs de anúncios do vendedor.
 * Usa paginação por offset até 1000 itens e `search_type=scan` (scroll)
 * acima disso — limite oficial da API do Mercado Livre.
 */
async function fetchAllItemIds(
  mlUserId: string,
  auth: Record<string, string>,
  hardCap: number,
): Promise<{ ok: true; ids: string[] } | { ok: false; reason: string }> {
  const ids: string[] = [];
  const seen = new Set<string>();
  const pageSize = 100;

  const push = (results: string[]) => {
    for (const id of results) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  };

  // Fase 1: offset até o limite oficial de 1000.
  for (let offset = 0; offset < Math.min(hardCap, 1000); offset += pageSize) {
    const response = await fetch(
      `${ML_API}/users/${mlUserId}/items/search?limit=${pageSize}&offset=${offset}`,
      { headers: auth },
    );
    if (!response.ok) {
      if (ids.length > 0) break;
      return { ok: false, reason: `items_search_${response.status}` };
    }
    const page = (await response.json()) as MlSearchPage;
    const results = page.results ?? [];
    push(results);
    const total = page.paging?.total ?? ids.length;
    if (results.length < pageSize || ids.length >= total || ids.length >= hardCap) {
      return { ok: true, ids: ids.slice(0, hardCap) };
    }
  }

  // Fase 2: scroll (scan) para contas com mais de 1000 anúncios.
  let scrollId: string | null = null;
  while (ids.length < hardCap) {
    const url = new URL(`${ML_API}/users/${mlUserId}/items/search`);
    url.searchParams.set("search_type", "scan");
    url.searchParams.set("limit", String(pageSize));
    if (scrollId) url.searchParams.set("scroll_id", scrollId);

    const response = await fetch(url.toString(), { headers: auth });
    if (!response.ok) break;
    const page = (await response.json()) as MlSearchPage;
    const results = page.results ?? [];
    const before = ids.length;
    push(results);
    scrollId = page.scroll_id ?? null;
    if (!scrollId || results.length === 0 || ids.length === before) break;
  }

  return { ok: true, ids: ids.slice(0, hardCap) };
}

/**
 * Sincroniza os anúncios do vendedor para `listings`.
 * Importa a conta inteira (até `limit`) e atualiza o que já existe.
 */
export async function syncUserListings(userId: string, limit = 1000): Promise<MlSyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tokenState = await getValidMlAccessToken(userId);
  if (!tokenState.ok) return { ok: false, reason: tokenState.reason };

  const { data: connection } = await supabaseAdmin
    .from("ml_connections")
    .select("ml_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const auth = { Authorization: `Bearer ${tokenState.accessToken}`, Accept: "application/json" };

  // Identifica a conta pelo próprio token quando a conexão não tem o ID salvo.
  let mlUserId = connection?.ml_user_id ?? tokenState.mlUserId;
  if (!mlUserId) {
    const me = await fetch(`${ML_API}/users/me`, { headers: auth });
    if (me.ok) {
      const profile = (await me.json()) as { id?: number | string; nickname?: string };
      mlUserId = profile.id != null ? String(profile.id) : null;
      if (mlUserId) {
        await supabaseAdmin.from("ml_connections").upsert(
          {
            user_id: userId,
            connected: true,
            ml_user_id: mlUserId,
            nickname: profile.nickname ?? null,
          },
          { onConflict: "user_id" },
        );
      }
    }
  }
  if (!mlUserId) return { ok: false, reason: "missing_ml_user_id" };

  const found = await fetchAllItemIds(mlUserId, auth, Math.max(limit, 1));
  if (!found.ok) return { ok: false, reason: found.reason };
  const ids = found.ids;

  if (ids.length === 0) {
    await supabaseAdmin
      .from("ml_connections")
      .update({ listings_count: 0, last_sync_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { ok: false, reason: "no_items" };
  }

  let imported = 0;
  let updated = 0;
  let lastError: string | null = null;

  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const itemsResponse = await fetch(
      `${ML_API}/items?ids=${chunk.join(",")}&attributes=id,title,price,available_quantity,sold_quantity,permalink,category_id,condition,pictures,thumbnail,status,sub_status`,
      { headers: auth },
    );
    if (!itemsResponse.ok) {
      if (i === 0) return { ok: false, reason: `items_fetch_${itemsResponse.status}` };
      lastError = `items_fetch_${itemsResponse.status}`;
      break;
    }

    const batch = (await itemsResponse.json()) as Array<{
      code?: number;
      body?: Record<string, unknown>;
    }>;

    // Descobre em UMA consulta quais anúncios do lote já existem.
    const chunkIds = batch
      .map((entry) => (entry.code === 200 ? String(entry.body?.["id"] ?? "") : ""))
      .filter(Boolean);
    const { data: existingRows } = await supabaseAdmin
      .from("listings")
      .select("id, source_ml_id")
      .eq("user_id", userId)
      .in("source_ml_id", chunkIds.length > 0 ? chunkIds : ["__none__"]);
    const existingByMlId = new Map(
      (existingRows ?? [])
        .filter((row) => !!row.source_ml_id)
        .map((row) => [row.source_ml_id as string, row.id]),
    );

    const toInsert: Record<string, unknown>[] = [];

    for (const entry of batch) {
      const item = entry.body;
      if (entry.code !== 200 || !item) continue;

      const mlId = String(item["id"] ?? "");
      if (!mlId) continue;

      const price = typeof item["price"] === "number" ? (item["price"] as number) : null;
      const pictures = Array.isArray(item["pictures"])
        ? (item["pictures"] as Array<{ secure_url?: string; url?: string }>)
            .map((p) => p.secure_url ?? p.url)
            .filter((u): u is string => !!u)
        : [];
      const thumbnail = typeof item["thumbnail"] === "string" ? (item["thumbnail"] as string) : null;
      const images = pictures.length > 0 ? pictures : thumbnail ? [thumbnail] : [];
      const mlStatus = String(item["status"] ?? "");

      const values = {
        user_id: userId,
        title: String(item["title"] ?? "Anúncio sem título"),
        price_cents: price === null ? null : Math.round(price * 100),
        stock:
          typeof item["available_quantity"] === "number" ? (item["available_quantity"] as number) : 0,
        category: (item["category_id"] as string) ?? null,
        condition: (item["condition"] as string) ?? null,
        source_ml_id: mlId,
        source_permalink: (item["permalink"] as string) ?? null,
        published_ml_id: mlId,
        status: (mlStatus === "paused" ? "paused" : mlStatus === "active" ? "active" : "draft") as never,
        images: images as never,
        updated_at: new Date().toISOString(),
      };

      const existingId = existingByMlId.get(mlId);
      if (existingId) {
        const { error } = await supabaseAdmin
          .from("listings")
          .update(values as never)
          .eq("id", existingId);
        if (error) lastError = error.message;
        else updated += 1;
      } else {
        toInsert.push(values);
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from("listings").insert(toInsert as never);
      if (error) {
        lastError = error.message;
        console.error("ML sync insert failed", error.message);
      } else {
        imported += toInsert.length;
      }
    }
  }

  const { count } = await supabaseAdmin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("source_ml_id", "is", null);

  await supabaseAdmin
    .from("ml_connections")
    .update({
      connected: true,
      listings_count: count ?? ids.length,
      last_sync_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  await supabaseAdmin.from("activity_events").insert({
    user_id: userId,
    kind: "ml_sync",
    message: `Sincronização: ${imported} novos e ${updated} atualizados`,
    meta: { imported, updated, total: ids.length, error: lastError },
  });

  if (imported === 0 && updated === 0 && lastError) {
    return { ok: false, reason: lastError };
  }


  return { ok: true, imported, updated, total: ids.length };
}

let appToken: { value: string; expiresAt: number } | null = null;

/** Token de aplicação (client_credentials) para leituras públicas de busca. */
export async function getAppAccessToken(): Promise<string | null> {
  if (appToken && appToken.expiresAt - Date.now() > 60_000) return appToken.value;

  const clientId = process.env["ML_CLIENT_ID"];
  const clientSecret = process.env["ML_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;

  const response = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) {
    console.error("ML app token failed with status", response.status);
    return null;
  }
  const token = (await response.json()) as { access_token: string; expires_in?: number };
  appToken = {
    value: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 21600) * 1000,
  };
  return appToken.value;
}

export type MlPublishResult =
  | { ok: true; mlItemId: string; permalink: string | null }
  | { ok: false; reason: string };

/**
 * Publica um rascunho na conta do cliente via API oficial (POST /items).
 * Não simula: qualquer erro do Mercado Livre é devolvido como está.
 */
export async function publishListingToMl(userId: string, listingId: string): Promise<MlPublishResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!listing) return { ok: false, reason: "Anúncio não encontrado." };
  if (!listing.category) return { ok: false, reason: "Informe a categoria do Mercado Livre antes de publicar." };
  if (!listing.price_cents || listing.price_cents <= 0) return { ok: false, reason: "Informe o preço antes de publicar." };

  const token = await getValidMlAccessToken(userId);
  if (!token.ok) return { ok: false, reason: "Conecte sua conta do Mercado Livre para publicar." };

  const pictures = Array.isArray(listing.images)
    ? (listing.images as unknown[])
        .map((img) => (typeof img === "string" ? img : (img as { url?: string; secure_url?: string })?.secure_url ?? (img as { url?: string })?.url))
        .filter((url): url is string => typeof url === "string" && url.startsWith("http"))
        .slice(0, 10)
        .map((url) => ({ source: url }))
    : [];

  const attributes = Array.isArray(listing.attributes)
    ? (listing.attributes as { id?: string; value_name?: string }[]).filter((a) => a?.id && a?.value_name)
    : [];

  const body = {
    title: listing.title.slice(0, 60),
    category_id: listing.category,
    price: Number((listing.price_cents / 100).toFixed(2)),
    currency_id: "BRL",
    available_quantity: Math.max(listing.stock ?? 1, 1),
    buying_mode: "buy_it_now",
    condition: listing.condition ?? "new",
    listing_type_id: "gold_special",
    pictures,
    attributes,
  };

  const response = await fetch(`${ML_API}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | { id?: string; permalink?: string; message?: string; cause?: { message?: string }[] }
    | null;

  if (!response.ok || !payload?.id) {
    const detail = payload?.cause?.map((c) => c.message).filter(Boolean).join(" | ") || payload?.message;
    return { ok: false, reason: detail ? `Mercado Livre: ${detail}` : "O Mercado Livre recusou a publicação." };
  }

  if (listing.description) {
    await fetch(`${ML_API}/items/${payload.id}/description`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ plain_text: listing.description }),
    }).catch(() => null);
  }

  return { ok: true, mlItemId: payload.id, permalink: payload.permalink ?? null };
}
