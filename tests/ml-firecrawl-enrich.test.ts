import { describe, expect, test } from "bun:test";

import { extractProductPageEnrichment } from "../src/lib/ml-firecrawl-enrich.server";

describe("enriquecimento Firecrawl do anúncio real", () => {
  test("completa preço e imagem a partir da página do próprio permalink", () => {
    const candidate = {
      id: "MLB1234567890",
      title: "Netflix Premium 1 mês",
      permalink: "https://produto.mercadolivre.com.br/MLB-1234567890-netflix-premium-_JM",
      price_cents: null,
      thumbnail: null,
    };
    const html = `
      <html><head>
        <meta property="og:title" content="Netflix Premium 1 mês" />
        <meta property="og:image" content="https://http2.mlstatic.com/D_NQ_NP_123.webp" />
        <meta itemprop="price" content="39.90" />
      </head></html>`;
    const result = extractProductPageEnrichment(html, candidate);
    expect(result.id).toBe(candidate.id);
    expect(result.permalink).toBe(candidate.permalink);
    expect(result.price_cents).toBe(3990);
    expect(result.thumbnail).toBe("https://http2.mlstatic.com/D_NQ_NP_123.webp");
  });

  test("não substitui preço ou imagem já coletados", () => {
    const candidate = {
      id: "MLB1234567890",
      title: "Netflix Premium",
      permalink: "https://produto.mercadolivre.com.br/MLB-1234567890-netflix-_JM",
      price_cents: 4990,
      thumbnail: "https://http2.mlstatic.com/original.webp",
    };
    const result = extractProductPageEnrichment('<meta itemprop="price" content="99.90"><meta property="og:image" content="https://http2.mlstatic.com/outro.webp">', candidate);
    expect(result.price_cents).toBe(4990);
    expect(result.thumbnail).toBe(candidate.thumbnail);
  });
});
