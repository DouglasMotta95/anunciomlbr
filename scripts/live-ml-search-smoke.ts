import { itemIdFromRealMlUrl } from "../src/lib/ml-discovery.server";
import { searchMercadoLivrePublicSiteFallback } from "../src/lib/ml-public-site-fallback.server";

const query = process.argv[2]?.trim() || "iPhone";
const limit = 12;
const result = await searchMercadoLivrePublicSiteFallback(query, limit);

const items = result.items.filter((item) => {
  const id = item.permalink ? itemIdFromRealMlUrl(item.permalink) : null;
  return !!item.permalink && id === item.id;
});
const complete = items.filter((item) => item.price_cents != null && item.price_cents > 0 && !!item.thumbnail);

console.log(JSON.stringify({
  query,
  status: result.status,
  pageKind: result.pageKind,
  total: result.items.length,
  confirmed_links: items.length,
  complete_items: complete.length,
  sample: complete.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    price_cents: item.price_cents,
    image: item.thumbnail,
    permalink: item.permalink,
  })),
}, null, 2));

if (!items.length) {
  throw new Error(`Smoke real falhou: nenhum item com permalink MLB real retornou para ${query}.`);
}
if (!complete.length) {
  throw new Error(`Smoke real falhou: itens vieram, mas nenhum tinha link + preço + imagem + MLB para ${query}.`);
}
