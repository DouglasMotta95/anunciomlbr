/** Emissão automática de licença após pagamento aprovado. */
const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

export type IssueResult =
  | { ok: true; license_code: string; created: boolean }
  | { ok: false; reason: "unknown_payment" | "not_approved" | "license_failed" };

type MercadoPagoPayment = {
  id?: string | number;
  status?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  metadata?: { payment_id?: string; user_id?: string; plan_id?: string };
};

function providerAmountCents(payment: MercadoPagoPayment) {
  return typeof payment.transaction_amount === "number" && Number.isFinite(payment.transaction_amount)
    ? Math.round(payment.transaction_amount * 100)
    : null;
}

function validatesMercadoPagoPayment(
  provider: MercadoPagoPayment,
  internal: { id: string; user_id: string | null; plan_id: string | null; amount_cents: number },
) {
  const reference = (provider.external_reference ?? provider.metadata?.payment_id)?.trim();
  if (reference !== internal.id) return false;
  if (providerAmountCents(provider) !== internal.amount_cents) return false;
  if (provider.currency_id !== "BRL") return false;
  if (provider.metadata?.payment_id && provider.metadata.payment_id !== internal.id) return false;
  if (provider.metadata?.user_id && internal.user_id && provider.metadata.user_id !== internal.user_id) return false;
  if (provider.metadata?.plan_id && internal.plan_id && provider.metadata.plan_id !== internal.plan_id) return false;
  return true;
}

function mergedPaymentRaw(existing: unknown, provider: MercadoPagoPayment) {
  const preserved = existing && typeof existing === "object" && !Array.isArray(existing)
    ? (existing as Record<string, unknown>)
    : {};
  return { ...preserved, mercado_pago: provider };
}

export async function issueLicenseForPayment(paymentId: string): Promise<IssueResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*, plans(code,kind,period_months,ad_quota,ai_credits)")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { ok: false, reason: "unknown_payment" };
  if (payment.status !== "approved") return { ok: false, reason: "not_approved" };

  const paymentNote = `payment:${payment.id}`;
  const { data: existing } = await supabaseAdmin.from("licenses").select("code").eq("note", paymentNote).maybeSingle();
  if (existing) return { ok: true, license_code: existing.code, created: false };

  const kind = payment.plans?.kind ?? "plan";
  const isAdAddon = kind === "ad_package";
  const isAiAddon = kind === "ai_package";
  const isAddon = isAdAddon || isAiAddon;
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
    ads_quota: isAdAddon ? Number(payment.plans?.ad_quota ?? 0) : null,
    ads_used: 0,
    ai_credits_used: 0,
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
      .neq("note", paymentNote);
    const oldIds = (oldMain ?? [])
      .filter((row: any) => !["ad_package", "ai_package"].includes(row?.plans?.kind))
      .map((row: { id: string }) => row.id)
      .filter(Boolean);
    if (oldIds.length) await supabaseAdmin.from("licenses").update({ status: "cancelled" }).in("id", oldIds);
  }

  const couponCode = (payment.raw as { coupon?: { code?: string } } | null)?.coupon?.code;
  if (couponCode) {
    const { consumeCoupon } = await import("@/lib/coupons.server");
    await consumeCoupon(couponCode);
  }

  if (payment.user_id) {
    const message = isAdAddon
      ? "Pagamento aprovado e anúncios extras adicionados ao saldo"
      : isAiAddon
        ? "Pagamento aprovado e créditos extras de IA adicionados ao saldo"
        : "Pagamento aprovado e plano liberado automaticamente";
    await supabaseAdmin.from("activity_events").insert({
      user_id: payment.user_id,
      kind: isAdAddon ? "ad_package_approved" : isAiAddon ? "ai_package_approved" : "payment_approved",
      message,
      meta: {
        payment_id: payment.id,
        license_code: code,
        purchase_kind: isAdAddon ? "ad_package" : isAiAddon ? "ai_package" : "plan",
        ad_quota: isAdAddon ? Number(payment.plans?.ad_quota ?? 0) : null,
        ai_credits: isAiAddon ? Number(payment.plans?.ai_credits ?? 0) : null,
      },
    });
  }

  return { ok: true, license_code: code as string, created: true };
}

/**
 * Confirma ativamente um checkout consultando o Mercado Pago.
 * A busca por external_reference é somente descoberta: antes de persistir ou
 * emitir licença, o resultado precisa bater com referência, valor, moeda,
 * usuário e plano registrados localmente.
 */
export async function syncPaymentWithMercadoPago(paymentId: string) {
  const accessToken = process.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim();
  if (!accessToken) return { status: null as string | null, license_code: null as string | null };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("id,user_id,plan_id,amount_cents,status,raw")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError || !payment) {
    if (paymentError) console.error("Mercado Pago internal payment lookup failed", paymentError.message);
    return { status: null, license_code: null };
  }

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(paymentId)}&sort=date_created&criteria=desc`,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
  );
  if (!response.ok) {
    console.error("Mercado Pago search failed", response.status);
    return { status: null, license_code: null };
  }

  const body = (await response.json()) as { results?: MercadoPagoPayment[] };
  const validResults = (body.results ?? []).filter((candidate) =>
    validatesMercadoPagoPayment(candidate, payment),
  );
  if (!validResults.length) {
    if ((body.results ?? []).length) {
      console.error("Mercado Pago confirmation rejected: provider data mismatch", { paymentId });
    }
    return { status: null, license_code: null };
  }

  const mpPayment = validResults.find((candidate) => candidate.status === "approved") ?? validResults[0];
  if (!mpPayment?.status || mpPayment.id == null) return { status: null, license_code: null };

  const { error: updateError } = await supabaseAdmin
    .from("payments")
    .update({
      status: mpPayment.status,
      provider_ref: String(mpPayment.id),
      raw: mergedPaymentRaw(payment.raw, mpPayment) as never,
    })
    .eq("id", paymentId)
    .eq("amount_cents", payment.amount_cents);
  if (updateError) {
    console.error("Mercado Pago payment persistence failed", updateError.message);
    return { status: null, license_code: null };
  }

  if (mpPayment.status !== "approved") return { status: mpPayment.status, license_code: null };
  const issued = await issueLicenseForPayment(paymentId);
  return { status: mpPayment.status, license_code: issued.ok ? issued.license_code : null };
}
