import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`${file}: arquivo ausente`);
    return "";
  }
  return fs.readFileSync(full, "utf8");
}

function expect(file, needles, label) {
  const content = read(file);
  for (const needle of needles) {
    if (!content.includes(needle)) failures.push(`${label}: ${file} não contém ${JSON.stringify(needle)}`);
  }
}

function expectNot(file, needles, label) {
  const content = read(file);
  for (const needle of needles) {
    if (content.includes(needle)) failures.push(`${label}: ${file} contém contrato proibido ${JSON.stringify(needle)}`);
  }
}

expect("src/routes/auth.tsx", ["/termos", "/privacidade", "signUp", "signInWithPassword", "signInWithOAuth", "getSession()"], "autenticação, OAuth e aceite legal");
expect("src/integrations/lovable/index.ts", ["signInWithOAuth", "setSession(result.tokens)", "!data.session?.user"], "broker Google cria e valida uma única sessão Supabase");
expect("src/hooks/useAuth.tsx", ["cancelQueries", "SIGNED_IN", "TOKEN_REFRESHED", "setQueryData"], "cache de autenticação não sobrescreve sessão recém-restaurada");
expect("src/routes/__root.tsx", ["CUSTOMER_OAUTH_INTENT", "onAuthStateChange", "session?.user", "finishWithSession", "12000"], "retorno Google OAuth aguarda sessão confirmada");
expect("src/routes/_authenticated/onboarding.tsx", ["openMercadoLivreOAuthStart", "/buscar", "/dashboard", "onboarding_done: true"], "onboarding");
expect("src/routes/_authenticated/integracoes.tsx", ["openMercadoLivreOAuthStart", "syncMercadoLivreCatalog"], "Mercado Livre OAuth/sincronização");
expect("src/routes/_authenticated/buscar.tsx", ["createListingDraft", "Mercado Livre"], "busca/cópia");
expect("src/routes/_authenticated/editor.$id.tsx", ["PublishButton", "generateListingImage", "3 créditos"], "editor/publicação/imagem IA");
expect("src/lib/publish.functions.ts", ["published_ml_id", "Não publique novamente", "publishListingToMl"], "publicação idempotente no Mercado Livre");
expect("src/lib/bulk.functions.ts", ["syncMlPublishedStatus", 'status: "paused" | "active"', "published_ml_id", "source_ml_id", "const mlItemId ="], "pausa/ativação real no Mercado Livre");
expect("src/routes/api/public/webhooks/mercadolivre.ts", ["published_ml_id", "localListingStatus", "resource_owner_mismatch"], "sincronização do webhook Mercado Livre");
expect("src/lib/listing-image-ai.functions.ts", ["IMAGE_CREDIT_COST = 3", "quota.remaining < IMAGE_CREDIT_COST", "consumeAiQuota(context.userId, IMAGE_CREDIT_COST)"], "cobrança de imagem IA");
expect("src/lib/gemini.functions.ts", ["getAiQuota", "consumeAiQuota", "deps.consume(userId, 1)", "callGeminiAuthenticated(data, context.userId)"], "endpoint Gemini tarifado");
expect("src/routes/checkout/index.tsx", ["Mercado Pago", "checkout"], "checkout");
expect("src/lib/checkout.functions.ts", ['.eq("user_id", context.userId)', "resolveCoupon", "MERCADOPAGO_ACCESS_TOKEN"], "checkout autenticado e cupom validado no servidor");
expect("src/lib/extra-ads.functions.ts", ["publicOrigin", "notification_url", "provider_ref"], "checkout de anúncios extras");
expect("src/lib/extra-ai.functions.ts", ["publicOrigin", "notification_url", "provider_ref"], "checkout de créditos de IA");
expect("src/routes/checkout/success.tsx", ["approved", "payment"], "retorno de pagamento");
expect("src/routes/api/public/webhooks/mercadopago.ts", ["isValidMercadoPagoSignature", "amount_mismatch", "issueLicenseForPayment"], "webhook seguro Mercado Pago");
expect("src/routes/_authenticated/admin.tsx", ["beforeLoad", "checkIsAdmin"], "guarda administrativa");
expect("src/lib/admin.server.ts", ["assertAdmin"], "proteção do backend administrativo");
expect("src/lib/setup.functions.ts", ["has_role", "resetPasswordForEmail", "NÃO cria usuários"], "reset administrativo seguro");
expectNot("src/lib/setup.functions.ts", ["auth.admin.createUser", '.from("user_roles").upsert'], "provisionamento administrativo público");
expect("src/lib/admin-health.functions.ts", ["ai_credit_status", "ai-listing-images", "Migrations e catálogo", "3 créditos por imagem"], "diagnóstico de migrations");
expect("supabase/migrations/20260830121000_protect_published_listing_delete.sql", ["protect_published_listing_delete", "published_ml_id", "before delete"], "proteção contra anúncio órfão no Mercado Livre");
expect("supabase/migrations/20260830121800_atomic_coupon_usage.sql", ["consume_coupon_use", "uses = coalesce(uses, 0) + 1", "service_role"], "consumo atômico de cupons");
expect("src/routes/termos.tsx", ["Termos de Uso"], "termos");
expect("src/routes/privacidade.tsx", ["Política de Privacidade"], "privacidade");
expect(".gitignore", [".env", ".env.*"], "proteção de secrets");

if (fs.existsSync(path.join(root, ".env"))) failures.push("segurança: .env não deve estar versionado/presente no checkout do repositório");

if (failures.length) {
  console.error("\nAuditoria dos fluxos críticos falhou:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Fluxos críticos: contratos estáticos essenciais presentes.");
