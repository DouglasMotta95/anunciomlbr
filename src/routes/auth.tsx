import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

const searchSchema = z.object({ mode: z.enum(["login", "signup"]).optional(), ref: z.string().trim().min(3).max(32).optional() });
const title = "Entrar ou criar conta — ANÚNCIO ML";
const description = "Acesse sua conta ANÚNCIO ML ou crie a sua em segundos e ganhe 10 anúncios gratuitos para testar a plataforma.";
const CUSTOMER_OAUTH_INTENT = "anuncioml_customer_oauth_intent";

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, ref } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useAuth();
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

  useEffect(() => {
    if (sessionLoading) return;

    if (!user) {
      setPreparingCustomerLogin(false);
      return;
    }

    setPreparingCustomerLogin(true);
    void customerDestination(user.id)
      .then((destination) => navigate({ to: destination, replace: true }))
      .catch(() => {
        setPreparingCustomerLogin(false);
        toast.error("Sua conta foi autenticada, mas não foi possível abrir o painel. Tente novamente.");
      });
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
        const referral = ref?.trim().toUpperCase() || undefined;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name, ...(referral ? { referral_code: referral } : {}) },
            emailRedirectTo: `${window.location.origin}/onboarding`,
          },
        });
        if (error) throw error;
        if (!data.session || !data.user) {
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
    const oauthIntent: "login" | "signup" = isSignup ? "signup" : "login";
    const callbackUrl = `${window.location.origin}/auth/callback`;

    try {
      await supabase.auth.signOut({ scope: "local" });
      sessionStorage.setItem(CUSTOMER_OAUTH_INTENT, oauthIntent);
      if (ref) sessionStorage.setItem("anuncioml_referral", ref.toUpperCase());

      // Fonte principal: OAuth do próprio Supabase. Com PKCE, o Google retorna
      // um code para /auth/callback e o callback troca esse code pela sessão.
      const native = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: { prompt: "select_account" },
        },
      });

      if (!native.error) return;

      // Compatibilidade com projetos Lovable antigos que ainda dependem do broker.
      // Só entra aqui se o provedor Google nativo não estiver configurado.
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: callbackUrl });
      if (result.error) throw result.error;
      if (result.redirected) return;

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const googleUser = data.session?.user;
      if (!googleUser) throw new Error("O Google autorizou, mas a sessão não foi criada.");

      sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
      const destination = oauthIntent === "signup" ? "/onboarding" : await customerDestination(googleUser.id);
      void navigate({ to: destination, replace: true });
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
