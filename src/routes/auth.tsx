import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Logo, SLOGAN } from "@/components/brand";
import { SessionSplash } from "@/components/SessionSplash";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { checkRegistrationAbuse, confirmRegistrationAbuse } from "@/lib/registration-abuse.functions";

const searchSchema = z.object({ mode: z.enum(["login", "signup"]).optional(), ref: z.string().trim().min(3).max(32).optional() });
const title = "Entrar ou criar conta — ANÚNCIO ML";
const description = "Acesse sua conta ANÚNCIO ML ou crie a sua em segundos e ganhe 10 anúncios gratuitos para testar a plataforma.";
const CUSTOMER_OAUTH_INTENT = "anuncioml_customer_oauth_intent";
const REGISTRATION_DEVICE_ID = "anuncioml_registration_device_id";
const REGISTRATION_RESERVATION = "anuncioml_registration_reservation";

type OAuthIntent = "login" | "signup";

function registrationDeviceId() {
  const existing = localStorage.getItem(REGISTRATION_DEVICE_ID)?.trim();
  if (existing && existing.length >= 16) return existing;
  const id = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(REGISTRATION_DEVICE_ID, id);
  return id;
}

function readOAuthReturn() {
  if (typeof window === "undefined") return { accessToken: null, refreshToken: null, code: null, error: null, errorDescription: null };

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const value = search.get(key) ?? hash.get(key);
      if (value) return value;
    }
    return null;
  };

  let accessToken = read("access_token", "accessToken");
  let refreshToken = read("refresh_token", "refreshToken");
  const packedTokens = read("tokens");

  if ((!accessToken || !refreshToken) && packedTokens) {
    try {
      const parsed = JSON.parse(packedTokens) as { access_token?: unknown; refresh_token?: unknown; accessToken?: unknown; refreshToken?: unknown };
      accessToken = typeof parsed.access_token === "string" ? parsed.access_token : typeof parsed.accessToken === "string" ? parsed.accessToken : accessToken;
      refreshToken = typeof parsed.refresh_token === "string" ? parsed.refresh_token : typeof parsed.refreshToken === "string" ? parsed.refreshToken : refreshToken;
    } catch {
      // Alguns retornos do broker não usam o parâmetro agregado `tokens`.
    }
  }

  return {
    accessToken,
    refreshToken,
    code: read("code"),
    error: read("error"),
    errorDescription: read("error_description", "errorDescription"),
  };
}

