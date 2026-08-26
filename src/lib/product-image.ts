const IMAGE_KEYS = ["secure_url", "url", "thumbnail", "thumbnail_url", "picture_url"] as const;

function normalizeImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice(7)}`;
  return trimmed.startsWith("https://") ? trimmed : null;
}

/** Resolve imagens vindas do banco e das diferentes respostas oficiais do Mercado Livre. */
export function getProductImage(source: unknown): string | null {
  const direct = normalizeImage(source);
  if (direct) return direct;

  if (Array.isArray(source)) {
    for (const item of source) {
      const resolved = getProductImage(item);
      if (resolved) return resolved;
    }
    return null;
  }

  if (!source || typeof source !== "object") return null;
  const record = source as Record<string, unknown>;

  for (const key of IMAGE_KEYS) {
    const resolved = normalizeImage(record[key]);
    if (resolved) return resolved;
  }

  for (const key of ["images", "pictures", "variations"] as const) {
    const resolved = getProductImage(record[key]);
    if (resolved) return resolved;
  }

  return null;
}