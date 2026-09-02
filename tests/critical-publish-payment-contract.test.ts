import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("contrato de publicação Mercado Livre", () => {
  const publish = read("src/lib/publish.functions.ts");
  const ui = read("src/components/app/PublishButton.tsx");
  const listings = read("src/routes/_authenticated/anuncios.tsx");
  const migration = read("supabase/migrations/20260902165000_publish_permalink_and_claim.sql");

  test("persiste permalink publicado separado da origem", () => {
    expect(publish).toContain("published_permalink: permalink");
    expect(publish).not.toContain("source_permalink: permalink");
    expect(migration).toContain("published_permalink text");
  });

  test("não fabrica permalink canônico a partir de MLB", () => {
    expect(publish).not.toContain("produto.mercadolivre.com.br/MLB-${");
    expect(publish).toContain("confirmPublishedPermalink");
    expect(publish).toContain("payload.id");
  });

  test("claim atômico impede duas publicações simultâneas", () => {
    expect(publish).toContain('.is("published_ml_id", null)');
    expect(publish).toContain('.is("publishing_claim_token", null)');
    expect(publish).toContain('.eq("publishing_claim_token", claimToken)');
    expect(migration).toContain("publishing_claim_token uuid");
  });

  test("retry de item já publicado não chama nova criação", () => {
    const existingGuard = publish.indexOf("if (existing.published_ml_id)");
    const postCall = publish.indexOf("publishListingToMl(context.userId, data.listing_id)");
    expect(existingGuard).toBeGreaterThan(-1);
    expect(postCall).toBeGreaterThan(existingGuard);
  });

  test("UI só mostra sucesso quando backend retorna ok e mantém prova visível", () => {
    expect(ui).toContain('if (!res.ok)');
    expect(ui).toContain("Publicado no Mercado Livre");
    expect(ui).toContain("Abrir anúncio no Mercado Livre");
    expect(listings).toContain("Rascunho — ainda não publicado");
    expect(listings).toContain("Abrir publicação criada");
    expect(listings).toContain("published_permalink");
  });
});

describe("contrato de vínculo Mercado Livre", () => {
  const callback = read("src/routes/api/public/ml/callback.ts");
  const migration = read("supabase/migrations/20260902203000_unique_connected_ml_account.sql");

  test("uma conta ML ativa pertence a um único login do ANÚNCIO ML", () => {
    expect(callback).toContain('.eq("ml_user_id", mlUserId)');
    expect(callback).toContain('.eq("connected", true)');
    expect(callback).toContain('connectionSaveError.code === "23505"');
    expect(callback).toContain('fail("already_connected")');
    expect(migration).toContain("create unique index if not exists ml_connections_connected_ml_user_uidx");
    expect(migration).toContain("where connected = true and ml_user_id is not null");
  });

  test("dedupe preserva anúncios locais e revoga somente o token da conexão secundária", () => {
    expect(migration).toContain("set connected = false");
    expect(migration).toContain("delete from public.ml_tokens");
    expect(migration).not.toContain("delete from public.listings");
  });
});

describe("contrato de confirmação Mercado Pago", () => {
  const licensing = read("src/lib/licensing.server.ts");
  const webhook = read("src/routes/api/public/webhooks/mercadopago.ts");

  test("confirma referência, valor, moeda, usuário e plano", () => {
    for (const needle of ["external_reference", "amount_cents", 'currency_id !== "BRL"', "metadata?.user_id", "metadata?.plan_id"]) {
      expect(licensing).toContain(needle);
      expect(webhook).toContain(needle);
    }
  });

  test("emissão de licença é idempotente por payment note", () => {
    expect(licensing).toContain("payment:${payment.id}");
    expect(licensing).toContain('licenseError.code === "23505"');
    expect(licensing).toContain("created: false");
  });
});
