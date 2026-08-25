import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Provisionamento ÚNICO da conta administrativa inicial.
 *
 * Segurança:
 * - Só executa enquanto NÃO existir nenhum admin em user_roles (one-shot;
 *   depois vira inerte para sempre).
 * - O e-mail é restrito ao endereço autorizado pelo dono do projeto.
 * - A senha inicial é aleatória e nunca exposta; o acesso real acontece via
 *   link de redefinição enviado ao e-mail do administrador.
 */
const AUTHORIZED_ADMIN_EMAIL = "siteprimebr@gmail.com";

export const provisionAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    if (data.email.toLowerCase() !== AUTHORIZED_ADMIN_EMAIL) {
      return { ok: false as const, reason: "email_not_authorized" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Trava one-shot: qualquer admin existente desativa esta função.
    const { data: existingAdmins, error: adminsError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);
    if (adminsError) throw new Error(adminsError.message);
    if (existingAdmins && existingAdmins.length > 0) {
      return { ok: false as const, reason: "already_provisioned" };
    }

    const initialPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;

    let userId: string | null = null;
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: AUTHORIZED_ADMIN_EMAIL,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { full_name: "Administrador" },
    });

    if (createError) {
      // Usuário pode já existir (ex.: cadastro prévio sem role admin).
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const found = list?.users?.find(
        (u) => u.email?.toLowerCase() === AUTHORIZED_ADMIN_EMAIL,
      );
      if (!found) {
        throw new Error("Não foi possível criar o usuário administrador.");
      }
      userId = found.id;
    } else {
      userId = created.user?.id ?? null;
    }

    if (!userId) throw new Error("Falha ao obter o usuário administrador.");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (roleError && !roleError.message.toLowerCase().includes("duplicate")) {
      throw new Error(roleError.message);
    }

    // Envia e-mail de redefinição para o administrador definir a própria senha.
    const appUrl = process.env["APP_PUBLIC_URL"] ?? "";
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      AUTHORIZED_ADMIN_EMAIL,
      { redirectTo: `${appUrl}/reset-password` },
    );
    if (resetError) throw new Error(resetError.message);

    return { ok: true as const };
  });
