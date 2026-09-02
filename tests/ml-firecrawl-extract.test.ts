import { describe, expect, test } from "bun:test";

import { extractAdsFromHtml, extractAdsFromMarkdown } from "../src/lib/ml-firecrawl.server";

describe("extractAdsFromHtml", () => {
  test("extrai título, link, ID MLB, preço e imagem de um card real", () => {
    const html = `
      <ol>
        <li class="ui-search-layout__item">
          <div class="poly-card">
            <img data-src="https://http2.mlstatic.com/D_NQ_NP_123-O.webp" alt="foto"/>
            <a class="poly-component__title" href="https://produto.mercadolivre.com.br/MLB-1234567890-iphone-15-128gb-_JM?ref=abc">iPhone 15 128GB Preto</a>
            <span class="andes-money-amount__fraction">4.799</span><span class="andes-money-amount__cents">90</span>
          </div>
        </li>
        <li><a href="https://www.mercadolivre.com.br/ajuda">Ajuda</a></li>
      </ol>`;
    const ads = extractAdsFromHtml(html);
    expect(ads).toHaveLength(1);
    expect(ads[0]!.id).toBe("MLB1234567890");
    expect(ads[0]!.title).toBe("iPhone 15 128GB Preto");
    expect(ads[0]!.permalink).toBe("https://produto.mercadolivre.com.br/MLB-1234567890-iphone-15-128gb-_JM");
    expect(ads[0]!.price_cents).toBe(479990);
    expect(ads[0]!.thumbnail).toBe("https://http2.mlstatic.com/D_NQ_NP_123-O.webp");
  });

  test("ignora links sem ID MLB", () => {
    expect(extractAdsFromHtml(`<li><a href="https://www.mercadolivre.com.br/ofertas">Ofertas</a></li>`)).toHaveLength(0);
  });
});

describe("extractAdsFromMarkdown", () => {
  test("usa o preço próximo do link para compor o anúncio", () => {
    const markdown = [
      "[iPhone 14 Plus 256GB](https://produto.mercadolivre.com.br/MLB-9876543210-iphone-14-plus-_JM)",
      "R$ 3.999,00",
      "![foto](https://http2.mlstatic.com/D_NQ_NP_999-O.webp)",
    ].join("\n");
    const ads = extractAdsFromMarkdown(markdown);
    expect(ads).toHaveLength(1);
    expect(ads[0]!.id).toBe("MLB9876543210");
    expect(ads[0]!.price_cents).toBe(399900);
  });
});
