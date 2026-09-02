import { describe, expect, test } from "bun:test";
import { extractPublicSiteSearchItems } from "../src/lib/ml-public-site-fallback.server";

describe("fallback da busca pública Mercado Livre", () => {
  test("extrai anúncio real com preço, vendedor e oferta de catálogo", () => {
    const html = `
      <li class="ui-search-layout__item poly-card catalog_offer">
        <a href="https://produto.mercadolivre.com.br/MLB-1234567890-iphone-16-pro-_JM?tracking=abc" title="iPhone 16 Pro 256GB">
          <h2 class="poly-component__title">iPhone 16 Pro 256GB</h2>
        </a>
        <span class="andes-money-amount__fraction">7.999</span><span class="andes-money-amount__cents">90</span>
        <span class="poly-component__seller">Vendido por LOJA TESTE</span>
        <img src="https://http2.mlstatic.com/test.jpg" />
      </li>`;

    const [item] = extractPublicSiteSearchItems(html, "iphone 16", 20);
    expect(item?.id).toBe("MLB1234567890");
    expect(item?.title).toBe("iPhone 16 Pro 256GB");
    expect(item?.price_cents).toBe(799990);
    expect(item?.seller).toBe("LOJA TESTE");
    expect(item?.source_kind).toBe("catalog_offer");
    expect(item?.permalink).toBe("https://produto.mercadolivre.com.br/MLB-1234567890-iphone-16-pro-_JM");
    expect(item?.verified_item).toBe(false);
  });

  test("não cria candidato quando MLB existe só em query string", () => {
    const html = `
      <li class="ui-search-layout__item">
        <a href="https://lista.mercadolivre.com.br/iphone?item=MLB1234567890" title="iPhone 16">
          <h2 class="poly-component__title">iPhone 16</h2>
        </a>
        <span class="andes-money-amount__fraction">5.000</span>
      </li>`;
    expect(extractPublicSiteSearchItems(html, "iphone", 20)).toHaveLength(0);
  });
});
