import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/roles.functions";
import { provisionAdminAccount } from "@/lib/setup.functions";

const title = "Acesso administrativo — ANÚNCIO ML";
const description = "Área restrita para administradores da plataforma ANÚNCIO ML.";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(checkIsAdmin);
  const provisionAdmin = useServerFn(provisionAdminAccount);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // A entrada administrativa sempre começa com uma sessão limpa. Isso impede
  // que uma sessão do painel de vendedor seja reaproveitada silenciosamente no admin.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) await supabase.auth.signOut();
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        toast.error("Credenciais inválidas");
        return;
      }

      const { isAdmin } = await checkAdmin();
      if (!isAdmin) {
        await supabase.auth.signOut();
        toast.error("Esta conta não possui acesso administrativo");
        return;
      }

      navigate({ to: "/admin", replace: true });
    } catch {
      await supabase.auth.signOut();
      toast.error("Não foi possível validar o acesso administrativo.");
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Informe seu e-mail.");
      return;
    }

    setResetting(true);
    try {
      await provisionAdmin({ data: { email: normalizedEmail } });
      toast.success("Se o e-mail possuir acesso administrativo, você receberá as instruções para criar uma nova senha.");
    } catch (error) {
      console.error("Admin password/reset request failed", error);
      toast.error("Não foi possível processar a solicitação agora. Tente novamente.");
    } finally {
      setResetting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparando acesso administrativo...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Acesso administrativo separado
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="admin-email">E-mail administrativo</Label>
                <Input id="admin-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Digite seu e-mail" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Senha</Label>
                <Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading || resetting}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar no painel
              </Button>
              <Button type="button" variant="ghost" className="w-full" disabled={loading || resetting} onClick={requestPasswordReset}>
                {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} Esqueci minha senha
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs leading-5 text-muted-foreground">
          Este acesso não reutiliza a sessão do painel de vendedor. Apenas contas com função administrativa conseguem entrar.
        </p>
      </div>
    </div>
  );
}
