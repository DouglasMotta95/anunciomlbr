import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminRole = "owner" | "admin" | "support" | "viewer" | "user";

export type Capability =
  | "admin.access"
  | "licenses.generate"
  | "licenses.renew"
  | "licenses.reset"
  | "licenses.suspend"
  | "licenses.cancel"
  | "plans.write"
  | "coupons.write"
  | "alerts.write"
  | "alerts.send"
  | "roles.manage"
  | "export.data";

/** Matriz de permissões por perfil. Leitura é liberada a qualquer perfil admin. */
export const ROLE_CAPABILITIES: Record<AdminRole, Capability[]> = {
  owner: [
    "admin.access",
    "licenses.generate",
    "licenses.renew",
    "licenses.reset",
    "licenses.suspend",
    "licenses.cancel",
    "plans.write",
    "coupons.write",
    "alerts.write",
    "alerts.send",
    "roles.manage",
    "export.data",
  ],
  admin: [
    "admin.access",
    "licenses.generate",
    "licenses.renew",
    "licenses.reset",
    "licenses.suspend",
    "licenses.cancel",
    "plans.write",
    "coupons.write",
    "alerts.write",
    "alerts.send",
    "export.data",
  ],
  support: ["admin.access", "licenses.renew", "licenses.suspend", "alerts.send", "export.data"],
  viewer: ["admin.access"],
  user: [],
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  support: "Suporte",
  viewer: "Leitura",
  user: "Cliente",
};

const PRIORITY: AdminRole[] = ["owner", "admin", "support", "viewer", "user"];

type Ctx = { supabase: any; userId: string };

/** Perfil efetivo (o mais permissivo) do usuário autenticado. */
export async function getEffectiveRole(context: Ctx): Promise<AdminRole> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);

  const roles = new Set(((data ?? []) as any[]).map((r) => r.role as AdminRole));
  for (const role of PRIORITY) {
    if (roles.has(role)) return role;
  }
  return "user";
}

export function roleHas(role: AdminRole, capability: Capability) {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/** Garante que o usuário tem a permissão pedida; caso contrário, bloqueia. */
export async function assertCapability(context: Ctx, capability: Capability) {
  const role = await getEffectiveRole(context);
  if (!roleHas(role, capability)) {
    throw new Error(
      capability === "admin.access"
        ? "Acesso administrativo negado."
        : `Seu perfil (${ROLE_LABELS[role]}) não tem permissão para esta ação.`,
    );
  }
  return role;
}

/** Registra uma ação administrativa na auditoria (nunca lança). */
export async function logAudit(input: {
  actorId: string;
  action: string;
  entity?: string;
  entityId?: string | null;
  targetUserId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const [{ data: actor }, { data: target }] = await Promise.all([
      supabaseAdmin.from("profiles").select("email").eq("id", input.actorId).maybeSingle(),
      input.targetUserId
        ? supabaseAdmin.from("profiles").select("email").eq("id", input.targetUserId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    await supabaseAdmin.from("admin_audit_logs").insert({
      actor_id: input.actorId,
      actor_email: (actor as any)?.email ?? null,
      action: input.action,
      entity: input.entity ?? "license",
      entity_id: input.entityId ?? null,
      target_user_id: input.targetUserId ?? null,
      target_email: (target as any)?.email ?? null,
      details: input.details ?? {},
    });
  } catch {
    // auditoria não deve bloquear a operação
  }
}
