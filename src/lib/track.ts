import { trackFunnelEvent } from "@/lib/analytics.functions";

export type FunnelEvent = "view_plan" | "start_checkout" | "purchase";

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

/** Envia um evento real do funil de conversão (fire-and-forget). */
export function trackEvent(
  event: FunnelEvent,
  payload: {
    plan_code?: string | undefined;
    period?: string | undefined;
    amount_cents?: number | undefined;
    coupon_code?: string | undefined;
    meta?: Record<string, unknown>;
  } = {},
) {
  if (typeof window === "undefined") return;
  const visitorId = readId(localStorage, VISITOR_KEY);
  if (!visitorId) return;

  void trackFunnelEvent({
    data: {
      visitor_id: visitorId,
      session_id: readId(sessionStorage, SESSION_KEY) ?? undefined,
      event,
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      plan_code: payload.plan_code,
      period: payload.period,
      amount_cents: payload.amount_cents,
      coupon_code: payload.coupon_code,
      meta: payload.meta ?? {},
    },
  }).catch(() => undefined);
}

/** Garante que o mesmo evento não seja contado duas vezes na mesma sessão. */
export function trackEventOnce(key: string, event: FunnelEvent, payload?: Parameters<typeof trackEvent>[1]) {
  if (typeof window === "undefined") return;
  const marker = `aml_evt:${event}:${key}`;
  try {
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, "1");
  } catch {
    /* sem storage: registra normalmente */
  }
  trackEvent(event, payload);
}
