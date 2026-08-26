import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Loader2, RefreshCcw, ShoppingBag, Unlink } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import {
  disconnectMercadoLivre,
  getMlConnection,
  syncMlListings,
} from "@/lib/ml.functions";

const title = "Integrações — ANÚNCIO ML";
const description = "Conecte sua conta do Mercado Livre ao ANÚNCIO ML.";

export const Route = createFileRoute("/_authenticated/integracoes")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { ml?: string; sync?: string } = {};
    if (typeof search["ml"] === "string") out.ml = search["ml"];
    if (typeof search["sync"] === "string") out.sync = search["sync"];
    return out;
  },
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

const ML_RETURN_MESSAGES: Record<string, { type: "success" | "info" | "error"; text: string }> = {
  connected: { type: "success", text: "Mercado Livre conectado com sucesso." },
  cancelled: { type: "info", text: "Conexão cancelada. Nenhuma conta foi vinculada." },
  invalid_callback: { type: "error", text: "Retorno inválido do Mercado Livre. Tente novamente." },
  invalid_state: {
    type: "error",
    text: "Sessão de conexão expirada ou inválida. Inicie a conexão novamente.",
  },
  not_configured: { type: "error", text: "Integração indisponível no momento. Fale com o suporte." },
  token_error: {
    type: "error",
    text: "Não foi possível concluir a autorização no Mercado Livre. Tente novamente.",
  },
  start_error: {
    type: "error",
    text: "Não foi possível iniciar a conexão com o Mercado Livre. Tente novamente.",
  },
};

function IntegrationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ml, sync: syncResult } = Route.useSearch();

  const fetchConnection = useServerFn(getMlConnection);
  const sync = useServerFn(syncMlListings);
  const disconnect = useServerFn(disconnectMercadoLivre);

  const { data, isLoading } = useQuery({
    queryKey: ["ml-connection"],
    queryFn: () => fetchConnection(),
  });

  // Feedback do retorno OAuth (?ml=...) e limpeza da URL.
  useEffect(() => {
    if (!ml) return;
    const message = ML_RETURN_MESSAGES[ml];
    if (message) {
      const description =
        ml === "connected" && syncResult && syncResult !== "ok"
          ? `Conectado, mas a sincronização inicial retornou: ${syncResult}. Use “Sincronizar anúncios”.`
          : undefined;
      toast[message.type](message.text, { description });
    }
    if (ml === "connected") {
      queryClient.invalidateQueries({ queryKey: ["ml-connection"] });
    }
    navigate({ to: "/integracoes", replace: true, search: {} });
  }, [ml, syncResult, navigate, queryClient]);

  const syncMl = useMutation({
    mutationFn: () => sync(),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(
          `Sincronizado: ${result.imported} novos, ${result.updated} atualizados (${result.total} anúncios).`,
        );
      } else {
        toast.error("Não foi possível sincronizar.", { description: result.reason });
      }
      queryClient.invalidateQueries({ queryKey: ["ml-connection"] });
    },
    onError: () => toast.error("Falha ao sincronizar anúncios."),
  });

  const disconnectMl = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-connection"] });
      toast.success("Conta do Mercado Livre desconectada.");
    },
    onError: () => toast.error("Falha ao desconectar."),
  });

  const connection = data?.connection ?? null;
  const connected = !!connection?.connected;

  if (isLoading) {
    return (
      <AppShell title="Integrações">
        <Skeleton className="h-56 w-full max-w-2xl" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Integrações"
      description="Conecte sua conta do Mercado Livre para importar e gerenciar seus anúncios."
    >
      <Card className="max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4 text-primary" /> Mercado Livre
          </CardTitle>
          {connected ? (
            <Badge className="bg-emerald-500/15 text-emerald-600">🟢 Conectado</Badge>
          ) : (
            <Badge variant="destructive">🔴 Não conectado</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {connected ? (
            <>
              <div className="space-y-1.5 text-sm">
                <p>
                  <span className="text-muted-foreground">Conta: </span>
                  <span className="font-semibold">
                    @{connection?.nickname ?? "vendedor"}
                  </span>
                </p>
                {connection?.ml_user_id && (
                  <p className="text-muted-foreground">
                    ID do vendedor: <span className="font-medium">{connection.ml_user_id}</span>
                  </p>
                )}
                <p className="text-muted-foreground">
                  Última sincronização: {formatDateTime(connection?.last_sync_at ?? null)}
                </p>
                {typeof connection?.listings_count === "number" && (
                  <p className="text-muted-foreground">
                    Anúncios importados:{" "}
                    <span className="font-medium text-foreground">
                      {connection.listings_count}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={syncMl.isPending}
                  onClick={() => syncMl.mutate()}
                >
                  {syncMl.isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                  )}
                  Sincronizar anúncios
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={disconnectMl.isPending}
                  onClick={() => disconnectMl.mutate()}
                >
                  {disconnectMl.isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="mr-2 h-3.5 w-3.5" />
                  )}
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Conecte sua conta do Mercado Livre com autorização oficial (OAuth) para importar
                seus anúncios, sincronizar estoque e acompanhar vendas direto da plataforma.
              </p>
              <p className="text-xs text-muted-foreground">
                Você será redirecionado ao site oficial do Mercado Livre para autorizar o acesso.
                Nunca pedimos sua senha.
              </p>
              <Button size="sm" className="font-semibold" asChild>
                <a href="/ml-start" target="_top">
                  <Link2 className="mr-2 h-3.5 w-3.5" />
                  Conectar Mercado Livre
                </a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
