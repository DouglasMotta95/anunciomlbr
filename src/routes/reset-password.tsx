import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const title = "Redefinir senha — ANÚNCIO ML";
const description = "Defina uma nova senha para a sua conta ANÚNCIO ML.";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        settled = true;
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setReady(true);
      }
    });
    const timeout = setTimeout(() => {
      if (!settled) setInvalidLink(true);
    }, 6000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível atualizar a senha. Solicite um novo link.");
      return;
    }
    toast.success("Senha atualizada com sucesso!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound className="h-4 w-4 text-primary" /> Redefinição de senha
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            {invalidLink ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Este link é inválido ou já expirou. Solicite uma nova redefinição de senha.
                </p>
                <Button asChild className="w-full">
                  <Link to="/auth">Voltar para o acesso</Link>
                </Button>
              </div>
            ) : !ready ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Validando seu link...
              </div>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar nova senha
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Após salvar, você entra automaticamente na plataforma.
        </p>
      </div>
    </div>
  );
}
