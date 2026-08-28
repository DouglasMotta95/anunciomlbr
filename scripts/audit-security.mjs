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
    if (!content.includes(needle)) {
      failures.push(`${label}: ${file} não contém ${JSON.stringify(needle)}`);
    }
  }
}

expect(
  "src/server.ts",
  [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "Permissions-Policy",
    "Cross-site request blocked",
    "Payload too large",
    "Cache-Control",
  ],
  "headers/CSRF/limites HTTP",
);
expect(
  "src/integrations/supabase/auth-middleware.ts",
  ["getClaims(token)", "MAX_BEARER_LENGTH", "Expired token", "Invalid audience", "Invalid role"],
  "sessão autenticada",
);
expect(
  "src/routes/api/public/webhooks/mercadopago.ts",
  [
    "MERCADOPAGO_WEBHOOK_SECRET",
    "invalid_signature",
    "timingSafeEqual",
    "amount_mismatch",
    "currency_mismatch",
    "user_mismatch",
    "plan_mismatch",
  ],
  "webhook Mercado Pago",
);
expect(
  "src/lib/ml-pkce.functions.ts",
  ["code_challenge", "S256", "crypto.randomUUID", "ml_oauth_states"],
  "OAuth Mercado Livre PKCE",
);
expect(
  "src/routes/api/public/ml/callback.ts",
  [".delete()", "invalid_state", "code_verifier", "ml_tokens"],
  "callback Mercado Livre",
);
expect(
  "supabase/migrations/20260828224500_security_hardening.sql",
  [
    "REVOKE UPDATE ON public.profiles FROM authenticated",
    "GRANT UPDATE (full_name, onboarding_done, last_seen_at)",
    "REVOKE ALL ON public.ml_tokens FROM anon, authenticated",
  ],
  "privilégios de banco",
);

const gitignore = read(".gitignore");
for (const pattern of [".env", ".env.*"]) {
  if (!gitignore.includes(pattern)) failures.push(`.gitignore não protege ${pattern}`);
}
for (const envName of [".env", ".env.local", ".env.production", ".env.development"]) {
  if (fs.existsSync(path.join(root, envName))) failures.push(`segurança: ${envName} não deve estar no checkout`);
}

const suspiciousRules = [
  { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Supabase service role exposto ao Vite", regex: /VITE_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*/ },
  { name: "Mercado Pago access token literal", regex: /APP_USR-[A-Za-z0-9_-]{20,}/ },
  { name: "Google API key literal", regex: /AIza[0-9A-Za-z_-]{30,}/ },
];

const ignoredDirs = new Set([".git", "node_modules", "dist", ".output", ".vinxi", "public"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".sql", ".md", ".yml", ".yaml", ".toml"]);

function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
      continue;
    }
    if (!textExtensions.has(path.extname(entry.name))) continue;
    const rel = path.relative(root, full).replaceAll(path.sep, "/");
    const content = fs.readFileSync(full, "utf8");
    for (const rule of suspiciousRules) {
      if (rule.regex.test(content)) failures.push(`${rel}: possível ${rule.name}`);
    }
  }
}

scan(root);

if (failures.length) {
  console.error("\nAuditoria de segurança falhou:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Segurança: contratos, secrets e proteções críticas verificados.");
