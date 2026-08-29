import { describe, expect, it } from "bun:test";

import { normalizeSearchTerm, parseMlSearchInput } from "../src/lib/ml-search-input";

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
  });

  it("identifica URL contendo MLB como item_url", () => {
    expect(parseMlSearchInput("https://produto.mercadolivre.com.br/MLB-1234567890-teste-_JM?utm_source=x")).toMatchObject({ type: "item_url", itemId: "MLB1234567890" });
  });

  it("identifica link curto meli.la como item_url", () => {
    expect(parseMlSearchInput("https://meli.la/abc123?utm_source=x")).toMatchObject({ type: "item_url" });
  });

  it("identifica URL pública de pesquisa e extrai o termo", () => {
    expect(parseMlSearchInput("https://lista.mercadolivre.com.br/iphone-15?utm_source=x")).toMatchObject({ type: "search_url", searchQuery: "iphone 15" });
  });

  it("mantém palavra comum como keyword", () => {
    expect(parseMlSearchInput("Netflix")).toMatchObject({ type: "keyword", searchQuery: "Netflix" });
  });

  it("identifica vendedor explícito por id ou nickname", () => {
    expect(parseMlSearchInput("123456789")).toMatchObject({ type: "seller_id", sellerId: "123456789" });
    expect(parseMlSearchInput("@LOJA_EXEMPLO")).toMatchObject({ type: "seller_nickname", sellerNickname: "LOJA_EXEMPLO" });
  });

  it("identifica URL de perfil/loja por subdomínio", () => {
    expect(parseMlSearchInput("https://perfil.mercadolivre.com.br/LOJA_EXEMPLO")).toMatchObject({ type: "seller_url", sellerNickname: "LOJA_EXEMPLO" });
  });

  it("valida os termos funcionais prioritários", () => {
    for (const query of ["Netflix", "iPhone 15", "notebook gamer"]) {
      expect(parseMlSearchInput(query).type).toBe("keyword");
      expect(normalizeSearchTerm(query)).not.toBe("");
    }
  });
});
