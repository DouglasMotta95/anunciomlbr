import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { SessionSplash } from "@/components/SessionSplash";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const CUSTOMER_OAUTH_INTENT = "anuncioml_customer_oauth_intent";

type OAuthIntent = "login" | "signup";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Concluindo acesso — ANÚNCIO ML" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallbackPage,
});

function readOAuthValues() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const read = (key: string) => search.get(key) ?? hash.get(key);
  return {
    accessToken: read("access_token"),
    refreshToken: read("refresh_token"),
    code: read("code"),
    error: read("error"),
    errorDescription: read("error_description"),
  };
}

async function destinationFor(userId: string, intent: OAuthIntent | null) {
  if (intent === "signup") return "/onboarding" as const;
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_done")
    .eq("id", userId)
    .maybeSingle();
  return data?.onboarding_done ? "/dashboard" as const : "/onboarding" as const;
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const started = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    const finish = async () => {
      const intent = sessionStorage.getItem(CUSTOMER_OAUTH_INTENT) as OAuthIntent | null;
      const values = readOAuthValues();

      try {
        if (values.error) {
          throw new Error(values.errorDescription || values.error);
        }

        let session = (await supabase.auth.getSession()).data.session;

        if (!session && values.accessToken && values.refreshToken) {
          const result = await supabase.auth.setSession({
            access_token: values.accessToken,
            refresh_token: values.refreshToken,
          });
          if (result.error) throw result.error;
          session = result.data.session;
        }

        if (!session && values.code) {
          const result = await supabase.auth.exchangeCodeForSession(values.code);
          if (result.error) throw result.error;
          session = result.data.session;
        }

        if (!session) {
          session = await new Promise((resolve) => {
            let settled = false;
            let unsubscribe: (() => void) | null = null;
            const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
              if (settled || !nextSession?.user) return;
              settled = true;
              unsubscribe?.();
              resolve(nextSession);
            });
            unsubscribe = () => data.subscription.unsubscribe();

            window.setTimeout(async () => {
              if (settled) return;
              settled = true;
              unsubscribe?.();
              const latest = await supabase.auth.getSession();
              resolve(latest.data.session);
            }, 6000);
          });
        }

        if (!session?.user) {
          throw new Error("O Google autorizou o acesso, mas não entregou uma sessão válida ao ANÚNCIO ML.");
        }

        sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
        window.history.replaceState({}, document.title, "/auth/callback");
        const destination = await destinationFor(session.user.id, intent);
        if (!cancelled) await navigate({ to: destination, replace: true });
      } catch (error) {
        sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
        window.history.replaceState({}, document.title, "/auth/callback");
        if (!cancelled) {
          setFailure(error instanceof Error ? error.message : "Não foi possível concluir o acesso com o Google.");
        }
      }
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!failure) return <SessionSplash />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Não foi possível concluir o login com o Google</h1>
        <p className="mt-2 text-sm text-muted-foreground">{failure}</p>
        <Button className="mt-6 w-full" onClick={() => navigate({ to: "/auth", replace: true })}>
          Voltar para entrar
        </Button>
      </div>
    </div>
  );
}
