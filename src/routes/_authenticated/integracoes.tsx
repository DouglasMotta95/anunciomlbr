import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCircle2, Link2, Loader2, RefreshCcw, ShoppingBag, Unlink } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { disconnectMercadoLivre } from "@/lib/ml.functions";
import { getMercadoLivreConnectionState, syncMercadoLivreCatalog } from "@/lib/ml-sync-fast.functions";
import { openMercadoLivreOAuthStart } from "@/lib/ml-oauth-client";

export const Route = createFileRoute("/_authenticated/integracoes")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { ml?: string; sync?: string } = {};
    if (typeof search["ml"] === "string") out.ml = search["ml"];
    if (typeof search["sync"] === "string") out.sync = search["sync"];
    return out;
  },
  head: () => ({ meta: [{ title: "Integrações — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: IntegrationsPage,
});

const MESSAGES: Record<string, { type: "success" | "info" | "error"; text: string }> = {
  connected: { type: "success", text: "Mercado Livre conectado." },
  cancelled: { type: "info", text: "Conexão cancelada." },
  invalid_callback: { type: "error", text: "O retorno do Mercado Livre não pôde ser validado. Tente novamente." },
  invalid_state: { type: "error", text: "A autorização expirou. Inicie a conexão novamente." },
  state_error: { type: "error", text: "Não foi possível validar a conexão." },
  not_configured: { type: "error", text: "A integração está indisponível no momento." },
  token_error: { type: "error", text: "A autorização não foi concluída. Reconecte a conta." },
  identity_error: { type: "error", text: "Não foi possível identificar a conta autorizada." },
  already_connected: { type: "error", text: "Esta conta do Mercado Livre já está vinculada a outro acesso do ANÚNCIO ML." },
  persist_error: { type: "error", text: "Não foi possível salvar a conexão." },
  start_error: { type: "error", text: "Não foi possível iniciar a conexão." },
};

function IntegrationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ml, sync: syncResult } = Route.useSearch();
  const fetchConnection = useServerFn(getMercadoLivreConnectionState);
  const sync = useServerFn(syncMercadoLivreCatalog);
  const disconnect = useServerFn(disconnectMercadoLivre);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ml-connection"],
    queryFn: () => fetchConnection(),
    refetchOnWindowFocus: true,
    staleTime: 15000,
  });

  useEffect(() => {
    if (!ml) return;
    let cancelled = false;
    void (async () => {
      if (ml === "connected") {
        const refreshed = await refetch();
        if (cancelled) return;
        if (refreshed.data?.connection?.connected) {
          toast.success("Mercado Livre conectado", {
            description: syncResult && syncResult !== "ok" ? `Conta conectada. Sincronização inicial: ${syncResult}.` : "A conta já pode ser usada no painel.",
          });
        } else {
          toast.error("A autorização não ficou válida. Reconecte a conta.");
        }
      } else {
        const message = MESSAGES[ml];
        if (message) toast[message.type](message.text);
      }
      if (!cancelled) navigate({ to: "/integracoes", replace: true, search: {} });
    })();
    return () => { cancelled = true; };
  }, [ml, syncResult, navigate, refetch]);

  const syncMl = useMutation({
    mutationFn: () => sync(),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Sincronização concluída", { description: `${result.total} anúncios · ${result.imported} novos · ${result.updated} atualizados` });
      } else {
        toast.error("Não foi possível sincronizar", { description: result.reason });
      }
      void queryClient.invalidateQueries({ queryKey: ["ml-connection"] });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({ queryKey: ["seller-growth"] });
    },
    onError: (error) => toast.error("Falha ao sincronizar anúncios", { description: error instanceof Error ? error.message : undefined }),
  });

  const disconnectMl = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ml-connection"] }),
        queryClient.invalidateQueries({ queryKey: ["seller-growth"] }),
      ]);
      toast.success("Conta Mercado Livre desconectada");
    },
    onError: () => toast.error("Não foi possível desconectar."),
  });

  const connection = data?.connection ?? null;
  const connected = connection?.connected === true;

  if (isLoading) {
    return <AppShell title="Integrações" description="Conecte sua conta do Mercado Livre ao painel."><Skeleton className="h-64 w-full max-w-3xl" /></AppShell>;
  }

  return (
    <AppShell title="Integrações" description="Conecte e sincronize sua conta do Mercado Livre.">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><ShoppingBag className="h-4 w-4 text-primary" /></span>
                Mercado Livre
              </CardTitle>
              {connected ? (
                <Badge className="bg-emerald-500/15 text-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Conectado</Badge>
              ) : (
                <Badge variant="outline">Desconectado</Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {connected ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Info label="Conta" value={`@${connection?.nickname ?? "vendedor"}`} />
                  <Info label="Anúncios" value={String(connection?.listings_count ?? 0)} />
                  <Info label="Última sincronização" value={formatDateTime(connection?.last_sync_at ?? null)} />
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={() => navigate({ to: "/buscar" })}>Buscar anúncios<ArrowRight className="ml-2 h-4 w-4" /></Button>
                  <Button variant="outline" disabled={syncMl.isPending} onClick={() => syncMl.mutate()}>
                    {syncMl.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    {syncMl.isPending ? "Sincronizando..." : "Sincronizar"}
                  </Button>
                  <Button variant="ghost" className="text-destructive" disabled={disconnectMl.isPending || syncMl.isPending} onClick={() => disconnectMl.mutate()}>
                    {disconnectMl.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
                    Desconectar
                  </Button>
                </div>

                <p className="mt-5 text-xs leading-5 text-muted-foreground">
                  A sincronização traz seus anúncios para o painel. Anúncios já existentes no Mercado Livre não consomem sua franquia de criação.
                </p>
              </>
            ) : (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Link2 className="h-5 w-5 text-primary" /></div>
                <h3 className="mt-4 text-lg font-semibold">Conectar Mercado Livre</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  A autorização é feita pelo próprio Mercado Livre. Sua senha não passa pelo ANÚNCIO ML.
                </p>
                <Button className="mt-5" onClick={openMercadoLivreOAuthStart}><Link2 className="mr-2 h-4 w-4" />Conectar conta</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/15 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
