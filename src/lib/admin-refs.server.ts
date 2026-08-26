/** Resolve emails de perfis e nomes de planos para linhas com user_id/plan_id. */
export async function resolveRefs(
  supabaseAdmin: any,
  rows: Array<{ user_id?: string | null; plan_id?: string | null }>,
) {
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  const planIds = Array.from(new Set(rows.map((r) => r.plan_id).filter(Boolean))) as string[];

  const [profiles, plans] = await Promise.all([
    userIds.length
      ? supabaseAdmin.from("profiles").select("id,email").in("id", userIds)
      : Promise.resolve({ data: [] }),
    planIds.length
      ? supabaseAdmin.from("plans").select("id,name").in("id", planIds)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    emailMap: new Map<string, string | null>(
      ((profiles.data ?? []) as any[]).map((p) => [p.id as string, p.email ?? null]),
    ),
    planMap: new Map<string, string | null>(
      ((plans.data ?? []) as any[]).map((p) => [p.id as string, p.name ?? null]),
    ),
  };
}
