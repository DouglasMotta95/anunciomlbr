import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, HeartPulse, Lightbulb, Link2, Loader2, Search, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import {
  disconnectMercadoLivre,
  getMlConnection,
  syncMlListings,
} from "@/lib/ml.functions";
import { openMercadoLivreOAuthStart } from "@/lib/ml-oauth-client";
import type { MlSyncResult } from "@/lib/ml.server";

const title = "Conectar Mercado Livre — ANÚNCIO ML";
const description =
  "Conecte sua conta do Mercado Livre com autorização oficial para publicar anúncios direto da plataforma.";

type MlConnectionView = {
  connected?: boolean;
  nickname?: string | null;
  last_sync_at?: string | null;
  listings_count?: number | null;
};

type OnboardingDestination = "/dashboard" | "/buscar" | "/oportunidades" | "/precificacao" | "/saude-anuncios";

const goals = [
  { id: "copy", title: "Buscar e copiar anúncios", text: "Encontrar referências e começar um rascunho.", icon: Search, destination: "/buscar" as const },
  { id: "improve", title: "Melhorar meus anúncios", text: "Encontrar pontos de melhoria com o Raio-X.", icon: HeartPulse, destination: "/saude-anuncios" as const },
  { id: "profit", title: "Entender preço e margem", text: "Simular preço antes de tomar uma decisão.", icon: TrendingUp, destination: "/precificacao" as const },
  { id: "priorities", title: "Descobrir o que fazer primeiro", text: "Abrir a Central de Oportunidades e priorizar ações.", icon: Lightbulb, destination: "/oportunidades" as const },
] as const;

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
  const { user } = useAuth();
  const [selectedGoal, setSelectedGoal] = useState<(typeof goals)[number]["id"]>("copy");
  const fetchConnection = useServerFn(getMlConnection);

  const { data, isLoading } = useQuery({
    queryKey: ["ml-connection-state"],
    queryFn: () => fetchConnection(),
  });

  const connection =
    data?.connection && typeof data.connection === "object" && !Array.isArray(data.connection)
      ? (data.connection as MlConnectionView)
      : null;

  const runSync = useServerFn(syncMlListings);
  const runDisconnect = useServerFn(disconnectMercadoLivre);

  const sync = useMutation({
    mutationFn: () => runSync(),
    onSuccess: (rawResult) => {
      const result = rawResult as unknown as MlSyncResult;
      if (result.ok) {
        toast.success(
          `Sincronizado: ${result.imported} novos, ${result.updated} atualizados (${result.total} anúncios).`,
        );
      } else {
        toast.error("Não foi possível sincronizar", { description: result.reason });
      }
      void queryClient.invalidateQueries({ queryKey: ["ml-connection-state"] });
    },
    onError: () => toast.error("Falha na sincronização."),
  });

  const disconnect = useMutation({
    mutationFn: () => runDisconnect(),
    onSuccess: () => {
      toast.success("Conta desconectada.");
      void queryClient.invalidateQueries({ queryKey: ["ml-connection-state"] });
    },
    onError: () => toast.error("Falha ao desconectar."),
  });

  const finish = useMutation({
    mutationFn: async (destination: OnboardingDestination) => {
      if (!user?.id) throw new Error("Sua sessão ainda está sendo restaurada. Tente novamente.");
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_done: true })
        .eq("id", user.id);
      if (error) throw error;
      return destination;
    },
    onSuccess: (destination) => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void navigate({ to: destination, replace: true });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a configuração."),
  });

  const connected = !!connection?.connected;
  const finishing = finish.isPending || !user?.id;
  const goal = goals.find((item) => item.id === selectedGoal) ?? goals[0];

  return (
    <AppShell
      title="Vamos configurar sua conta"
      description="Conecte o Mercado Livre e escolha o que você quer fazer primeiro."
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
                  {connection?.nickname ?? "Conta conectada"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Última sincronização: {formatDateTime(connection?.last_sync_at)} ·{" "}
                  {connection?.listings_count ?? 0} anúncios
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
              <Button onClick={openMercadoLivreOAuthStart}>
                <Link2 className="mr-2 h-4 w-4" />
                Conectar com Mercado Livre
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

      <Card className="mt-4 overflow-hidden">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">2. O que você quer fazer primeiro?</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Vamos abrir o sistema já no ponto mais útil para o seu objetivo.</p>
            </div>
            <Badge variant="outline"><Sparkles className="mr-1 h-3.5 w-3.5" />Experiência personalizada</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {goals.map((item) => {
              const Icon = item.icon;
              const selected = selectedGoal === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedGoal(item.id)}
                  className={`group rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${selected ? "border-primary/50 bg-primary/[.06] shadow-sm" : "border-border/70 bg-background"}`}
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></span>
                  <p className="mt-4 text-sm font-black">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-primary">{selected ? <CheckCircle2 className="h-4 w-4" /> : null}{selected ? "Selecionado" : "Escolher"}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 border-primary/15 bg-primary/[.03]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.12em] text-primary">3. Entrar no ANÚNCIO ML</p>
            <p className="mt-1 font-semibold">Seu primeiro destino: {goal.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">Você pode acessar todos os outros módulos pelo menu a qualquer momento.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => finish.mutate(goal.destination)} disabled={finishing}>
              {finish.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Começar agora
            </Button>
            <Button variant="ghost" onClick={() => finish.mutate("/dashboard")} disabled={finishing}>
              Ir para visão geral
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
