import { getValidMlAccessToken, publishListingToMl } from "@/lib/ml.server";

export type MlRequestedPublishStatus = "active" | "paused";
export type MlFinalPublishStatus = "active" | "paused";

export type MlPublishWithStatusResult =
  | {
      ok: true;
      mlItemId: string;
      permalink: string | null;
      status: MlFinalPublishStatus;
      warning?: string;
    }
  | { ok: false; reason: string };

/**
 * Cria o anúncio uma única vez. Para o modo pausado, a API oficial do Mercado Livre
 * exige a mudança de status por PUT /items/{id} após a criação. Se essa segunda
 * etapa falhar, nunca repetimos o POST /items: devolvemos o item já criado como
 * ativo com um aviso explícito, evitando duplicação acidental.
 */
export async function publishListingToMlWithStatus(
  userId: string,
  listingId: string,
  requestedStatus: MlRequestedPublishStatus,
): Promise<MlPublishWithStatusResult> {
  const created = await publishListingToMl(userId, listingId);
  if (!created.ok) return created;

  if (requestedStatus === "active") {
    return { ...created, status: "active" };
  }

  const token = await getValidMlAccessToken(userId);
  if (!token.ok) {
    return {
      ...created,
      status: "active",
      warning:
        "O anúncio foi criado no Mercado Livre, mas não foi possível autenticar a etapa de pausa. Ele permanece ativo; pause-o manualmente antes de revisar.",
    };
  }

  try {
    const response = await fetch(`https://api.mercadolibre.com/items/${encodeURIComponent(created.mlItemId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status: "paused" }),
      signal: AbortSignal.timeout(15_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | { status?: string; message?: string; cause?: Array<{ message?: string }> }
      | null;

    if (response.ok && payload?.status === "paused") {
      return { ...created, status: "paused" };
    }

    const detail = payload?.cause?.map((cause) => cause.message).filter(Boolean).join(" | ") || payload?.message;
    return {
      ...created,
      status: "active",
      warning: detail
        ? `O anúncio foi criado, mas o Mercado Livre não aceitou a pausa automática: ${detail}. Ele permanece ativo.`
        : "O anúncio foi criado, mas o Mercado Livre não confirmou a pausa automática. Ele permanece ativo.",
    };
  } catch {
    return {
      ...created,
      status: "active",
      warning:
        "O anúncio foi criado, mas a comunicação foi interrompida ao solicitar a pausa. Para evitar duplicação, nenhuma nova publicação foi feita; confira o anúncio e pause-o manualmente se necessário.",
    };
  }
}
