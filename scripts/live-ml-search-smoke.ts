import { itemIdFromRealMlUrl } from "../src/lib/ml-discovery.server";
import { firecrawlConfigured, firecrawlSearchMercadoLivre } from "../src/lib/ml-firecrawl.server";
import { searchMercadoLivrePublicSiteFallback } from "../src/lib/ml-public-site-fallback.server";

const query = process.argv[2]?.trim() || "iPhone";
const limit = 12;

const publicResult = await searchMercadoLivrePublicSiteFallback(query, limit);
const publicItems = publicResult.items
  .filter((item) => !!item.permalink && itemIdFromRealMlUrl(item.permalink) === item.id)
  .map((item) => ({ ...item, source: "public_site" as const }));

let firecrawlCalled = false;
let firecrawlStatuses: number[] = [];
let firecrawlError: string | null = null;
let firecrawlItems: Array<{
  id: string;
  title: string;
  permalink: string;
  price_cents: number | null;
  thumbnail: string | null;
  source: "firecrawl";
}> = [];

if ((!publicItems.length || !publicItems.some((item) => item.price_cents != null && !!item.thumbnail)) && firecrawlConfigured()) {
  firecrawlCalled = true;
  const firecrawl = await firecrawlSearchMercadoLivre(query, limit);
  firecrawlStatuses = firecrawl.statuses;
  firecrawlError = firecrawl.error;
  firecrawlItems = firecrawl.ads
    .filter((item) => itemIdFromRealMlUrl(item.permalink) === item.id)
    .map((item) => ({ ...item, source: "firecrawl" as const }));
}

const byId = new Map<string, (typeof publicItems)[number] | (typeof firecrawlItems)[number]>();
for (const item of [...publicItems, ...firecrawlItems]) {
  const current = byId.get(item.id);
  if (!current) {
    byId.set(item.id, item);
    continue;
  }
  byId.set(item.id, {
    ...current,
    price_cents: current.price_cents ?? item.price_cents,
    thumbnail: current.thumbnail ?? item.thumbnail,
  });
}

const items = Array.from(byId.values());
const complete = items.filter((item) => item.price_cents != null && item.price_cents > 0 && !!item.thumbnail);

console.log(JSON.stringify({
  query,
  public_site: {
    status: publicResult.status,
    pageKind: publicResult.pageKind,
    total: publicResult.items.length,
    confirmed_links: publicItems.length,
  },
  firecrawl: {
    configured: firecrawlConfigured(),
    called: firecrawlCalled,
    statuses: firecrawlStatuses,
    error: firecrawlError,
    confirmed_links: firecrawlItems.length,
  },
  final: {
    total: items.length,
    complete_items: complete.length,
    sources: items.reduce<Record<string, number>>((acc, item) => {
      acc[item.source] = (acc[item.source] ?? 0) + 1;
      return acc;
    }, {}),
  },
  sample: complete.slice(0, 5).map((item) => ({
    source: item.source,
    id: item.id,
    title: item.title,
    price_cents: item.price_cents,
    image: item.thumbnail,
    permalink: item.permalink,
  })),
}, null, 2));

if (!items.length) {
  throw new Error(`Smoke real falhou: nenhum item com permalink MLB real retornou para ${query}. Public page kind=${publicResult.pageKind}; Firecrawl configured=${firecrawlConfigured()}.`);
}
if (!complete.length) {
  throw new Error(`Smoke real falhou: itens vieram, mas nenhum tinha link + preço + imagem + MLB para ${query}.`);
}
