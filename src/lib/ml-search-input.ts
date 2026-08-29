export type MlSearchInputType =
  | "keyword"
  | "item_url"
  | "item_id"
  | "seller_url"
  | "seller_id"
  | "seller_nickname"
  | "search_url";

export type ParsedMlSearchInput = {
  raw: string;
  cleaned: string;
  type: MlSearchInputType;
  itemId: string | null;
  sellerId: string | null;
  sellerNickname: string | null;
  searchQuery: string | null;
  normalizedUrl: string | null;
};

const ML_HOST_RE = /(^|\.)(mercadolivre\.com\.br|mercadolibre\.com|meli\.la)$/i;
const SEARCH_HOST = "lista.mercadolivre.com.br";
const ITEM_ID_RE = /MLB[-_\s]?(\d{6,})/i;

export function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeSearchTerm(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeItemId(value: string) {
  const match = value.match(ITEM_ID_RE);
  return match ? `MLB${match[1]}` : null;
}

function safeUrl(value: string) {
  const candidate = /^https?:\/\//i.test(value) ? value : /^www\./i.test(value) ? `https://${value}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|matt_|tracking|source|ref|quantity|variation|wid|sid|searchVariation)/i.test(key)) url.searchParams.delete(key);
    }
    return url;
  } catch {
    return null;
  }
}

function searchQueryFromUrl(url: URL) {
  if (url.hostname.toLowerCase() !== SEARCH_HOST) return null;
  let slug = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ""));
  if (!slug) return null;
  slug = slug.replace(/^comprar-/i, "").replace(/_NoIndex_True.*$/i, "").replace(/_DisplayType_.*$/i, "");
  const normalized = normalizeSearchText(slug.replace(/[-_]+/g, " "));
  return normalized || null;
}

function sellerFromUrl(url: URL) {
  const sellerId = url.searchParams.get("seller_id") ?? url.searchParams.get("sellerId");
  if (sellerId && /^\d{5,}$/.test(sellerId)) return { sellerId, sellerNickname: null as string | null };

  const segments = url.pathname.split("/").map((part) => decodeURIComponent(part).trim()).filter(Boolean);
  const hostPrefix = url.hostname.toLowerCase().split(".")[0];
  if (/^(perfil|profile|loja|store|eshops)$/i.test(hostPrefix ?? "") && segments[0]) {
    const value = segments[0].replace(/^@/, "");
    if (/^\d{5,}$/.test(value)) return { sellerId: value, sellerNickname: null as string | null };
    return { sellerId: null as string | null, sellerNickname: value };
  }

  const sellerMarker = segments.findIndex((part) => /^(perfil|profile|loja|store|seller|vendedor)$/i.test(part));
  if (sellerMarker >= 0 && segments[sellerMarker + 1]) {
    const value = segments[sellerMarker + 1]!.replace(/^@/, "");
    if (/^\d{5,}$/.test(value)) return { sellerId: value, sellerNickname: null as string | null };
    return { sellerId: null as string | null, sellerNickname: value };
  }
  return null;
}

export function parseMlSearchInput(input: string): ParsedMlSearchInput {
  const raw = input;
  const cleaned = input.trim();
  const directItemId = normalizeItemId(cleaned);
  if (directItemId && /^MLB[-_\s]?\d{6,}$/i.test(cleaned)) return { raw, cleaned, type: "item_id", itemId: directItemId, sellerId: null, sellerNickname: null, searchQuery: null, normalizedUrl: null };

  const url = safeUrl(cleaned);
  if (url && ML_HOST_RE.test(url.hostname)) {
    const itemId = normalizeItemId(`${url.pathname}${url.search}`);
    if (itemId) return { raw, cleaned, type: "item_url", itemId, sellerId: null, sellerNickname: null, searchQuery: null, normalizedUrl: url.toString() };
    if (url.hostname.toLowerCase() === "meli.la") return { raw, cleaned, type: "item_url", itemId: null, sellerId: null, sellerNickname: null, searchQuery: null, normalizedUrl: url.toString() };
    const searchQuery = searchQueryFromUrl(url);
    if (searchQuery) return { raw, cleaned, type: "search_url", itemId: null, sellerId: null, sellerNickname: null, searchQuery, normalizedUrl: url.toString() };
    const seller = sellerFromUrl(url);
    if (seller) return { raw, cleaned, type: "seller_url", itemId: null, sellerId: seller.sellerId, sellerNickname: seller.sellerNickname, searchQuery: null, normalizedUrl: url.toString() };
  }

  const prefixedSeller = cleaned.match(/^vendedor\s*:\s*(.+)$/i)?.[1]?.trim() ?? null;
  if (prefixedSeller) {
    if (/^\d{5,}$/.test(prefixedSeller)) return { raw, cleaned, type: "seller_id", itemId: null, sellerId: prefixedSeller, sellerNickname: null, searchQuery: null, normalizedUrl: null };
    return { raw, cleaned, type: "seller_nickname", itemId: null, sellerId: null, sellerNickname: prefixedSeller.replace(/^@/, ""), searchQuery: null, normalizedUrl: null };
  }
  if (/^@[^\s]+$/.test(cleaned)) return { raw, cleaned, type: "seller_nickname", itemId: null, sellerId: null, sellerNickname: cleaned.slice(1), searchQuery: null, normalizedUrl: null };
  if (/^\d{5,}$/.test(cleaned)) return { raw, cleaned, type: "seller_id", itemId: null, sellerId: cleaned, sellerNickname: null, searchQuery: null, normalizedUrl: null };
  return { raw, cleaned, type: "keyword", itemId: null, sellerId: null, sellerNickname: null, searchQuery: cleaned, normalizedUrl: null };
}
