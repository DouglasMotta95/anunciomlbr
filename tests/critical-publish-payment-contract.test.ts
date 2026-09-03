import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("contrato de publicação Mercado Livre", () => {
  const publish = read("src/lib/publish.functions.ts");
  const publishMode = read("src/lib/ml-publish-mode.server.ts");
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
    const postCall = publish.indexOf("publishListingToMlWithStatus(context.userId, data.listing_id, data.publication_status)");
    expect(existingGuard).toBeGreaterThan(-1);
    expect(postCall).toBeGreaterThan(existingGuard);
  });

  test("publicação aceita ativo ou pausado e não duplica se a pausa falhar", () => {
    expect(publish).toContain('z.enum(["active", "paused"])');
    expect(publish).toContain("status: result.status");
    expect(publishMode).toContain('body: JSON.stringify({ status: "paused" })');
    expect(publishMode).toContain("nunca repetimos o POST /items");
    expect(publishMode).toContain('status: "active"');
    expect(ui).toContain("Publicar já ativo");
    expect(ui).toContain("Publicar como pausado");
  });

  test("UI só mostra sucesso quando backend retorna ok e mantém prova visível", () => {
    expect(ui).toContain('if (!res.ok)');
    expect(ui).toContain("Publicado pausado no Mercado Livre");
    expect(ui).toContain("Publicado ativo no Mercado Livre");
    expect(ui).toContain("Abrir anúncio no Mercado Livre");
    expect(listings).toContain("Rascunho — ainda não publicado");
    expect(listings).toContain("Abrir publicação criada");
    expect(listings).toContain("published_permalink");
  });
});

describe("contrato da tela Buscar e copiar", () => {
  const search = read("src/lib/ml-public-search.functions.ts");
  const publicFallback = read("src/lib/ml-public-site-fallback.server.ts");
  const enrich = read("src/lib/ml-firecrawl-enrich.server.ts");
  const buscar = read("src/routes/_authenticated/buscar.tsx");

  test("conta conectada é exigida antes da busca paralela e todo candidato é confirmado", () => {
    const connectionGuard = search.indexOf("if (!tokens.length)");
    const officialStart = search.indexOf("const officialPromise = officialSearch");
    const publicStart = search.indexOf("const fallbackPromise = searchMercadoLivrePublicSiteFallback");
    expect(connectionGuard).toBeGreaterThan(-1);
    expect(officialStart).toBeGreaterThan(connectionGuard);
    expect(publicStart).toBeGreaterThan(connectionGuard);
    expect(search).toContain("Promise.all([officialPromise, fallbackPromise])");
    expect(search).toContain("verifyCandidates(query, publicCandidates");
    expect(search).toContain("item.verified_item === true");
    expect(search).toContain("isBrazilMlPermalink(item.permalink)");
    expect(search).toContain("itemIdFromRealMlUrl(item.permalink) === item.id");
    expect(publicFallback).toContain("https://lista.mercadolivre.com.br/");
    expect(publicFallback).toContain("itemIdFromRealMlUrl");
  });

  test("Firecrawl completa dados faltantes visitando o permalink real", () => {
    expect(search).toContain("[...officialItems, ...publicCandidates]");
    expect(search).toContain("firecrawlEnrichMercadoLivreAds");
    expect(search).toContain("mergeEnrichment(officialItems, enriched)");
    expect(search).toContain("mergeEnrichment(verifiedPublic, enriched)");
    expect(enrich).toContain("url: candidate.permalink");
    expect(enrich).toContain("itemIdFromRealMlUrl(candidate.permalink) !== candidate.id");
  });

  test("grounding nunca entra direto na lista sem confirmação oficial", () => {
    expect(search).toContain("searchAdsWithGeminiGrounding");
    expect(search).toContain("verifyCandidates(query, groundedCandidates");
    expect(search).not.toContain("addItems(byId, groundedCandidates)");
  });

  test("cada card expõe ver anúncio e duplicar anúncio", () => {
    expect(buscar).toContain("Ver anúncio");
    expect(buscar).toContain("Duplicar anúncio");
  });

  test("duplicação só confirma depois de receber ID real e oferece link para o editor", () => {
    expect(buscar).toContain("!result.id");
    expect(buscar).toContain("Duplicação criada e confirmada");
    expect(buscar).toContain("Duplicação criada no painel");
    expect(buscar).toContain('to: "/editor/$id"');
    expect(buscar).toContain("Duplicação não concluída");
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
