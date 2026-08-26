import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdQuota = {
  quota: number;
  used: number;
  remaining: number;
  plan_name: string | null;
  expires_at: string | null;
};

/** Consumo de publicações do usuário logado (calculado no banco). */
export const getAdQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdQuota> => {
    const { data, error } = await context.supabase.rpc("my_ad_quota");
    if (error) throw new Error("Não foi possível carregar seu consumo.");
    const row = Array.isArray(data) ? data[0] : data;
    return {
      quota: row?.quota ?? 0,
      used: row?.used ?? 0,
      remaining: row?.remaining ?? 0,
      plan_name: row?.plan_name ?? null,
      expires_at: row?.expires_at ?? null,
    };
  });
