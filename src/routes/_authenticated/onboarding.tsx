import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Link2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/hooks/useAuth";
import {
  disconnectMercadoLivre,
  getMlConnection,
  syncMlListings,
} from "@/lib/ml.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";

const title = "Conectar Mercado Livre — ANÚNCIO ML";
const description =
  "Conecte sua conta do Mercado Livre com autorização oficial para publicar anúncios direto da plataforma.";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const fetchConnection = useServerFn(getMlConnection);

  const { data, isLoading } = useQuery({
    queryKey: ["ml-connection-state"],
    queryFn: () => fetchConnection(),
  });

  const runSync = useServerFn(syncMlListings);
  const runDisconnect = useServerFn(disconnectMercadoLivre);

  const sync = useMutation({
    mutationFn: () => runSync(),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(
          `Sincronizado: ${result.imported} novos, ${result.updated} atualizados (${result.total} anúncios).`,
        );
      } else {
        toast.error("Não foi possível sincronizar", { description: result.reason });
      }
      queryClient.invalidateQueries({ queryKey: ["ml-connection-state"] });
    },
    onError: () => toast.error("Falha na sincronização."),
  });

  const disconnect = useMutation({
    mutationFn: () => runDisconnect(),
    onSuccess: () => {
      toast.success("Conta desconectada.");
      queryClient.invalidateQueries({ queryKey: ["ml-connection-state"] });
    },
    onError: () => toast.error("Falha ao desconectar."),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_done: true })
        .eq("id", profile!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      navigate({ to: "/dashboard" });
    },
  });

  const connected = !!data?.connection?.connected;

  return (
    <AppShell
      title="Vamos configurar sua conta"
      description="Três passos rápidos para começar a copiar e otimizar anúncios."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">1. Integração com o Mercado Livre</CardTitle>
            {connected ? <Badge>Conectado</Badge> : <Badge variant="outline">Pendente</Badge>}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A conexão usa o fluxo oficial de autorização do Mercado Livre. Nós nunca pedimos sua
              senha e os tokens ficam guardados em área restrita do servidor.
            </p>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : connected ? (
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {data?.connection?.nickname ?? "Conta conectada"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Última sincronização: {formatDateTime(data?.connection?.last_sync_at)} ·{" "}
                  {data?.connection?.listings_count ?? 0} anúncios
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
                    {sync.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sincronizar anúncios
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => disconnect.mutate()}
                    disabled={disconnect.isPending}
                  >
                    Desconectar
                  </Button>
                </div>
              </div>
            ) : (
              <Button asChild>
                <a href="/ml-start" target="_top">
                  <Link2 className="mr-2 h-4 w-4" />
                  Conectar com Mercado Livre
                </a>
              </Button>
            )}
            {data && !data.configured && (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                Configuração pendente: as credenciais da aplicação oficial do Mercado Livre precisam
                ser cadastradas antes da primeira conexão real.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segurança</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Tokens armazenados em tabela restrita, sem acesso pelo navegador.
            </div>
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Você pode revogar a autorização a qualquer momento na sua conta do Mercado Livre.
            </div>
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Nenhum anúncio é publicado sem sua confirmação.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">2. Comece a usar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => finish.mutate()} disabled={finish.isPending}>
            {finish.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ir para o dashboard
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/buscar" })}>
            Buscar meu primeiro anúncio
          </Button>
          <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>
            Fazer depois
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
