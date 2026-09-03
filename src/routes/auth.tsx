import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Logo, SLOGAN } from "@/components/brand";
import { AuthProductPreview } from "@/components/auth/AuthProductPreview";
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
    <div className="grid-noise relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute left-1/2 top-[-14rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1380px] gap-6 lg:grid-cols-[1.08fr_.92fr] lg:items-stretch xl:gap-8">
        <AuthProductPreview />

        <section className="flex min-h-[680px] items-center justify-center">
          <div className="w-full max-w-[500px] animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="mb-6 flex items-center justify-between gap-4">
              <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="size-3.5" /> Voltar ao site
              </Link>
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground backdrop-blur">
                <ShieldCheck className="size-3.5 text-success" /> Ambiente protegido
              </div>
            </div>

            <div className="mb-7 lg:hidden">
              <Logo />
              <p className="mt-2 text-xs text-muted-foreground">{SLOGAN}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {["Buscar", "Otimizar", "Publicar"].map((label, index) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-card/70 p-3 text-center">
                    <Sparkles className={index === 1 ? "mx-auto size-4 text-primary" : "mx-auto size-4 text-muted-foreground"} />
                    <p className="mt-2 text-[10px] font-bold">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <Card className="glass-panel overflow-hidden border-border/70 p-0 shadow-2xl">
              <div className="border-b border-border/60 bg-background/35 px-6 py-5 sm:px-7">
                <div className="hidden lg:block"><Logo /></div>
                <div className="mt-4 flex items-start justify-between gap-4 lg:mt-6">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">{isSignup ? "COMECE AGORA" : "BEM-VINDO DE VOLTA"}</p>
                    <h1 className="mt-2 font-display text-2xl font-black sm:text-3xl">{isSignup ? "Crie sua conta" : "Entre no seu painel"}</h1>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                      {isSignup
                        ? (ref ? "Sua indicação está registrada. Crie a conta e conheça o fluxo da plataforma." : "Crie a conta, conecte o Mercado Livre e teste o fluxo com 10 anúncios.")
                        : "Acesse sua operação, anúncios, inteligência e ferramentas em um único lugar."}
                    </p>
                  </div>
                  <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
                    <LockKeyhole className="size-5" />
                  </span>
                </div>
              </div>

              <div className="p-6 sm:p-7">
                {ref && isSignup && (
                  <div className="mb-4 rounded-xl border border-primary/20 bg-primary/[.06] p-3 text-xs">
                    <span className="text-muted-foreground">Código de indicação: </span>
                    <strong className="font-mono text-primary">{ref.toUpperCase()}</strong>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {isSignup && <div className="space-y-1.5"><Label htmlFor="name">Nome</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="h-11" /></div>}
                  <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" /></div>
                  <div className="space-y-1.5"><Label htmlFor="password">Senha</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" /></div>
                  {isSignup && <><div className="space-y-1.5"><Label htmlFor="confirm">Confirmação de senha</Label><Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="h-11" /></div><label className="flex items-start gap-2 rounded-xl border border-border/50 bg-background/35 p-3 text-xs text-muted-foreground"><Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" /><span>Aceito os <Link to="/termos" className="font-semibold text-primary hover:underline" target="_blank">Termos de Uso</Link> e a <Link to="/privacidade" className="font-semibold text-primary hover:underline" target="_blank">Política de Privacidade</Link> do ANÚNCIO ML.</span></label></>}
                  <Button type="submit" size="lg" className="w-full font-bold shadow-glow" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isSignup ? "Criar conta e começar" : "Entrar no painel"}</Button>
                </form>

                <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div>
                <Button variant="outline" size="lg" className="w-full" onClick={handleGoogle} disabled={googleLoading}>{googleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continuar com Google</Button>

                <div className="mt-6 space-y-3 text-center text-xs text-muted-foreground">
                  {!isSignup && <button type="button" onClick={handleReset} className="font-medium transition-colors hover:text-foreground">Esqueci minha senha</button>}
                  <p>{isSignup ? "Já tem conta?" : "Ainda não tem conta?"} <button type="button" onClick={() => setIsSignup((v) => !v)} className="font-bold text-primary transition hover:text-primary/80">{isSignup ? "Entrar" : "Criar conta grátis"}</button></p>
                </div>
              </div>
            </Card>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-success" /> Autenticação protegida</span>
              <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5 text-primary" /> 10 anúncios para testar</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
