import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Verificação de acesso administrativo NO SERVIDOR.
 *
 * A autorização nunca depende de estado do frontend: o bearer token é
 * validado pelo middleware e a permissão é resolvida pelo RBAC central.
 */
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { assertCapability } = await import("@/lib/permissions.server");
      const role = await assertCapability(context, "admin.access");
      return { isAdmin: true as const, role };
    } catch {
      return { isAdmin: false as const, role: "user" as const };
    }
  });
