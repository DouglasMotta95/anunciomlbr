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

expect("src/routes/auth.tsx", ["/termos", "/privacidade", "signUp", "signInWithPassword", "signInWithOAuth", 'signOut({ scope: "local" })', "/auth/callback"], "autenticação, OAuth e aceite legal");
expect("src/routes/auth.callback.tsx", ["/auth/callback", "setSession", "exchangeCodeForSession", "access_token", "refresh_token", "onAuthStateChange", "history.replaceState"], "callback Google conclui sessão explicitamente");
expect("src/integrations/lovable/index.ts", ["signInWithOAuth", "setSession(result.tokens)", "!data.session?.user"], "broker Google cria e valida sessão no fluxo sem redirect");
expect("src/integrations/supabase/client.ts", ["import.meta.env['VITE_SUPABASE_URL']", "import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY']", "persistSession: true", "autoRefreshToken: true", "detectSessionInUrl: true"], "Supabase usa variáveis Vite literais e persiste sessão OAuth");
expectNot("src/integrations/supabase/client.ts", ["import.meta.env[name]"], "configuração Supabase não usa acesso dinâmico que some no bundle Vite");
expect("src/hooks/useAuth.tsx", ["cancelQueries", "SIGNED_IN", "TOKEN_REFRESHED", "setQueryData"], "cache de autenticação não sobrescreve sessão recém-restaurada");
expectNot("src/routes/__root.tsx", ["OAuthReturnBridge", "CUSTOMER_OAUTH_INTENT", "onAuthStateChange"], "raiz não interfere no callback de autenticação");
expect("src/routes/__root.tsx", ["Página não encontrada", "Não foi possível carregar esta página", "Tentar novamente"], "erros globais em português");
expect("src/routes/admin.login.tsx", ["Preparando acesso administrativo", "signOut", "checkIsAdmin"], "login administrativo começa isolado");
expect("src/routes/_authenticated/onboarding.tsx", ["openMercadoLivreOAuthStart", "/buscar", "/dashboard", "onboarding_done: true"], "onboarding");
expect("src/routes/_authenticated/integracoes.tsx", ["openMercadoLivreOAuthStart", "syncMercadoLivreCatalog"], "Mercado Livre OAuth/sincronização");
expect("src/routes/_authenticated/buscar.tsx", ["createListingDraft", "Mercado Livre"], "busca/cópia");
expect("src/routes/_authenticated/editor.$id.tsx", ["PublishButton", "generateListingImage", "3 créditos"], "editor/publicação/imagem IA");
expect("src/lib/publish.functions.ts", ["published_ml_id", "Não publique novamente", "publishListingToMl"], "publicação idempotente no Mercado Livre");
expect("src/lib/bulk.functions.ts", ["syncMlPublishedStatus", 'status: "paused" | "active"', "published_ml_id", "source_ml_id", "const mlItemId ="], "pausa/ativação real no Mercado Livre");
expect("src/routes/api/public/webhooks/mercadolivre.ts", ["published_ml_id", "localListingStatus", "resource_owner_mismatch", 'value === "closed"', 'value === "under_review"', 'value === "inactive"'], "sincronização do webhook Mercado Livre");
expect("src/lib/listing-image-ai.functions.ts", ["IMAGE_CREDIT_COST = 3", "quota.remaining < IMAGE_CREDIT_COST", "consumeAiQuota(context.userId, IMAGE_CREDIT_COST)", 'const bucket = "ai-listing-images"'], "cobrança e armazenamento de imagem IA");
expect("src/lib/gemini.functions.ts", ["getAiQuota", "consumeAiQuota", "deps.consume(userId, 1)", "callGeminiAuthenticated(data, context.userId)"], "endpoint Gemini tarifado");
expect("src/lib/ai-quota.server.ts", ["resolvePaidLimit", '.from("licenses")', "ai_credits_used"], "quota de IA usa modelo real de licenças");
expectNot("src/lib/ai-quota.server.ts", ['.from("subscriptions")'], "quota de IA não consulta tabela inexistente");
expect("src/lib/admin-health.functions.ts", ["ai_credit_status", "p_user_id", "listing_quota_claims", "ai-listing-images", "Migrations e catálogo", "3 créditos por imagem"], "diagnóstico de migrations");
expect("src/lib/pricing.ts", ["listing_limit: 250", "listing_limit: 1000", "listing_limit: 3000", "ai_credits: 1000"], "fallback público alinhado ao catálogo");
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
expect("supabase/migrations/20260828063000_listing_creation_quota.sql", ["listing_quota_claims", "claim_listing_quota", "consume_ad_quota"], "franquia de criação de anúncios");
expect("supabase/migrations/20260828205900_add_ai_package_plan_kind.sql", ["ai_package", "ALTER TYPE"], "tipo de pacote extra de IA");
expect("supabase/migrations/20260828184500_ai_listing_images_bucket.sql", ["ai-listing-images", "image/webp"], "bucket de imagens IA");
expect("supabase/migrations/20260828210000_credit_catalog_v2.sql", ["ai_extra_100", "ads_extra_25", "ai_credits = 1000"], "catálogo de créditos extras");
expect("supabase/migrations/20260828211500_ai_image_cost_v3.sql", ["3 créditos por imagem gerada"], "custo atual de imagem IA");
expect("supabase/migrations/20260831105000_ai_credit_rpc_license_model.sql", ["ai_credit_status", "consume_ai_credit", "ai_package", "public.licenses"], "RPC de créditos alinhada a licenças");
expect("supabase/migrations/20260831110500_align_main_plan_ad_quotas.sql", ["ad_quota=250", "ad_quota=1000", "ad_quota=3000"], "franquias principais alinhadas à vitrine");
expect("supabase/migrations/20260831114000_ai_quota_runtime_hardening.sql", ["ai_credits_used", "ensure_referral_code", "protect_published_listing_delete"], "runtime de IA e privilégios de funções");
expect("supabase/migrations/20260831114500_listing_status_ml_sync.sql", ["closed", "under_review", "inactive"], "status locais compatíveis com Mercado Livre");
expect("supabase/migrations/20260831115000_runtime_privilege_hardening.sql", ["TRUNCATE", "REFERENCES", "TRIGGER", "ml_tokens", "listing_quota_claims"], "privilégios de banco reduzidos");
expect("src/integrations/supabase/types.manual.ts", ["ListingStatus", '"closed"', '"under_review"', '"inactive"'], "tipos manuais acompanham enum de anúncios");
expect("supabase/migrations/20260830121000_protect_published_listing_delete.sql", ["protect_published_listing_delete", "published_ml_id", "before delete"], "proteção contra anúncio órfão no Mercado Livre");
expect("supabase/migrations/20260830121800_atomic_coupon_usage.sql", ["consume_coupon_use", "uses = coalesce(uses, 0) + 1", "service_role"], "consumo atômico de cupons");
expect("public/robots.txt", ["Disallow: /admin", "Disallow: /api/", "Sitemap: https://anunciomlbr.lovable.app/sitemap.xml"], "SEO não indexa áreas privadas");
expect("public/sitemap.xml", ["https://anunciomlbr.lovable.app/", "/termos", "/privacidade"], "sitemap contém somente páginas públicas principais");
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
