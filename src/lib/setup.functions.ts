import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AUTHORIZED_ADMIN_EMAIL = "siteprimebr@gmail.com";
const PUBLIC_APP_ORIGIN = "https://anunciomlbr.lovable.app";

/**
 * Provisiona/redefine a conta administrativa principal de forma idempotente.
 * Por privacidade, o endpoint nunca revela se o e-mail informado é ou não o autorizado.
 * Apenas o e-mail administrativo real gera qualquer ação no backend.
 */
export const provisionAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const normalizedEmail = data.email.trim().toLowerCase();

    // Resposta neutra para impedir enumeração/descoberta do e-mail administrativo.
    if (normalizedEmail !== AUTHORIZED_ADMIN_EMAIL) {
      return { ok: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw new Error(listError.message);

    let userId =
      list?.users?.find((user) => user.email?.toLowerCase() === AUTHORIZED_ADMIN_EMAIL)?.id ?? null;

    if (!userId) {
      const initialPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: AUTHORIZED_ADMIN_EMAIL,
        password: initialPassword,
        email_confirm: true,
        user_metadata: { full_name: "Administrador" },
      });
      if (createError) throw new Error(createError.message);
      userId = created.user?.id ?? null;
    }

    if (!userId) throw new Error("Falha ao obter o usuário administrador.");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);

    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      AUTHORIZED_ADMIN_EMAIL,
      { redirectTo: `${PUBLIC_APP_ORIGIN}/reset-password` },
    );
    if (resetError) throw new Error(resetError.message);

    return { ok: true as const };
  });
