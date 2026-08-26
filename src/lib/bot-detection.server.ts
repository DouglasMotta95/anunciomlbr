/**
 * Detecção de acessos suspeitos (bots, crawlers, scanners e spam).
 * Roda apenas no servidor, sempre sobre o User-Agent real da requisição.
 */

const BOT_PATTERNS = [
  "bot",
  "spider",
  "crawler",
  "crawl",
  "slurp",
  "curl",
  "wget",
  "python-requests",
  "httpclient",
  "okhttp",
  "axios",
  "node-fetch",
  "go-http-client",
  "java/",
  "libwww",
  "scrapy",
  "phantomjs",
  "headlesschrome",
  "puppeteer",
  "playwright",
  "selenium",
  "lighthouse",
  "pingdom",
  "uptimerobot",
  "ahrefs",
  "semrush",
  "mj12",
  "dotbot",
  "petalbot",
  "bytespider",
  "gptbot",
  "claudebot",
  "ccbot",
  "perplexitybot",
  "facebookexternalhit",
  "whatsapp",
  "telegrambot",
  "discordbot",
  "slackbot",
  "embedly",
  "vercel-screenshot",
  "monitoring",
  "scanner",
  "masscan",
  "nmap",
  "zgrab",
  "nikto",
  "sqlmap",
];

/** Caminhos que só scanners/exploits pedem — nunca visitas reais. */
const SUSPICIOUS_PATHS = [
  "/wp-admin",
  "/wp-login",
  "/wp-content",
  "/xmlrpc.php",
  "/.env",
  "/.git",
  "/phpmyadmin",
  "/admin.php",
  "/vendor/",
  "/config.json",
  "/actuator",
  "/cgi-bin",
];

export type BotVerdict = { isBot: boolean; reason: string | null };

export function classifyUserAgent(userAgent?: string | null): BotVerdict {
  const ua = userAgent?.trim().toLowerCase() ?? "";
  if (!ua) return { isBot: true, reason: "user_agent_ausente" };
  if (ua.length < 15) return { isBot: true, reason: "user_agent_invalido" };
  const hit = BOT_PATTERNS.find((pattern) => ua.includes(pattern));
  if (hit) return { isBot: true, reason: `user_agent:${hit}` };
  // Navegadores reais sempre declaram Mozilla/ ou uma engine conhecida.
  if (!ua.includes("mozilla") && !ua.includes("safari") && !ua.includes("opera")) {
    return { isBot: true, reason: "user_agent_nao_navegador" };
  }
  return { isBot: false, reason: null };
}

export function classifyPath(path?: string | null): BotVerdict {
  const p = path?.trim().toLowerCase() ?? "/";
  const hit = SUSPICIOUS_PATHS.find((suspect) => p.startsWith(suspect) || p.includes(suspect));
  if (hit) return { isBot: true, reason: `caminho_suspeito:${hit}` };
  return { isBot: false, reason: null };
}

/** Limites de flood: acima disso o tráfego não é humano. */
export const FLOOD_WINDOW_MINUTES = 10;
export const FLOOD_MAX_VISITS = 40;

/** Janela em que um mesmo visitante+página não gera nova linha (deduplicação). */
export const DEDUPE_WINDOW_MINUTES = 30;
