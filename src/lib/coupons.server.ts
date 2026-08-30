import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CouponResult =
  | { ok: true; code: string; discount_percent: number }
  | { ok: false; reason: "not_found" | "inactive" | "expired" | "exhausted" };

/** Valida um cupom real no banco (nunca confia no valor enviado pelo cliente). */
export async function resolveCoupon(rawCode: string): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  const { data, error } = await supabaseAdmin
    .from("coupons")
    .select("code, discount_percent, max_uses, uses, expires_at, active")
    .ilike("code", code)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "not_found" };
  if (!data.active) return { ok: false, reason: "inactive" };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (data.max_uses !== null && data.uses >= data.max_uses) {
    return { ok: false, reason: "exhausted" };
  }

  const percent = Math.min(Math.max(Number(data.discount_percent) || 0, 0), 100);
  return { ok: true, code: data.code, discount_percent: percent };
}

/** Consome um uso do cupom após o pagamento aprovado, sem read-modify-write concorrente. */
export async function consumeCoupon(code: string) {
  const db = supabaseAdmin as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  };
  const { data, error } = await db.rpc("consume_coupon_use", { _code: code.trim() });
  if (error) {
    console.error("Coupon usage increment failed", error.message);
    return false;
  }
  return data === true;
}
