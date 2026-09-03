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

  test("não descarta anúncio real quando o preço não veio no HTML", () => {
    const html = `
      <article class="poly-card">
        <a data-href="https://produto.mercadolivre.com.br/MLB-2234567890-iphone-15-_JM?tracking=abc" aria-label="iPhone 15 128GB"></a>
        <h2>iPhone 15 128GB</h2>
      </article>`;

    const [item] = extractPublicSiteSearchItems(html, "iphone", 20);
    expect(item?.id).toBe("MLB2234567890");
    expect(item?.title).toBe("iPhone 15 128GB");
    expect(item?.price_cents).toBeNull();
    expect(item?.permalink).toBe("https://produto.mercadolivre.com.br/MLB-2234567890-iphone-15-_JM");
  });

  test("extrai anúncio de JSON de hidratação quando o card não está renderizado no HTML", () => {
    const html = `
      <html><head></head><body>
        <script type="application/json">
          {
            "results": [
              {
                "permalink": "https:\\/\\/produto.mercadolivre.com.br\\/MLB-3234567890-iphone-14-_JM?position=1",
                "title": "iPhone 14 128GB",
                "price": 3499.9,
                "thumbnail": "https:\\/\\/http2.mlstatic.com\\/D_NQ_NP_test.webp",
                "seller": { "nickname": "LOJA JSON" }
              }
            ]
          }
        </script>
      </body></html>`;

    const [item] = extractPublicSiteSearchItems(html, "iphone", 20);
    expect(item?.id).toBe("MLB3234567890");
    expect(item?.title).toBe("iPhone 14 128GB");
    expect(item?.price_cents).toBe(349990);
    expect(item?.seller).toBe("LOJA JSON");
    expect(item?.thumbnail).toBe("https://http2.mlstatic.com/D_NQ_NP_test.webp");
    expect(item?.permalink).toBe("https://produto.mercadolivre.com.br/MLB-3234567890-iphone-14-_JM");
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

  test("não cria candidato quando JSON possui MLB só em parâmetro", () => {
    const html = `<script type="application/json">{"url":"https://lista.mercadolivre.com.br/iphone?item=MLB4234567890","title":"iPhone 13","price":2500}</script>`;
    expect(extractPublicSiteSearchItems(html, "iphone", 20)).toHaveLength(0);
  });
});
