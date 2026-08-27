import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PUBLIC_CALLBACK = "https://anunciomlbr.lovable.app/api/public/ml/callback";

export const getMlPkceAuthorizationUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = process.env["ML_CLIENT_ID"]?.trim();
    const clientSecret = process.env["ML_CLIENT_SECRET"]?.trim();
    if (!clientId || !clientSecret) {
      console.warn("ML OAuth PKCE start blocked: missing credentials");
      return { configured: false as const, url: null, reason: "not_configured" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deriveMlPkce } = await import("@/lib/ml-pkce.server");

    await supabaseAdmin.from("ml_oauth_states").delete().lt("expires_at", new Date().toISOString());

    const state = crypto.randomUUID();
    const { challenge } = await deriveMlPkce(state, clientSecret);

    const { error } = await supabaseAdmin.from("ml_oauth_states").insert({
      state,
      user_id: context.userId,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    if (error) {
      console.error("ML OAuth PKCE state persist failed", { code: error.code, message: error.message });
      return { configured: true as const, url: null, reason: "state_error" as const };
    }

    const url = new URL("https://auth.mercadolivre.com.br/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", PUBLIC_CALLBACK);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    return { configured: true as const, url: url.toString(), reason: null };
  });
