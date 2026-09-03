import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
function read(file){const full=path.join(root,file);if(!fs.existsSync(full)){failures.push(`${file}: arquivo ausente`);return "";}return fs.readFileSync(full,"utf8");}
function expect(file,needles,label){const content=read(file);for(const needle of needles)if(!content.includes(needle))failures.push(`${label}: ${file} não contém ${JSON.stringify(needle)}`);}
function expectNot(file,needles,label){const content=read(file);for(const needle of needles)if(content.includes(needle))failures.push(`${label}: ${file} contém contrato proibido ${JSON.stringify(needle)}`);}

expect("src/routes/auth.tsx",["/termos","/privacidade","signUp","signInWithPassword","lovable.auth.signInWithOAuth","supabase.auth.setSession","supabase.auth.exchangeCodeForSession"],"autenticação e aceite legal");
expectNot("src/routes/auth.tsx",["supabase.auth.signInWithOAuth"],"OAuth Google usa broker Lovable");
expect("src/routes/_authenticated/integracoes.tsx",["openMercadoLivreOAuthStart","syncMercadoLivreCatalog"],"Mercado Livre OAuth/sincronização");
expect("src/routes/api/public/ml/callback.ts",["already_connected",'.eq("ml_user_id", mlUserId)', '.neq("user_id", userId)'],"conta ML única por login ativo");
expect("src/lib/ml-discovery.server.ts",["verifyCandidates","verified_item === true",'item.status === "active"',"isMercadoLivrePermalink"],"busca só exibe anúncios reais confirmados");
expectNot("src/lib/ml-discovery.server.ts",["baseItem("],"busca não fabrica candidato");
expect("src/lib/ml-public-search.functions.ts",["verifyCandidates","item.verified_item === true","firecrawlEnrichMercadoLivreAds","searchAdsWithGeminiGrounding"],"busca pública confirma antes de exibir");
expect("src/routes/_authenticated/buscar.tsx",["createListingDraft","verified_item","Ver anúncio","Duplicar anúncio"],"busca e cópia");
expect("src/components/app/AppShell.tsx",["ai_credit_status","ai-credit-balance","/creditos-ia","IA:"],"saldo de IA visível");
expect("src/lib/bulk.functions.ts",['if (kind === "duplicate")','status: "draft"'],"duplicação cria rascunho");
expect("src/lib/publish.functions.ts",["published_ml_id","publishListingToMlWithStatus",'z.enum(["active", "paused"])'],"publicação idempotente");
expect("src/routes/api/public/webhooks/mercadopago.ts",["isValidMercadoPagoSignature","amount_mismatch","issueLicenseForPayment"],"webhook Mercado Pago seguro");
expect("src/lib/registration-abuse.functions.ts",["device","ip"],"proteção antiabuso presente");
expect("src/routes/_authenticated/saude-anuncios.tsx",["Raio-X"],"Raio-X comercial");
expect("src/routes/_authenticated/mercado.tsx",["verified_item","active"],"pesquisa de mercado confirmada");
expect("src/routes/_authenticated/crescimento.tsx",["Radar","Atualizar radar"],"radar de concorrentes");
expect("src/routes/_authenticated/precificacao.tsx",["Nenhum preço é alterado automaticamente","calculateSmartPrice"],"precificação segura");
expect("src/routes/_authenticated/encalhados.tsx",["não prova de ausência de vendas"],"encalhados sem métrica fabricada");
expect("supabase/migrations/20260903165000_commercial_intelligence_suite.sql",["automation_rules","keyword_tracks","pricing_audit_log","ENABLE ROW LEVEL SECURITY"],"suite comercial protegida por RLS");
expectNot("src/routes/_authenticated/precificacao.tsx",["Math.random"],"precificação não fabrica dados");
expectNot("src/routes/_authenticated/encalhados.tsx",["Math.random"],"triagem não fabrica dados");

if(failures.length){console.error("\nAuditoria dos fluxos críticos falhou:\n");for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}console.log("Fluxos críticos: autenticação, ML, busca, duplicação, publicação, pagamento e inteligência comercial verificados.");
