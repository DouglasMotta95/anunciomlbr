import { describe, expect, test } from "bun:test";
import fs from "node:fs";

import { strictSearchRelevanceScore } from "../src/lib/ml-public-search.functions";

describe("qualidade da busca pública", () => {
  test("consulta de uma palavra funciona para qualquer produto sem exigir posição fixa", () => {
    expect(strictSearchRelevanceScore("iphone", "Apple iPhone 16 128GB Preto")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("geladeira", "Refrigerador Geladeira Frost Free 400L")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("furadeira", "Furadeira Impacto 750W Profissional")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("iphone", "Capa para iPhone 16 Transparente")).toBe(0);
    expect(strictSearchRelevanceScore("geladeira", "Livro Manual Geladeira Antiga")).toBe(0);
    expect(strictSearchRelevanceScore("furadeira", "Suporte para Furadeira de Bancada")).toBe(0);
  });

  test("consulta composta exige todos os termos relevantes, sem depender de exemplos fixos", () => {
    expect(strictSearchRelevanceScore("iphone 16", "Apple iPhone 16 128GB Preto")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("mesa escritorio", "Mesa Para Escritório 2 Gavetas Branca")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("tenis corrida", "Tênis Masculino Para Corrida Leve")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("iphone 16", "iPhone 15 128GB Preto")).toBe(0);
    expect(strictSearchRelevanceScore("mesa escritorio", "Mesa de Jantar 6 Lugares")).toBe(0);
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

  test("busca coleta mais candidatos e ranqueia relevância, completude e vendas", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    expect(source).toContain('Math.min(Math.max(desired * 2, 20), 50)');
    expect(source).toContain('resultQualityScore');
    expect(source).toContain('(b.sold_quantity ?? -1) - (a.sold_quantity ?? -1)');
    expect(source).toContain('public-mercado-livre-like-search-verify-and-rank');
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

  test("produto, vendedor, ID e link também exigem permalink real com MLB correspondente", () => {
    const source = fs.readFileSync("src/lib/ml-search-production.functions.ts", "utf8");
    expect(source).toContain('itemIdFromRealMlUrl(item.permalink) === id');
    expect(source).toContain('verified_item: verifiedItem');
    expect(source).toContain('output.push(...mapped.filter(isConfirmedRealMlItem))');
    expect(source).toContain('mapped.filter((item) => isConfirmedActiveMlItem(item)');
    expect(source).toContain('const items = result.items.filter(isConfirmedActiveMlItem)');
    expect(source).toContain('result.item && isConfirmedRealMlItem(result.item)');
  });

  test("oferta de catálogo não cria card fallback sem permalink confirmado", () => {
    const source = fs.readFileSync("src/lib/ml-search-production.functions.ts", "utf8");
    expect(source).toContain('if (!detail || !isConfirmedActiveMlItem(detail)) return []');
    expect(source).not.toContain('permalink: null,\n      category: row.category_id');
  });
});
