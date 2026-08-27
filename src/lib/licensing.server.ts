/** Emissão automática de licença após pagamento aprovado. */
const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

export type IssueResult =
  | { ok: true; license_code: string; created: boolean }
  | { ok: false; reason: "unknown_payment" | "not_approved" | "license_failed" };

export async function issueLicenseForPayment(paymentId: string): Promise<IssueResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*, plans(code,kind,period_months)")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { ok: false, reason: "unknown_payment" };
  if (payment.status !== "approved") return { ok: false, reason: "not_approved" };

  const paymentNote = `payment:${payment.id}`;
  const { data: existing } = await supabaseAdmin.from("licenses").select("code").eq("note", paymentNote).maybeSingle();
  if (existing) return { ok: true, license_code: existing.code, created: false };

  const isAddon = payment.plans?.kind === "ad_package";
  const months = isAddon ? (payment.plans?.period_months ?? 12) : (PERIOD_MONTHS[payment.period] ?? 1);
  const startsAt = new Date();
  const expiresAt = new Date(startsAt);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const { data: code } = await supabaseAdmin.rpc("generate_license_code", { _plan_code: payment.plans?.code ?? "pro" });
  const { error: licenseError } = await supabaseAdmin.from("licenses").insert({
    code: code as string,
    plan_id: payment.plan_id,
    period: payment.period,
    origin: "mercado_pago",
    status: payment.user_id ? "active" : "available",
    user_id: payment.user_id,
    activated_at: payment.user_id ? startsAt.toISOString() : null,
    starts_at: startsAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    note: paymentNote,
  });
  if (licenseError) {
    if (licenseError.code === "23505") {
      const { data: raced } = await supabaseAdmin.from("licenses").select("code").eq("note", paymentNote).maybeSingle();
      if (raced) return { ok: true, license_code: raced.code, created: false };
    }
    console.error("License insert failed", licenseError.message);
    return { ok: false, reason: "license_failed" };
  }

  if (payment.user_id && !isAddon) {
    const { data: oldMain } = await supabaseAdmin
      .from("licenses")
      .select("id, note, plans!inner(kind)")
      .eq("user_id", payment.user_id)
      .eq("status", "active")
      .neq("note", paymentNote)
      .neq("plans.kind", "ad_package");
    const oldIds = (oldMain ?? []).map((row: { id: string }) => row.id).filter(Boolean);
    if (oldIds.length) await supabaseAdmin.from("licenses").update({ status: "cancelled" }).in("id", oldIds);
  }

  const couponCode = (payment.raw as { coupon?: { code?: string } } | null)?.coupon?.code;
  if (couponCode) {
    const { consumeCoupon } = await import("@/lib/coupons.server");
    await consumeCoupon(couponCode);
  }

  if (payment.user_id) {
    await supabaseAdmin.from("activity_events").insert({
      user_id: payment.user_id,
      kind: isAddon ? "ad_package_approved" : "payment_approved",
      message: isAddon ? "Pagamento aprovado e anúncios extras adicionados automaticamente" : "Pagamento aprovado e plano liberado automaticamente",
      meta: { payment_id: payment.id, license_code: code, purchase_kind: isAddon ? "ad_package" : "plan" },
    });
  }

  return { ok: true, license_code: code as string, created: true };
}

export async function syncPaymentWithMercadoPago(paymentId: string) {
  const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!accessToken) return { status: null as string | null, license_code: null as string | null };
  const response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(paymentId)}&sort=date_created&criteria=desc`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) { console.error("Mercado Pago search failed", response.status); return { status: null, license_code: null }; }
  const body = (await response.json()) as { results?: Array<{ id?: number | string; status?: string }> };
  const results = body.results ?? [];
  const approved = results.find((r) => r.status === "approved");
  const mpPayment = approved ?? results[0];
  if (!mpPayment?.status) return { status: null, license_code: null };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("payments").update({ status: mpPayment.status, provider_ref: mpPayment.id ? String(mpPayment.id) : null }).eq("id", paymentId);
  if (mpPayment.status !== "approved") return { status: mpPayment.status, license_code: null };
  const issued = await issueLicenseForPayment(paymentId);
  return { status: mpPayment.status, license_code: issued.ok ? issued.license_code : null };
}
