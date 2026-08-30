import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AUTHORIZED_ADMIN_EMAIL = "siteprimebr@gmail.com";
const FALLBACK_PUBLIC_APP_ORIGIN = "https://anunciomlbr.lovable.app";

function publicAppOrigin() {
  const raw = process.env["APP_PUBLIC_URL"]?.trim();
  if (!raw) return FALLBACK_PUBLIC_APP_ORIGIN;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return FALLBACK_PUBLIC_APP_ORIGIN;
    }
    return url.origin;
  } catch {
    return FALLBACK_PUBLIC_APP_ORIGIN;
  }
}

/**
 * Solicita a redefinição da senha da conta administrativa existente.
 *
 * Segurança: esta rota pública NÃO cria usuários e NÃO concede papel admin.
 * O bootstrap administrativo deve acontecer por migration/console seguro, nunca
 * a partir da tela pública de "esqueci minha senha".
 * A resposta permanece neutra para evitar enumeração de contas.
 */
export const provisionAdminAccount = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const normalizedEmail = data.email.trim().toLowerCase();
    if (normalizedEmail !== AUTHORIZED_ADMIN_EMAIL) return { ok: true as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error("admin reset user lookup failed", listError.message);
      return { ok: true as const };
    }

    const user = list?.users?.find((candidate) => candidate.email?.toLowerCase() === AUTHORIZED_ADMIN_EMAIL);
    if (!user?.id) return { ok: true as const };

    const { data: hasAdminRole, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleError || hasAdminRole !== true) {
      if (roleError) console.error("admin reset role lookup failed", roleError.message);
      return { ok: true as const };
    }

    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      AUTHORIZED_ADMIN_EMAIL,
      { redirectTo: `${publicAppOrigin()}/reset-password` },
    );
    if (resetError) console.error("admin password reset request failed", resetError.message);

    return { ok: true as const };
  });
