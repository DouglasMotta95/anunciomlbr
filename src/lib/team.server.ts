import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  assertCapability,
  getEffectiveRole,
  ROLE_CAPABILITIES,
  ROLE_LABELS,
  type AdminRole,
} from "@/lib/permissions.server";

type Ctx = { supabase: any; userId: string };

const ASSIGNABLE: AdminRole[] = ["owner", "admin", "support", "viewer"];

/** Perfil e permissões do usuário logado (usado pela UI para esconder ações). */
export async function getMyAdminAccess(context: Ctx) {
  const role = await getEffectiveRole(context);
  return {
    role,
    label: ROLE_LABELS[role],
    capabilities: ROLE_CAPABILITIES[role] ?? [],
  };
}

/** Equipe: usuários com perfil administrativo (proprietário, admin, suporte, leitura). */
export async function listAdminTeam(context: Ctx) {
  await assertCapability(context, "admin.access");

  const { data: rows, error } = await supabaseAdmin
    .from("user_roles")
    .select("id,user_id,role,created_at")
    .in("role", ASSIGNABLE as never)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Falha ao listar equipe: ${error.message}`);

  const ids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.user_id)));
  const { data: profiles } = ids.length
    ? await supabaseAdmin.from("profiles").select("id,email,full_name,last_seen_at").in("id", ids)
    : { data: [] as any[] };
  const profileMap = new Map(((profiles ?? []) as any[]).map((p) => [p.id, p]));

  const members = new Map<string, any>();
  for (const row of (rows ?? []) as any[]) {
    const existing = members.get(row.user_id);
    const profile = profileMap.get(row.user_id);
    const roles = existing ? [...existing.roles, row.role] : [row.role];
    members.set(row.user_id, {
      user_id: row.user_id,
      email: profile?.email ?? null,
      full_name: profile?.full_name ?? null,
      last_seen_at: profile?.last_seen_at ?? null,
      roles,
    });
  }

  return {
    members: Array.from(members.values()).map((m) => ({
      ...m,
      primary_role: (ASSIGNABLE.find((r) => m.roles.includes(r)) ?? "viewer") as AdminRole,
    })),
    matrix: ROLE_CAPABILITIES,
    labels: ROLE_LABELS,
  };
}

export type SetRoleInput = { email: string; role: AdminRole | "user" };

/** Define o perfil de um usuário. Somente o proprietário pode fazer isso. */
export async function setTeamRole(data: SetRoleInput, context: Ctx) {
  await assertCapability(context, "roles.manage");

  const email = data.email.trim().toLowerCase();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id,email")
    .ilike("email", email)
    .maybeSingle();
  if (!profile) throw new Error("Usuário não encontrado. Ele precisa ter conta na plataforma.");

  const targetId = (profile as any).id as string;

  if (targetId === context.userId && data.role !== "owner") {
    throw new Error("Você não pode remover o seu próprio acesso de proprietário.");
  }

  await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", targetId)
    .in("role", [...ASSIGNABLE, "user"] as never);

  const { error } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: targetId, role: data.role as never });
  if (error) throw new Error(`Falha ao definir perfil: ${error.message}`);

  // admins também recebem 'admin' implícito para as políticas existentes
  if (data.role === "owner") {
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: targetId, role: "admin" as never });
  }

  await supabaseAdmin.from("admin_audit_logs").insert({
    actor_id: context.userId,
    action: "role_set",
    entity: "user",
    entity_id: targetId,
    target_user_id: targetId,
    target_email: (profile as any).email,
    details: { role: data.role } as never,
  });

  return { ok: true as const };
}
