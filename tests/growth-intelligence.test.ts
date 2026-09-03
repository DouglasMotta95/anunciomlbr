import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const growth = readFileSync(new URL("../src/lib/seller-growth.functions.ts", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../src/routes/_authenticated/dashboard.tsx", import.meta.url), "utf8");
const growthPage = readFileSync(new URL("../src/routes/_authenticated/crescimento.tsx", import.meta.url), "utf8");
const marketPage = readFileSync(new URL("../src/routes/_authenticated/mercado.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260903152000_competitor_watch_history.sql", import.meta.url), "utf8");

describe("inteligência comercial", () => {
  test("usa pedidos reais de 60 dias e separa período atual do anterior", () => {
    expect(growth).toContain("from60.setDate(from60.getDate()-60)");
    expect(growth).toContain("cutoff30.setDate(cutoff30.getDate()-30)");
    expect(growth).toContain("fetchSellerOrders(context.userId,from60.toISOString(),now.toISOString())");
    expect(growth).toContain("comparison:{orders_percent:percentChange");
  });

  test("dashboard desenha série real sem inventar faturamento", () => {
    expect(dashboard).toContain("dataKey=\"revenue_cents\"");
    expect(dashboard).toContain("salesDaily");
    expect(dashboard).toContain("Faturamento diário real dos últimos 30 dias");
    expect(dashboard).toContain("comparison.revenue_percent");
    expect(dashboard).not.toContain("Math.random");
  });

  test("radar confirma MLB retornado antes de salvar snapshot", () => {
    expect(growth).toContain('const id=String(item["id"]??"").toUpperCase()');
    expect(growth).toContain("if(id!==String(watch.ml_item_id).toUpperCase())continue");
    expect(growth).toContain('db.from("competitor_watch_snapshots").insert');
  });

  test("radar registra preço, status, vendas e estoque", () => {
    for (const field of ["price_cents", "status", "sold_quantity", "available_quantity"]) {
      expect(migration).toContain(field);
    }
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(growthPage).toContain("Atualizar radar");
    expect(growthPage).toContain('label="Preço"');
    expect(growthPage).toContain('label="Estoque"');
    expect(growthPage).toContain('label="Vendidos"');
  });

  test("pesquisa de mercado calcula indicadores apenas sobre anúncios confirmados e ativos", () => {
    expect(marketPage).toContain('item.verified_item === true && item.permalink && item.status === "active"');
    expect(marketPage).toContain("Preço médio");
    expect(marketPage).toContain("Faixa de preço");
    expect(marketPage).toContain("Vendedores");
    expect(marketPage).toContain("median(prices)");
    expect(marketPage).not.toContain("Math.random");
  });
});
