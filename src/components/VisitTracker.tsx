import { useEffect } from "react";

import { trackVisit } from "@/lib/analytics.functions";

const VISITOR_KEY = "aml_visitor_id";
const SESSION_KEY = "aml_visit_session";

function readId(store: Storage, key: string) {
  try {
    const existing = store.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    store.setItem(key, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * Registra o acesso real à landing page (uma vez por sessão de navegador),
 * incluindo visitantes sem conta, com origem e parâmetros UTM.
 */
export function VisitTracker({ path = "/" }: { path?: string }) {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const visitorId = readId(localStorage, VISITOR_KEY);
      const sessionId = readId(sessionStorage, SESSION_KEY);
      if (!visitorId) return;

      const marker = `${SESSION_KEY}:${path}`;
      try {
        if (sessionStorage.getItem(marker)) return;
        sessionStorage.setItem(marker, "1");
      } catch {
        /* sem storage: registra normalmente */
      }

      const params = new URLSearchParams(window.location.search);
      const pick = (key: string) => params.get(key)?.slice(0, 120) || undefined;

      try {
        if (cancelled) return;
        await trackVisit({
          data: {
            visitor_id: visitorId,
            session_id: sessionId ?? undefined,
            path,
            referrer: document.referrer || undefined,
            utm_source: pick("utm_source"),
            utm_medium: pick("utm_medium"),
            utm_campaign: pick("utm_campaign"),
            utm_term: pick("utm_term"),
            utm_content: pick("utm_content"),
            user_agent: navigator.userAgent?.slice(0, 400) || undefined,
            is_authenticated: Boolean(localStorage.getItem("sb-access-token")),
          },
        });
      } catch {
        /* nunca quebra a landing por causa do contador */
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return null;
}
