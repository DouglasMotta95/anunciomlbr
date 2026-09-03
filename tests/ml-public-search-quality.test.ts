import { describe, expect, test } from "bun:test";
import fs from "node:fs";

import { strictSearchRelevanceScore } from "../src/lib/ml-public-search.functions";

describe("qualidade da busca pública", () => {
  test("consulta de uma palavra só exige que o produto comece pelo termo", () => {
    expect(strictSearchRelevanceScore("Lovable", "Lovable AI Pro 1 ano")).toBeGreaterThanOrEqual(120);
    expect(strictSearchRelevanceScore("Lovable", "Livro: Ia Lovable (adorable): La Revolución Tecnológica")).toBe(0);
    expect(strictSearchRelevanceScore("Lovable", "Extensão Chrome Lovable 600 + Licença Pro")).toBe(0);
    expect(strictSearchRelevanceScore("Netflix", "Netflix Gift Card Oficial")).toBeGreaterThanOrEqual(120);
    expect(strictSearchRelevanceScore("Netflix", "TV Box Android com Netflix 4K")).toBe(0);
  });

  test("consulta composta exige todos os termos relevantes", () => {
    expect(strictSearchRelevanceScore("iphone 16", "iPhone 16 128GB Preto")).toBeGreaterThanOrEqual(120);
    expect(strictSearchRelevanceScore("iphone 16", "iPhone 15 128GB Preto")).toBe(0);
  });

  test("contrato final só admite anúncio confirmado e valida grounding antes de exibir", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    expect(source).toContain('item.verified_item === true');
    expect(source).toContain('item.status === "active"');
    expect(source).toContain('itemIdFromRealMlUrl(item.permalink) === item.id');
    expect(source).toContain('searchAdsWithGeminiGrounding');
    expect(source).toContain('verifyCandidates(query, groundedCandidates');
    expect(source).not.toContain('addItems(byId, groundedCandidates)');
  });

  test("anúncio real confirmado não é descartado só porque o preço ainda está ausente", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    expect(source).not.toContain('.filter((item) => item.price_cents != null && item.price_cents > 0)');
    expect(source).toContain('final_missing_price');
    expect(source).toContain('price_cents: existing.price_cents ?? item.price_cents');
  });

  test("Firecrawl pode completar também item oficial e o merge preserva os dados mais completos", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    expect(source).toContain('[...officialItems, ...publicCandidates]');
    expect(source).toContain('mergeEnrichment(officialItems, enriched)');
    expect(source).toContain('mergeEnrichment(verifiedPublic, enriched)');
    expect(source).toContain('mergeSearchItem(existing, item)');
  });

  test("busca oficial e página pública são iniciadas em paralelo", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    expect(source).toContain('const officialPromise = tokensPromise.then');
    expect(source).toContain('const fallbackPromise = searchMercadoLivrePublicSiteFallback');
    expect(source).toContain('Promise.all([tokensPromise, officialPromise, fallbackPromise])');
  });
});
