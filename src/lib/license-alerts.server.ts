import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveRefs } from "@/lib/admin-refs.server";
import { assertCapability } from "@/lib/permissions.server";

type Ctx = { supabase: any; userId: string };

export type AlertSettings = {
  enabled: boolean;
  days: number[];
  subject_template: string;
  body_template: string;
  from_name: string;
  updated_at: string;
};

const FALLBACK: AlertSettings = {
  enabled: true,
  days: [30, 10, 7, 3],
  subject_template: "Sua licença ANÚNCIO ML vence em {{dias}} dia(s)",
  body_template:
    "Olá {{nome}},\n\nSua licença {{codigo}} do plano {{plano}} vence em {{dias}} dia(s), no dia {{validade}}.\n\nRenove agora para manter o acesso.\n\n{{link_renovacao}}\n\nEquipe ANÚNCIO ML",
  from_name: "ANÚNCIO ML",
  updated_at: new Date().toISOString(),
};

/** Configuração atual dos alertas (linha única). */
export async function readAlertSettings(): Promise<AlertSettings> {
  const { data } = await supabaseAdmin
    .from("license_alert_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (!data) return FALLBACK;
  return {
    enabled: (data as any).enabled,
    days: ((data as any).days ?? FALLBACK.days) as number[],
    subject_template: (data as any).subject_template,
    body_template: (data as any).body_template,
    from_name: (data as any).from_name,
    updated_at: (data as any).updated_at,
  };
}

export async function getAlertSettings(context: Ctx) {
  await assertCapability(context, "admin.access");
  const settings = await readAlertSettings();
  const emailReady = Boolean(process.env["RESEND_API_KEY"] && process.env["ALERT_EMAIL_FROM"]);
  return { settings, emailReady };
}

export type UpdateAlertSettingsInput = {
  enabled?: boolean | undefined;
  days?: number[] | undefined;
  subject_template?: string | undefined;
  body_template?: string | undefined;
  from_name?: string | undefined;
};

export async function updateAlertSettings(data: UpdateAlertSettingsInput, context: Ctx) {
  await assertCapability(context, "alerts.write");

  const patch: Record<string, unknown> = {};
  if (data.enabled !== undefined) patch["enabled"] = data.enabled;
  if (data.days !== undefined) {
    const days = Array.from(new Set(data.days.filter((d) => d > 0 && d <= 365))).sort((a, b) => b - a);
    if (!days.length) throw new Error("Informe pelo menos um dia de aviso.");
    patch["days"] = days;
  }
  if (data.subject_template !== undefined) patch["subject_template"] = data.subject_template.trim();
  if (data.body_template !== undefined) patch["body_template"] = data.body_template.trim();
  if (data.from_name !== undefined) patch["from_name"] = data.from_name.trim();

  const { error } = await supabaseAdmin
    .from("license_alert_settings")
    .update(patch as never)
    .eq("id", true);
  if (error) throw new Error(`Falha ao salvar configuração: ${error.message}`);

  return { ok: true as const, settings: await readAlertSettings() };
}

function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

async function sendEmail(input: { to: string; subject: string; text: string; fromName: string }) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["ALERT_EMAIL_FROM"];
  if (!apiKey || !from) return { status: "email_pending", error: "Domínio de e-mail não configurado" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${input.fromName} <${from}>`,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!res.ok) return { status: "failed", error: `HTTP ${res.status}` };
    return { status: "sent", error: null as string | null };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : "erro desconhecido" };
  }
}

/**
 * Executa os alertas de vencimento: para cada licença ativa cujo vencimento cai
 * exatamente em um dos dias configurados, envia e-mail (quando disponível) e
 * grava o aviso na conta do cliente. Idempotente por licença + faixa de dias.
 */
export async function runLicenseAlerts(
  options: { force?: boolean; onlyDays?: number[] } = {},
) {
  const settings = await readAlertSettings();
  if (!settings.enabled && !options.force) {
    return { ok: true as const, disabled: true, sent: 0, skipped: 0, failed: 0, results: [] as any[] };
  }

  const days = (options.onlyDays?.length ? options.onlyDays : settings.days).slice().sort((a, b) => b - a);
  const maxDays = Math.max(...days);
  const now = new Date();
  const horizon = new Date(now.getTime() + (maxDays + 1) * 86400000);

  const { data: rows, error } = await supabaseAdmin
    .from("licenses")
    .select("id,code,period,expires_at,user_id,plan_id")
    .eq("status", "active")
    .not("user_id", "is", null)
    .not("expires_at", "is", null)
    .gte("expires_at", now.toISOString())
    .lte("expires_at", horizon.toISOString());
  if (error) throw new Error(`Falha ao ler licenças: ${error.message}`);

  const licenses = (rows ?? []) as any[];
  if (!licenses.length) return { ok: true as const, sent: 0, skipped: 0, failed: 0, results: [] as any[] };

  const { emailMap, planMap } = await resolveRefs(supabaseAdmin, licenses);
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name")
    .in("id", Array.from(new Set(licenses.map((l) => l.user_id))));
  const nameMap = new Map(((profiles ?? []) as any[]).map((p) => [p.id, p.full_name]));

  const appUrl = process.env["APP_PUBLIC_URL"] ?? "https://anunciomlbr.lovable.app";
  const results: Array<{ license: string; email: string | null; bucket: number; status: string }> = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const lic of licenses) {
    const daysLeft = Math.ceil((new Date(lic.expires_at).getTime() - now.getTime()) / 86400000);
    // faixa = menor dia configurado que ainda cobre o vencimento (ex.: 8 dias -> faixa 10)
    const bucket = days.filter((d) => d >= daysLeft).sort((a, b) => a - b)[0];
    if (bucket === undefined) continue;

    const email = emailMap.get(lic.user_id) ?? null;
    const vars = {
      nome: (nameMap.get(lic.user_id) as string) || (email ? email.split("@")[0]! : "cliente"),
      codigo: lic.code,
      plano: lic.plan_id ? planMap.get(lic.plan_id) ?? "—" : "—",
      dias: String(Math.max(daysLeft, 0)),
      validade: new Date(lic.expires_at).toLocaleDateString("pt-BR"),
      link_renovacao: `${appUrl}/checkout`,
    };

    const subject = render(settings.subject_template, vars);
    const text = render(settings.body_template, vars);

    const delivery = email
      ? await sendEmail({ to: email, subject, text, fromName: settings.from_name })
      : { status: "skipped", error: "cliente sem e-mail" };

    const { error: logError } = await supabaseAdmin.from("license_alert_log").insert({
      license_id: lic.id,
      user_id: lic.user_id,
      day_bucket: bucket,
      channel: "email",
      status: delivery.status,
      recipient: email,
      error: delivery.error ?? null,
    });

    if (logError) {
      // índice único → aviso já enviado nessa faixa
      skipped += 1;
      results.push({ license: lic.code, email, bucket, status: "duplicado" });
      continue;
    }

    await supabaseAdmin.from("activity_events").insert({
      user_id: lic.user_id,
      kind: "license_expiring",
      message:
        daysLeft <= 1
          ? "Sua licença vence hoje. Renove para não perder o acesso."
          : `Sua licença vence em ${daysLeft} dias. Renove para manter o acesso.`,
      meta: { license_id: lic.id, license_code: lic.code, days_left: daysLeft, bucket } as never,
    });

    if (delivery.status === "sent") sent += 1;
    else if (delivery.status === "failed") failed += 1;
    else skipped += 1;

    results.push({ license: lic.code, email, bucket, status: delivery.status });
  }

  return { ok: true as const, sent, skipped, failed, results };
}

export async function triggerLicenseAlerts(
  data: { onlyDays?: number[] | undefined },
  context: Ctx,
) {
  await assertCapability(context, "alerts.send");
  const result = await runLicenseAlerts({ force: true, ...(data.onlyDays ? { onlyDays: data.onlyDays } : {}) });
  await supabaseAdmin.from("admin_audit_logs").insert({
    actor_id: context.userId,
    action: "license_alerts_run",
    entity: "alert",
    details: { sent: result.sent, skipped: result.skipped, failed: result.failed } as never,
  });
  return result;
}

/** Histórico de avisos enviados. */
export async function listAlertHistory(
  data: { page: number; pageSize: number },
  context: Ctx,
) {
  await assertCapability(context, "admin.access");
  const from = data.page * data.pageSize;
  const { data: rows, count, error } = await supabaseAdmin
    .from("license_alert_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + data.pageSize - 1);
  if (error) throw new Error(`Falha ao listar avisos: ${error.message}`);
  return { alerts: (rows ?? []) as any[], total: count ?? 0 };
}
