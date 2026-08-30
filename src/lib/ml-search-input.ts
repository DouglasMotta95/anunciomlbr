export type MlSearchInputType =
  | "keyword"
  | "item_url"
  | "item_id"
  | "product_url"
  | "product_id"
  | "short_url"
  | "seller_url"
  | "seller_id"
  | "seller_nickname"
  | "search_url";

export type ParsedMlSearchInput = {
  raw: string;
  cleaned: string;
  type: MlSearchInputType;
  itemId: string | null;
  productId: string | null;
  sellerId: string | null;
  sellerNickname: string | null;
  searchQuery: string | null;
  normalizedUrl: string | null;
};

const ML_HOST_RE = /(^|\.)(mercadolivre\.com(\.br)?|mercadolibre\.com(\.br)?|mercadolibre\.com\.[a-z]{2}|meli\.la|mlstatic\.com)$/i;
const SEARCH_HOSTS = /^lista\.(mercadolivre\.com\.br|mercadolibre\.com(\.[a-z]{2})?)$/i;
const ITEM_ID_RE = /MLB[-_\s]?(\d{6,})/i;
const PRODUCT_PATH_RE = /\/p\/(MLB[-_\s]?\d{6,})/i;
const CUST_ID_RE = /_CustId_(\d{5,})/i;

const TRACKING_PARAM_RE =
  /^(utm_|matt_|tracking|trackingid|source|ref|reco_|pdp_filters|quantity|variation|wid|sid|searchVariation|position|type|c_id|c_uid|da_id|deal_print_id|forceInApp|from|is_advertising|ads|value_prop|hybrid|itm_|polycard_client|highlight)/i;

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

function looksLikeMlHost(value: string) {
  const host = value.split("/")[0]?.split("?")[0] ?? "";
  return ML_HOST_RE.test(host.replace(/^www\./i, "").toLowerCase()) || ML_HOST_RE.test(host.toLowerCase());
}

export function safeMlUrl(value: string): URL | null {
  const embedded = value.match(/https?:\/\/\S+/i)?.[0] ?? value.trim();
  const candidate = /^https?:\/\//i.test(embedded)
    ? embedded
    : looksLikeMlHost(embedded.replace(/^\/\//, ""))
      ? `https://${embedded.replace(/^\/\//, "")}`
      : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    url.hash = url.hash.startsWith("#D[A:") ? url.hash : "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_PARAM_RE.test(key)) url.searchParams.delete(key);
    }
    return url;
  } catch {
    return null;
  }
}

function slugToQuery(slug: string) {
  const cleaned = slug
    .replace(/^comprar-/i, "")
    .replace(/_(NoIndex|DisplayType|Desde|OrderId|PriceRange|ITEM|CustId|Deal|CATEGORY)_[^_]*/gi, "")
    .replace(/_[A-Z][A-Za-z]*_[^_]*/g, "");
  const normalized = normalizeSearchText(cleaned.replace(/[-_+]+/g, " "));
  return normalized || null;
}

function searchQueryFromUrl(url: URL) {
  const param =
    url.searchParams.get("as_word") ??
    url.searchParams.get("q") ??
    url.searchParams.get("query") ??
    url.searchParams.get("search");
  if (param && param.trim()) return normalizeSearchText(param) || null;

  const path = url.pathname.replace(/^\/+|\/+$/g, "");
  if (SEARCH_HOSTS.test(url.hostname)) return path ? slugToQuery(decodeURIComponent(path)) : null;
  if (/^(jm\/)?search/i.test(path)) {
    const rest = path.replace(/^(jm\/)?search\/?/i, "");
    return rest ? slugToQuery(decodeURIComponent(rest)) : null;
  }
  return null;
}

