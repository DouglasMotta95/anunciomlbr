import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
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
const AUTHORIZED_ADMIN_EMAIL = "siteprimebr@gmail.com";

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
  const [email, setEmail] = useState(AUTHORIZED_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error("Credenciais inválidas");
      return;
    }
    const { isAdmin } = await checkAdmin();
    setLoading(false);
    if (!isAdmin) {
      await supabase.auth.signOut();
      toast.error("Esta conta não possui acesso administrativo");
      navigate({ to: "/dashboard" });
      return;
    }
    navigate({ to: "/admin" });
  };

  const requestAdminAccess = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Informe o e-mail administrativo.");
      return;
    }
    if (normalizedEmail !== AUTHORIZED_ADMIN_EMAIL) {
      toast.error("Este e-mail não está autorizado para o painel administrativo.");
      return;
    }

    setResetting(true);
    try {
      const provision = await provisionAdmin({ data: { email: normalizedEmail } });

      if (provision.ok) {
        toast.success("Acesso administrativo criado.", {
          description: "Enviamos um e-mail para você definir sua senha.",
        });
        return;
      }

      if (provision.reason === "already_provisioned") {
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo,
        });
        if (error) throw error;
        toast.success("E-mail enviado.", {
          description: "Abra a mensagem recebida para criar ou redefinir sua senha administrativa.",
        });
        return;
      }

      toast.error("Não foi possível liberar o acesso administrativo.");
    } catch (error) {
      console.error("Admin password/reset request failed", error);
      toast.error("Não foi possível enviar o e-mail agora. Tente novamente.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Acesso administrativo
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="admin-email">E-mail</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Senha</Label>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || resetting}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading || resetting}
                onClick={requestAdminAccess}
              >
                {resetting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Criar / redefinir senha administrativa
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Todas as ações administrativas são registradas e validadas no servidor.
        </p>
      </div>
    </div>
  );
}
