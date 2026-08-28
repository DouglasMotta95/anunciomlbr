import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Link2,
  Loader2,
  RefreshCcw,
  ShoppingBag,
  Sparkles,
  Unlink,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { getAiRuntimeHealth } from "@/lib/ai-diagnostics.functions";
import { getMercadoLivreCapabilityHealth } from "@/lib/integration-diagnostics.functions";
import { disconnectMercadoLivre, getMlConnection, syncMlListings } from "@/lib/ml.functions";
import { openMercadoLivreOAuthStart } from "@/lib/ml-oauth-client";

export const Route = createFileRoute("/_authenticated/integracoes")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { ml?: string; sync?: string } = {};
    if (typeof search.ml === "string") out.ml = search.ml;
    if (typeof search.sync === "string") out.sync = search.sync;
    return out;
  },
  head: () => ({ meta: [{ title: "Integrações — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: IntegrationsPage,
});

const ML_RETURN_MESSAGES: Record<string, { type: "success" | "info" | "error"; text: string }> = {
  connected: { type: "success", text: "Mercado Livre conectado com sucesso." },
  cancelled: { type: "info", text: "Conexão cancelada. Nenhuma conta foi vinculada." },
  invalid_callback: { type: "error", text: "Retorno inválido do Mercado Livre. Tente novamente." },
  invalid_state: { type: "error", text: "Sessão de conexão expirada ou inválida. Inicie a conexão novamente." },
  state_error: { type: "error", text: "Não foi possível validar a sessão de conexão." },
  not_configured: { type: "error", text: "Integração indisponível no momento. Fale com o suporte." },
  token_error: { type: "error", text: "O Mercado Livre autorizou, mas a troca do código pelo acesso falhou. Tente reconectar." },
  identity_error: { type: "error", text: "A autorização foi recebida, mas não foi possível identificar a conta do Mercado Livre." },
  persist_error: { type: "error", text: "A autorização foi recebida, mas não foi possível salvar a conexão. Tente novamente." },
  start_error: { type: "error", text: "Não foi possível iniciar a conexão com o Mercado Livre. Tente novamente." },
};

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ok ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
        {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleAlert className="h-4 w-4 text-amber-600" />}
      </div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function IntegrationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ml, sync: syncResult } = Route.useSearch();

  const fetchConnection = useServerFn(getMlConnection);
  const healthFn = useServerFn(getMercadoLivreCapabilityHealth);
  const aiHealthFn = useServerFn(getAiRuntimeHealth);
  const sync = useServerFn(syncMlListings);
  const disconnect = useServerFn(disconnectMercadoLivre);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ml-connection"],
    queryFn: () => fetchConnection(),
    refetchOnWindowFocus: true,
  });
  const { data: health, refetch: refetchHealth } = useQuery({
    queryKey: ["ml-capability-health"],
    queryFn: () => healthFn(),
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });
  const { data: aiHealth, isFetching: aiChecking, refetch: refetchAiHealth } = useQuery({
    queryKey: ["ai-runtime-health"],
    queryFn: () => aiHealthFn(),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const onFocus = () => {
      void refetch();
      void refetchHealth();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch, refetchHealth]);

  useEffect(() => {
    if (!ml) return;
    let cancelled = false;
    void (async () => {
      if (ml === "connected") {
        const refreshed = await refetch();
        await refetchHealth();
        if (cancelled) return;
        if (refreshed.data?.connection?.connected) {
          toast.success("Mercado Livre conectado com sucesso.", {
            description: syncResult && syncResult !== "ok"
              ? `Conta conectada. Sincronização inicial: ${syncResult}.`
              : "Autorização concluída. Sua conta já está pronta.",
          });
        } else {
          toast.error("A autorização retornou, mas a conta ainda não apareceu conectada.");
        }
      } else {
        const message = ML_RETURN_MESSAGES[ml];
        if (message) toast[message.type](message.text);
      }
      if (!cancelled) navigate({ to: "/integracoes", replace: true, search: {} });
    })();
    return () => { cancelled = true; };
  }, [ml, syncResult, navigate, refetch, refetchHealth]);

  const syncMl = useMutation({
    mutationFn: () => sync(),
    onSuccess: (result) => {
      if (result.ok) toast.success(`Sincronizado: ${result.imported} novos, ${result.updated} atualizados (${result.total} anúncios).`);
      else toast.error("Não foi possível sincronizar.", { description: result.reason });
      void queryClient.refetchQueries({ queryKey: ["ml-connection"] });
      void queryClient.refetchQueries({ queryKey: ["ml-capability-health"] });
    },
    onError: () => toast.error("Falha ao sincronizar anúncios."),
  });

  const disconnectMl = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      void queryClient.refetchQueries({ queryKey: ["ml-connection"] });
      void queryClient.refetchQueries({ queryKey: ["ml-capability-health"] });
      toast.success("Conta do Mercado Livre desconectada.");
    },
    onError: () => toast.error("Falha ao desconectar."),
  });

  const connection = data?.connection ?? null;
  const connected = !!connection?.connected;
  const diagnostics = data?.diagnostics;

  if (isLoading) return <AppShell title="Integrações"><Skeleton className="h-56 w-full max-w-2xl" /></AppShell>;

  const salesOk = health?.sales === "ok";
  const salesPermission = health?.sales === "permission";
  const searchOk = health?.search === "ok";
  const tokenOk = health?.token === "ok";
  const aiOk = !!aiHealth?.responding;
  const providerLabel = aiHealth?.provider === "gemini" ? "Google Gemini" : aiHealth?.provider === "lovable" ? "Lovable AI Gateway" : "Nenhum";

  const refreshAll = () => {
    void refetch();
    void refetchHealth();
    void refetchAiHealth();
  };

  return (
    <AppShell
      title="Integrações"
      description="Diagnóstico real das conexões externas e da IA usadas pelo ANÚNCIO ML."
    >
      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base"><ShoppingBag className="h-4 w-4 text-primary" /> Mercado Livre</CardTitle>
            {connected ? <Badge className="bg-emerald-500/15 text-emerald-600">Conectado</Badge> : <Badge variant="destructive">Não conectado</Badge>}
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {connected ? (
              <>
                <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4 text-sm sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Conta</p><strong>@{connection?.nickname ?? "vendedor"}</strong></div>
                  <div><p className="text-xs text-muted-foreground">Anúncios importados</p><strong>{typeof connection?.listings_count === "number" ? connection.listings_count : 0}</strong></div>
                  <div><p className="text-xs text-muted-foreground">Última sincronização</p><strong className="text-xs">{formatDateTime(connection?.last_sync_at ?? null)}</strong></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => navigate({ to: "/buscar" })}>Buscar anúncios <ArrowRight className="ml-2 h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" disabled={syncMl.isPending} onClick={() => syncMl.mutate()}>
                    {syncMl.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-2 h-3.5 w-3.5" />}
                    Sincronizar anúncios
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={disconnectMl.isPending} onClick={() => disconnectMl.mutate()}>
                    <Unlink className="mr-2 h-3.5 w-3.5" /> Desconectar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm leading-6 text-muted-foreground">Conecte sua conta usando o OAuth oficial. A senha do Mercado Livre nunca é informada ao ANÚNCIO ML.</p>
                {diagnostics && (
                  <div className="rounded-xl border bg-muted/40 p-3 text-xs">
                    <p className="font-semibold">Diagnóstico OAuth</p>
                    <p className="mt-2 text-muted-foreground">Client ID: <span className="font-mono text-foreground">{diagnostics.clientIdMasked ?? "não configurado"}</span></p>
                    <p className="text-muted-foreground">Client Secret: <span className="text-foreground">{diagnostics.hasClientSecret ? "configurado" : "ausente"}</span></p>
                    <p className="break-all text-muted-foreground">Callback: <span className="font-mono text-foreground">{diagnostics.callback}</span></p>
                  </div>
                )}
                <Button size="sm" onClick={openMercadoLivreOAuthStart}><Link2 className="mr-2 h-3.5 w-3.5" /> Conectar Mercado Livre</Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={aiOk ? "border-emerald-500/25" : "border-amber-500/25"}>
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Inteligência artificial</CardTitle>
            <Badge variant={aiOk ? "secondary" : "outline"} className={aiOk ? "bg-emerald-500/15 text-emerald-600" : ""}>
              {aiChecking ? "Verificando" : aiOk ? "Ativa" : aiHealth?.configured ? "Com erro" : "Não configurada"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <Status
              ok={!!aiHealth?.configured}
              label="Configuração do servidor"
              detail={aiHealth?.configured ? `Provedor principal: ${providerLabel}.` : "Nenhuma chave de IA foi encontrada no ambiente do servidor."}
            />
            <Status
              ok={aiOk}
              label="Teste real de resposta"
              detail={aiOk ? `A rota real de IA respondeu corretamente${aiHealth?.latency_ms != null ? ` em ${aiHealth.latency_ms} ms` : ""}.` : aiHealth?.reason ?? "Ainda não foi possível validar uma resposta da IA."}
            />
            <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p><strong className="text-foreground">Modelo:</strong> {aiHealth?.model ?? "não identificado"}</p>
              <p className="mt-1">O teste não exibe a chave e não consome créditos de IA do usuário.</p>
            </div>
            <Button variant="outline" className="w-full" disabled={aiChecking} onClick={() => void refetchAiHealth()}>
              {aiChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Testar IA novamente
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Saúde do Mercado Livre</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          <Status ok={connected} label="Conexão OAuth" detail={connected ? "Conta autorizada e vinculada." : "É necessário conectar a conta."} />
          <Status ok={tokenOk} label="Autorização ativa" detail={tokenOk ? "Token válido para usar recursos autenticados." : "Autorização ausente, expirada ou revogada."} />
          <Status ok={searchOk} label="Busca de anúncios" detail={searchOk ? "A rota de busca está respondendo normalmente." : "A busca está retornando erro neste momento."} />
          <Status ok={salesOk} label="Vendas e envios" detail={salesOk ? "Permissão disponível para consultar pedidos." : salesPermission ? "A conta está conectada, mas a autorização precisa da permissão de Vendas e Envios." : "Não foi possível validar Vendas e Envios agora."} />
          {salesPermission && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs md:col-span-2">
              <p className="font-semibold text-amber-700">Configuração externa pendente</p>
              <p className="mt-1 text-muted-foreground">No DevCenter do Mercado Livre, habilite “Venda e envios de um produto”. Depois reconecte a conta para atualizar a autorização.</p>
            </div>
          )}
          <Button variant="outline" className="md:col-span-2" onClick={refreshAll}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Verificar tudo novamente
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
