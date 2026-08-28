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

expect("src/routes/auth.tsx", ["/termos", "/privacidade", "signUp", "signInWithPassword", "signInWithOAuth"], "autenticação e aceite legal");
expect("src/routes/_authenticated/onboarding.tsx", ["/integracoes"], "onboarding");
expect("src/routes/_authenticated/integracoes.tsx", ["openMercadoLivreOAuthStart", "syncMercadoLivreCatalog"], "Mercado Livre OAuth/sincronização");
expect("src/routes/_authenticated/buscar.tsx", ["create", "Mercado Livre"], "busca/cópia");
expect("src/routes/_authenticated/editor.$id.tsx", ["PublishButton", "generateListingImage", "3 créditos"], "editor/publicação/imagem IA");
expect("src/lib/listing-image-ai.functions.ts", ["quota.remaining < 3", "consumeAiQuota(context.userId, 3)"], "cobrança de imagem IA");
expect("src/lib/gemini.functions.ts", ["getAiQuota", "consumeAiQuota(context.userId, 1)"], "endpoint Gemini tarifado");
expect("src/routes/checkout/index.tsx", ["Mercado Pago", "checkout"], "checkout");
expect("src/routes/checkout/success.tsx", ["approved", "payment"], "retorno de pagamento");
expect("src/routes/_authenticated/admin.tsx", ["beforeLoad", "checkIsAdmin"], "guarda administrativa");
expect("src/lib/admin.server.ts", ["assertAdmin"], "proteção do backend administrativo");
expect("src/lib/admin-health.functions.ts", ["ai_credit_status", "ai-listing-images", "Migrations e catálogo"], "diagnóstico de migrations");
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
