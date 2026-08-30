import { describe, expect, it } from "bun:test";

import { normalizeSearchTerm, parseMlSearchInput, safeMlUrl } from "../src/lib/ml-search-input";

describe("normalizeSearchTerm", () => {
  it("normaliza termos para o slug público do Mercado Livre", () => {
    expect(normalizeSearchTerm("iPhone 15 Pro Max")).toBe("iphone-15-pro-max");
    expect(normalizeSearchTerm("Notebook Gamer")).toBe("notebook-gamer");
    expect(normalizeSearchTerm("Tênis Masculino")).toBe("tenis-masculino");
  });
});

describe("parseMlSearchInput", () => {
  it("identifica IDs MLB com e sem hífen", () => {
    expect(parseMlSearchInput("MLB1234567890")).toMatchObject({ type: "item_id", itemId: "MLB1234567890" });
    expect(parseMlSearchInput("MLB-1234567890")).toMatchObject({ type: "item_id", itemId: "MLB1234567890" });
    expect(parseMlSearchInput("  mlb_1234567890 ")).toMatchObject({ type: "item_id", itemId: "MLB1234567890" });
  });

  it("identifica URL de anúncio com e sem protocolo", () => {
    expect(parseMlSearchInput("https://produto.mercadolivre.com.br/MLB-1234567890-teste-_JM?utm_source=x")).toMatchObject({ type: "item_url", itemId: "MLB1234567890" });
    expect(parseMlSearchInput("produto.mercadolivre.com.br/MLB-1234567890-teste-_JM")).toMatchObject({ type: "item_url", itemId: "MLB1234567890" });
    expect(parseMlSearchInput("www.mercadolivre.com.br/item/MLB1234567890")).toMatchObject({ type: "item_url", itemId: "MLB1234567890" });
  });

  it("identifica link mobile do Mercado Livre", () => {
    expect(parseMlSearchInput("https://m.mercadolivre.com.br/MLB-1234567890-produto-_JM#position=1&type=item")).toMatchObject({ type: "item_url", itemId: "MLB1234567890" });
  });

  it("identifica página de produto de catálogo como product_url", () => {
    expect(parseMlSearchInput("https://www.mercadolivre.com.br/apple-iphone-15/p/MLB1234567890")).toMatchObject({ type: "product_url", productId: "MLB1234567890" });
  });

  it("trata links curtos como short_url para resolver no servidor", () => {
    expect(parseMlSearchInput("https://meli.la/abc123?utm_source=x")).toMatchObject({ type: "short_url" });
    expect(parseMlSearchInput("https://www.mercadolivre.com.br/sec/1AbCdEf")).toMatchObject({ type: "short_url" });
  });

  it("identifica URL pública de pesquisa e extrai o termo", () => {
    expect(parseMlSearchInput("https://lista.mercadolivre.com.br/iphone-15?utm_source=x")).toMatchObject({ type: "search_url", searchQuery: "iphone 15" });
    expect(parseMlSearchInput("https://lista.mercadolivre.com.br/comprar-notebook-gamer_NoIndex_True")).toMatchObject({ type: "search_url", searchQuery: "notebook gamer" });
    expect(parseMlSearchInput("https://www.mercadolivre.com.br/jm/search?as_word=fone%20bluetooth")).toMatchObject({ type: "search_url", searchQuery: "fone bluetooth" });
  });

  it("identifica listagem de vendedor por _CustId_", () => {
    expect(parseMlSearchInput("https://lista.mercadolivre.com.br/_CustId_123456789")).toMatchObject({ type: "seller_url", sellerId: "123456789" });
  });

  it("mantém palavra comum como keyword", () => {
    expect(parseMlSearchInput("Netflix")).toMatchObject({ type: "keyword", searchQuery: "Netflix" });
    expect(parseMlSearchInput("smart tv 50 polegadas")).toMatchObject({ type: "keyword" });
  });

  it("identifica vendedor explícito por id ou nickname", () => {
    expect(parseMlSearchInput("123456789")).toMatchObject({ type: "seller_id", sellerId: "123456789" });
    expect(parseMlSearchInput("@LOJA_EXEMPLO")).toMatchObject({ type: "seller_nickname", sellerNickname: "LOJA_EXEMPLO" });
    expect(parseMlSearchInput("vendedor: LOJA_EXEMPLO")).toMatchObject({ type: "seller_nickname", sellerNickname: "LOJA_EXEMPLO" });
  });

  it("identifica URL de perfil/loja por subdomínio e por caminho", () => {
    expect(parseMlSearchInput("https://perfil.mercadolivre.com.br/LOJA_EXEMPLO")).toMatchObject({ type: "seller_url", sellerNickname: "LOJA_EXEMPLO" });
    expect(parseMlSearchInput("https://loja.mercadolivre.com.br/loja-exemplo")).toMatchObject({ type: "seller_url", sellerNickname: "loja-exemplo" });
    expect(parseMlSearchInput("https://www.mercadolivre.com.br/perfil/LOJA_EXEMPLO")).toMatchObject({ type: "seller_url", sellerNickname: "LOJA_EXEMPLO" });
  });

  it("ignora hosts externos", () => {
    expect(parseMlSearchInput("https://exemplo.com/MLB-1234567890").type).toBe("keyword");
  });
});

describe("safeMlUrl", () => {
  it("remove parâmetros de rastreamento e mantém os relevantes", () => {
    const url = safeMlUrl("https://lista.mercadolivre.com.br/iphone?utm_source=x&as_word=iphone&tracking=1");
    expect(url?.searchParams.get("utm_source")).toBeNull();
    expect(url?.searchParams.get("tracking")).toBeNull();
    expect(url?.searchParams.get("as_word")).toBe("iphone");
  });

  it("extrai a URL de um texto colado com ruído", () => {
    expect(safeMlUrl("olha esse https://produto.mercadolivre.com.br/MLB-1234567890-x-_JM aqui")?.hostname).toBe("produto.mercadolivre.com.br");
  });
});