function sellerFromUrl(url: URL) {
  const sellerParam = url.searchParams.get("seller_id") ?? url.searchParams.get("sellerId") ?? url.searchParams.get("customId");
  if (sellerParam && /^\d{5,}$/.test(sellerParam)) return { sellerId: sellerParam, sellerNickname: null as string | null };

  const custId = `${url.pathname}${url.search}`.match(CUST_ID_RE)?.[1];
  if (custId) return { sellerId: custId, sellerNickname: null as string | null };

  const segments = url.pathname.split("/").map((part) => decodeURIComponent(part).trim()).filter(Boolean);
  const hostPrefix = url.hostname.toLowerCase().split(".")[0] ?? "";
  if (/^(perfil|profile|loja|tienda|store|eshops)$/i.test(hostPrefix) && segments[0]) {
    const value = segments[0].replace(/^@/, "");
    if (/^\d{5,}$/.test(value)) return { sellerId: value, sellerNickname: null as string | null };
    return { sellerId: null as string | null, sellerNickname: value };
  }

  const marker = segments.findIndex((part) => /^(perfil|profile|loja|tienda|store|seller|vendedor|pagina)$/i.test(part));
  if (marker >= 0 && segments[marker + 1]) {
    const value = segments[marker + 1]!.replace(/^@/, "");
    if (/^\d{5,}$/.test(value)) return { sellerId: value, sellerNickname: null as string | null };
    return { sellerId: null as string | null, sellerNickname: value };
  }
  return null;
}

function base(raw: string, cleaned: string): ParsedMlSearchInput {
  return { raw, cleaned, type: "keyword", itemId: null, productId: null, sellerId: null, sellerNickname: null, searchQuery: cleaned, normalizedUrl: null };
}

export function parseMlSearchInput(input: string): ParsedMlSearchInput {
  const raw = input;
  const cleaned = input.trim();
  const result = base(raw, cleaned);

  if (/^MLB[-_\s]?\d{6,}$/i.test(cleaned)) {
    return { ...result, type: "item_id", itemId: normalizeItemId(cleaned), searchQuery: null };
  }

  const url = safeMlUrl(cleaned);
  if (url && ML_HOST_RE.test(url.hostname)) {
    const normalizedUrl = url.toString();
    const withSearch = `${url.pathname}${url.search}`;

    const productId = normalizeItemId(withSearch.match(PRODUCT_PATH_RE)?.[1] ?? "");
    if (productId) return { ...result, type: "product_url", productId, searchQuery: null, normalizedUrl };

    // Seller listing URLs can also contain MLB item ids in filters; seller wins on _CustId_.
    if (CUST_ID_RE.test(withSearch)) {
      const seller = sellerFromUrl(url);
      return { ...result, type: "seller_url", sellerId: seller?.sellerId ?? null, searchQuery: null, normalizedUrl };
    }

    const itemId = normalizeItemId(withSearch);
    if (itemId) return { ...result, type: "item_url", itemId, searchQuery: null, normalizedUrl };

    const seller = sellerFromUrl(url);
    if (seller) return { ...result, type: "seller_url", sellerId: seller.sellerId, sellerNickname: seller.sellerNickname, searchQuery: null, normalizedUrl };

    const searchQuery = searchQueryFromUrl(url);
    if (searchQuery) return { ...result, type: "search_url", searchQuery, normalizedUrl };

    // Short links and any other ML URL: needs server-side redirect resolution.
    return { ...result, type: "short_url", searchQuery: null, normalizedUrl };
  }

  const prefixedSeller = cleaned.match(/^vendedor\s*:\s*(.+)$/i)?.[1]?.trim() ?? null;
  if (prefixedSeller) {
    if (/^\d{5,}$/.test(prefixedSeller)) return { ...result, type: "seller_id", sellerId: prefixedSeller, searchQuery: null };
    return { ...result, type: "seller_nickname", sellerNickname: prefixedSeller.replace(/^@/, ""), searchQuery: null };
  }
  if (/^@[^\s]+$/.test(cleaned)) return { ...result, type: "seller_nickname", sellerNickname: cleaned.slice(1), searchQuery: null };
  if (/^\d{5,}$/.test(cleaned)) return { ...result, type: "seller_id", sellerId: cleaned, searchQuery: null };
  return result;
}
