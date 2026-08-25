import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, CreditCard, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { getIntegrationsStatus, type IntegrationStatus } from "@/lib/integrations.functions";
import {
  disconnectMercadoLivre,
  getMlAuthorizationUrl,
  syncMlListings,
} from "@/lib/ml.functions";

const title = "Central de Integrações — ANÚNCIO ML";
const description = "Status das integrações com Mercado Livre, Mercado Pago, Google e ANÚNCIO AI.";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntegrationsPage,
});

function StatusBadge({ status }: { status: IntegrationStatus }) {
  if (status === "connected") return <Badge className="bg-emerald-500/15 text-emerald-600">🟢 Conectado</Badge>;
  if (status === "error") return <Badge variant="destructive">🔴 Erro</Badge>;
  return <Badge variant="outline">🟡 Configuração pendente</Badge>;
}

function IntegrationsPage() {
  const queryClient = useQueryClient();
  const getStatus = useServerFn(getIntegrationsStatus);
  const getAuthUrl = useServerFn(getMlAuthorizationUrl);
  const sync = useServerFn(syncMlListings);
  const disconnect = useServerFn(disconnectMercadoLivre);

  const { data, isLoading } = useQuery({
    queryKey: ["integrations-status"],
    queryFn: () => getStatus(),
  });

  const connectMl = useMutation({
    mutationFn: () => getAuthUrl(),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
      else toast.info("Configuração pendente", { description: "Credenciais do Mercado Livre não configuradas." });
    },
    onError: () => toast.error("Falha ao iniciar conexão."),
  });

  const syncMl = useMutation({
    mutationFn: () => sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations-status"] });
      toast.success("Sincronização concluída");
    },
    onError: () => toast.error("Falha ao sincronizar anúncios."),
  });

  const disconnectMl = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations-status"] });
      toast.success("Conta desconectada");
    },
    onError: () => toast.error("Falha ao desconectar."),
  });

  if (isLoading) {
    return (
      <AppShell title="Central de Integrações">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Central de Integrações" description="Status real de cada integração da plataforma.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4 text-primary" /> Mercado Livre
            </CardTitle>
            <StatusBadge status={data!.mercadoLivre.status} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {!data!.mercadoLivre.hasMlCredentials && <p>Configuração pendente: defina ML_CLIENT_ID e ML_REDIRECT_URI.</p>}
            {data!.mercadoLivre.connected && (
              <p>Última sincronização: {formatDateTime(data!.mercadoLivre.lastSyncAt)}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {!data!.mercadoLivre.connected ? (
                <Button size="sm" disabled={connectMl.isPending} onClick={() => connectMl.mutate()}>
                  {connectMl.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Conectar
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" disabled={syncMl.isPending} onClick={() => syncMl.mutate()}>
                    {syncMl.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Sincronizar
                  </Button>
                  <Button size="sm" variant="ghost" disabled={disconnectMl.isPending} onClick={() => disconnectMl.mutate()}>
                    Desconectar
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" /> Mercado Pago
            </CardTitle>
            <StatusBadge status={data!.mercadoPago.status} />
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {!data!.mercadoPago.hasMercadoPagoToken ? (
              <p>Configuração pendente: defina MERCADOPAGO_ACCESS_TOKEN nas variáveis do servidor.</p>
            ) : (
              <p>Checkout e webhook de pagamentos operando com as credenciais configuradas.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Google</CardTitle>
            <StatusBadge status={data!.google.status} />
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Login com Google ainda não foi habilitado nesta instalação.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" /> ANÚNCIO AI
            </CardTitle>
            <StatusBadge status={data!.anuncioAi.status} />
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data!.anuncioAi.aiConfigured ? (
              <p>Geração de anúncios com IA disponível.</p>
            ) : (
              <p>Configuração pendente: nenhuma chave de IA configurada no servidor.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
