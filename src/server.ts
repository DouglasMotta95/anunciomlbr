import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

const PUBLIC_WEBHOOK_PREFIX = "/api/public/webhooks/";
const SENSITIVE_PREFIXES = [
  "/admin",
  "/anuncios",
  "/assinatura",
  "/buscar",
  "/cancelamento",
  "/conta",
  "/creditos",
  "/crescimento",
  "/dashboard",
  "/editor",
  "/estoque",
  "/indicacoes",
  "/integracoes",
  "/licenca",
  "/notificacoes",
  "/onboarding",
  "/perguntas",
  "/relatorios",
  "/resultados",
  "/revendedor",
  "/saude-anuncios",
  "/vendas",
];

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isSensitivePath(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    SENSITIVE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

function rejectRequest(request: Request): Response | null {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (["TRACE", "CONNECT"].includes(method)) {
    return new Response("Method not allowed", { status: 405 });
  }

  if (url.search.length > 8192) {
    return new Response("Request URI too long", { status: 414 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 0) {
    const maxBytes = url.pathname.startsWith(PUBLIC_WEBHOOK_PREFIX) ? 512 * 1024 : 4 * 1024 * 1024;
    if (contentLength > maxBytes) {
      return new Response("Payload too large", { status: 413 });
    }
  }

  if (isUnsafeMethod(method) && !url.pathname.startsWith(PUBLIC_WEBHOOK_PREFIX)) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "cross-site") {
      return new Response("Cross-site request blocked", { status: 403 });
    }

    const origin = request.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).origin !== url.origin) {
          return new Response("Invalid request origin", { status: 403 });
        }
      } catch {
        return new Response("Invalid request origin", { status: 403 });
      }
    }
  }

  return null;
}

function withSecurityHeaders(response: Response, request: Request) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);

  headers.delete("server");
  headers.delete("x-powered-by");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("X-Download-Options", "noopen");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("Origin-Agent-Cluster", "?1");
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("Cross-Origin-Resource-Policy", "same-site");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), usb=(), browsing-topics=(), interest-cohort=()",
  );
  headers.set(
    "Content-Security-Policy",
    "base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://lovable.dev https://*.lovable.dev https://gptengineer.app https://*.gptengineer.app; form-action 'self'; upgrade-insecure-requests",
  );

  if (url.protocol === "https:" && url.hostname !== "localhost") {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  if (isSensitivePath(url.pathname)) {
    headers.set("Cache-Control", "no-store, max-age=0");
    headers.set("Pragma", "no-cache");
  }

  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", crypto.randomUUID());
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const rejected = rejectRequest(request);
    if (rejected) return withSecurityHeaders(rejected, request);

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return withSecurityHeaders(normalized, request);
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
      );
    }
  },
};