function cleanOAuthReturnUrl() {
  if (typeof window === "undefined") return;
  const current = new URL(window.location.href);
  const sensitive = ["access_token", "refresh_token", "accessToken", "refreshToken", "tokens", "code", "error", "error_description", "errorDescription"];
  sensitive.forEach((key) => current.searchParams.delete(key));
  current.hash = "";
  window.history.replaceState({}, document.title, `${current.pathname}${current.search}`);
}

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, ref } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useAuth();
  const checkRegistration = useServerFn(checkRegistrationAbuse);
  const confirmRegistration = useServerFn(confirmRegistrationAbuse);
  const [preparingCustomerLogin, setPreparingCustomerLogin] = useState(true);
  const [isSignup, setIsSignup] = useState(mode === "signup" || !!ref);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function customerDestination(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_done")
      .eq("id", userId)
      .maybeSingle();
    return data?.onboarding_done ? "/dashboard" : "/onboarding";
  }

  async function reserveRegistration(emailValue: string) {
    const result = await checkRegistration({ data: { email: emailValue, deviceId: registrationDeviceId() } });
    if (!result.allowed) throw new Error(result.message);
    sessionStorage.setItem(REGISTRATION_RESERVATION, result.reservationToken);
    return result.reservationToken;
  }

  async function confirmReservedRegistration(userId: string, emailValue?: string | null) {
    let reservationToken = sessionStorage.getItem(REGISTRATION_RESERVATION);
    if (!reservationToken) {
      if (!emailValue) throw new Error("Não foi possível validar a origem deste cadastro.");
      reservationToken = await reserveRegistration(emailValue);
    }
    const result = await confirmRegistration({ data: { reservationToken, userId } });
    if (!result.ok) throw new Error("Não foi possível concluir a proteção deste cadastro.");
    sessionStorage.removeItem(REGISTRATION_RESERVATION);
  }

  useEffect(() => {
    if (sessionLoading) return undefined;

    let cancelled = false;
    let timer: number | undefined;
    let unsubscribe: (() => void) | undefined;

    const routeAuthenticatedUser = async (userId: string, intent: OAuthIntent | null) => {
      if (intent === "signup") {
        const { data: authData } = await supabase.auth.getUser();
        try {
          await confirmReservedRegistration(userId, authData.user?.email ?? null);
        } catch (error) {
          await supabase.auth.signOut({ scope: "local" });
          throw error;
        }
      }
      const destination = intent === "signup" ? "/onboarding" : await customerDestination(userId);
      sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
      cleanOAuthReturnUrl();
      if (!cancelled) await navigate({ to: destination, replace: true });
    };

    if (user) {
      setPreparingCustomerLogin(true);
      const oauthIntent = sessionStorage.getItem(CUSTOMER_OAUTH_INTENT) as OAuthIntent | null;
      void routeAuthenticatedUser(user.id, oauthIntent).catch((error) => {
        if (cancelled) return;
        sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
        setPreparingCustomerLogin(false);
        toast.error(error instanceof Error ? error.message : "Sua conta foi autenticada, mas não foi possível abrir o painel. Tente novamente.");
      });
      return () => {
        cancelled = true;
      };
    }

    const oauthIntent = sessionStorage.getItem(CUSTOMER_OAUTH_INTENT) as OAuthIntent | null;
    if (!oauthIntent) {
      setPreparingCustomerLogin(false);
      return undefined;
    }

    setPreparingCustomerLogin(true);

    const completeGoogleReturn = async () => {
      try {
        const values = readOAuthReturn();
        if (values.error) throw new Error(values.errorDescription || values.error);

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

        if (session?.user) {
          await routeAuthenticatedUser(session.user.id, oauthIntent);
          return;
        }

        // Em alguns navegadores móveis a gravação do broker chega logo depois da
        // montagem da rota. Escutamos o evento real do Supabase e fazemos uma
        // última leitura antes de desistir, sem iniciar outro OAuth e sem criar loop.
        const authSubscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (!nextSession?.user || cancelled) return;
          unsubscribe?.();
          if (timer) window.clearTimeout(timer);
          void routeAuthenticatedUser(nextSession.user.id, oauthIntent);
        });
        unsubscribe = () => authSubscription.data.subscription.unsubscribe();

        timer = window.setTimeout(async () => {
          if (cancelled) return;
          unsubscribe?.();
          const latest = await supabase.auth.getSession();
          if (latest.data.session?.user) {
            await routeAuthenticatedUser(latest.data.session.user.id, oauthIntent);
            return;
          }

          sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
          cleanOAuthReturnUrl();
          if (!cancelled) {
            setPreparingCustomerLogin(false);
            toast.error("O Google autorizou sua conta, mas a sessão não chegou ao navegador. Tente novamente.");
          }
        }, 8000);
      } catch (error) {
        sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
        cleanOAuthReturnUrl();
        if (!cancelled) {
          setPreparingCustomerLogin(false);
          toast.error("Não foi possível concluir o login com o Google", {
            description: error instanceof Error ? error.message : "Falha ao restaurar a sessão.",
          });
        }
      }
    };

    void completeGoogleReturn();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, [sessionLoading, user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        if (password !== confirm) {
          toast.error("As senhas não conferem.");
          return;
        }
        if (!terms) {
          toast.error("É necessário aceitar os Termos de Uso e a Política de Privacidade.");
          return;
        }
        const reservationToken = await reserveRegistration(email);
        const referral = ref?.trim().toUpperCase() || undefined;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, ...(referral ? { referral_code: referral } : {}) },
            emailRedirectTo: `${window.location.origin}/onboarding`,
          },
        });
        if (error) {
          sessionStorage.removeItem(REGISTRATION_RESERVATION);
          throw error;
        }
        if (!data.user) {
          sessionStorage.removeItem(REGISTRATION_RESERVATION);
          throw new Error("A conta não retornou um identificador válido.");
        }
        const guard = await confirmRegistration({ data: { reservationToken, userId: data.user.id } });
        if (!guard.ok) throw new Error("A conta foi criada, mas a proteção do cadastro não pôde ser concluída. Fale com o suporte antes de criar outra conta.");
        sessionStorage.removeItem(REGISTRATION_RESERVATION);
        if (!data.session) {
          toast.success(referral ? "Conta criada com indicação registrada. Confira seu e-mail para confirmar." : "Conta criada. Confira seu e-mail para confirmar e continuar.");
          setIsSignup(false);
          return;
        }
        void navigate({ to: "/onboarding", replace: true });
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Não foi possível concluir o acesso.");
      const destination = await customerDestination(data.user.id);
      void navigate({ to: destination, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (isSignup && !terms) {
      toast.error("Aceite os Termos de Uso e a Política de Privacidade antes de criar sua conta.");
      return;
    }

    setGoogleLoading(true);
    const oauthIntent: OAuthIntent = isSignup ? "signup" : "login";

    try {
      sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
      sessionStorage.removeItem(REGISTRATION_RESERVATION);
      sessionStorage.setItem(CUSTOMER_OAUTH_INTENT, oauthIntent);
      if (ref) sessionStorage.setItem("anuncioml_referral", ref.toUpperCase());

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });

      if (result.error) throw result.error;
      if (result.redirected) return;

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const googleUser = data.session?.user;
      if (!googleUser) throw new Error("O Google autorizou, mas a sessão não foi criada.");

      await routeGoogleUser(googleUser.id, googleUser.email ?? null, oauthIntent);
    } catch (error) {
      sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
      const message = error instanceof Error ? error.message : "Não foi possível entrar com o Google.";
      const normalized = message.toLowerCase();
      if (normalized.includes("cancel") || normalized.includes("denied") || normalized.includes("access_denied") || normalized.includes("abort")) {
        toast.info("Login cancelado", { description: "Você pode tentar novamente quando quiser." });
      } else {
        toast.error("Não foi possível entrar com o Google", { description: message });
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function routeGoogleUser(userId: string, googleEmail: string | null, oauthIntent: OAuthIntent) {
    if (oauthIntent === "signup") {
      try {
        await confirmReservedRegistration(userId, googleEmail);
      } catch (error) {
        await supabase.auth.signOut({ scope: "local" });
        throw error;
      }
    }
    const destination = oauthIntent === "signup" ? "/onboarding" : await customerDestination(userId);
    sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
    void navigate({ to: destination, replace: true });
  }

  async function handleReset() {
    if (!email) {
      toast.error("Informe seu e-mail para receber o link.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de recuperação para o seu e-mail.");
  }

  if (sessionLoading || preparingCustomerLogin) return <SessionSplash />;

  return (
    <div className="grid-noise flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center"><Logo /><p className="text-xs text-muted-foreground">{SLOGAN}</p></div>
        <Card className="glass-panel p-6">
          <h1 className="font-display text-xl font-extrabold">{isSignup ? "Criar minha conta" : "Entrar"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{isSignup ? (ref ? "Você foi indicado. Crie sua conta e comece com 10 anúncios gratuitos." : "Ganhe 10 anúncios gratuitos para testar.") : "Acesse seu painel de cliente."}</p>
          {ref && isSignup && <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs"><span className="text-muted-foreground">Código de indicação: </span><strong className="font-mono text-primary">{ref.toUpperCase()}</strong></div>}
          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            {isSignup && <div className="space-y-1.5"><Label htmlFor="name">Nome</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>}
            <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label htmlFor="password">Senha</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            {isSignup && <><div className="space-y-1.5"><Label htmlFor="confirm">Confirmação de senha</Label><Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div><label className="flex items-start gap-2 text-xs text-muted-foreground"><Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" /><span>Aceito os <Link to="/termos" className="font-semibold text-primary hover:underline" target="_blank">Termos de Uso</Link> e a <Link to="/privacidade" className="font-semibold text-primary hover:underline" target="_blank">Política de Privacidade</Link> do ANÚNCIO ML.</span></label></>}
            <Button type="submit" className="w-full font-semibold" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isSignup ? "Criar conta" : "Entrar"}</Button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={googleLoading}>{googleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continuar com Google</Button>
          <div className="mt-5 space-y-2 text-center text-xs text-muted-foreground">
            {!isSignup && <button type="button" onClick={handleReset} className="hover:text-foreground">Esqueci minha senha</button>}
            <p>{isSignup ? "Já tem conta?" : "Não tenho conta."} <button type="button" onClick={() => setIsSignup((v) => !v)} className="font-semibold text-primary">{isSignup ? "Entrar" : "Criar conta"}</button></p>
            <p><Link to="/" className="hover:text-foreground">Voltar para o site</Link></p>
          </div>
        </Card>
      </div>
    </div>
  );
}
