import { describe, expect, test } from "bun:test";

import { itemIdFromRealMlUrl } from "../src/lib/ml-discovery.server";

describe("itemIdFromRealMlUrl", () => {
  test("aceita somente URL real do Mercado Livre com MLB no pathname", () => {
    expect(itemIdFromRealMlUrl("https://produto.mercadolivre.com.br/MLB-1234567890-iphone-15-_JM")).toBe("MLB1234567890");
  });

  test("não aceita MLB somente em query string", () => {
    expect(itemIdFromRealMlUrl("https://www.mercadolivre.com.br/ofertas?item=MLB1234567890")).toBeNull();
  });

  test("não aceita MLB somente em fragmento", () => {
    expect(itemIdFromRealMlUrl("https://www.mercadolivre.com.br/ofertas#MLB1234567890")).toBeNull();
  });

  test("não aceita MLB em domínio externo", () => {
    expect(itemIdFromRealMlUrl("https://exemplo.com/MLB-1234567890-produto")).toBeNull();
  });
});
