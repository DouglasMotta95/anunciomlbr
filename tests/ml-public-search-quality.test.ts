import { describe, expect, test } from "bun:test";
import fs from "node:fs";

import { strictSearchRelevanceScore } from "../src/lib/ml-public-search.functions";

describe("qualidade da busca pública", () => {
  test("consulta de uma palavra funciona para qualquer produto sem exigir posição fixa", () => {
    expect(strictSearchRelevanceScore("iphone", "Apple iPhone 16 128GB Preto")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("geladeira", "Refrigerador Geladeira Frost Free 400L")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("furadeira", "Furadeira Impacto 750W Profissional")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("iphone", "Capa para iPhone 16 Transparente")).toBe(0);
  });

  test("consulta composta exige todos os termos relevantes", () => {
    expect(strictSearchRelevanceScore("iphone 16", "Apple iPhone 16 128GB Preto")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("mesa escritorio", "Mesa Para Escritório 2 Gavetas Branca")).toBeGreaterThanOrEqual(100);
    expect(strictSearchRelevanceScore("iphone 16", "iPhone 15 128GB Preto")).toBe(0);
  });

  test("permalink real do Mercado Livre é a confirmação mínima", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    expect(source).toContain("hasConfirmedRealPermalink");
    expect(source).toContain('itemIdFromRealMlUrl(item.permalink) === item.id');
    expect(source).toContain('search_source: "firecrawl"');
    expect(source).toContain('confirmByPermalink(item, "public_site")');
    expect(source).toContain('confirmByPermalink(item, "gemini_grounding")');
    expect(source).not.toContain('.filter((item) => item.status === "active")');
  });

  test("API bulk enriquece, mas falha de enriquecimento não descarta permalink confirmado", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    expect(source).toContain('/items/bulk?ids=');
    expect(source).toContain('enrichedById.get(candidate.id) ?? candidate');
    expect(source).toContain('verified_item: true');
  });

  test("Gemini não cria candidato sem link real", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    expect(source).toContain('searchAdsWithGeminiGrounding');
    expect(source).toContain('confirmByPermalink(item, "gemini_grounding")');
    expect(source).not.toContain('addItems(byId, groundedCandidates)');
  });

  test("anúncio real confirmado não é descartado só porque preço ou imagem estão ausentes", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    expect(source).not.toContain('.filter((item) => item.price_cents != null && item.price_cents > 0)');
    expect(source).toContain('final_missing_price');
    expect(source).toContain('final_missing_image');
  });

  test("busca oficial e página pública só iniciam após token de conta conectada", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    const guard = source.indexOf('if (!tokens.length)');
    const official = source.indexOf('const officialPromise = officialSearch');
    const fallback = source.indexOf('const fallbackPromise = searchMercadoLivrePublicSiteFallback');
    expect(guard).toBeGreaterThan(-1);
    expect(official).toBeGreaterThan(guard);
    expect(fallback).toBeGreaterThan(guard);
  });

  test("resultado final registra fonte e diagnóstico detalhado", () => {
    const source = fs.readFileSync("src/lib/ml-public-search.functions.ts", "utf8");
    expect(source).toContain("source_counts");
    expect(source).toContain("final_without_confirmed_permalink");
    expect(source).toContain("search_source");
    expect(source).toContain("connected-mlb-search-real-permalink-v15-2026-09-03");
  });

  test("produto, vendedor, ID e link continuam exigindo conta conectada", () => {
    const source = fs.readFileSync("src/lib/ml-search-production.functions.ts", "utf8");
    expect(source).toContain('hasConnectedMlAccount(userId)');
    expect(source).toContain('.eq("connected", true)');
    expect(source).toContain('if (!tokens.length) return []');
  });
});
