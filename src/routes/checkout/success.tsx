import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCheckoutSummary } from "@/lib/checkout.functions";
import { formatBRL, formatDate } from "@/lib/format";
import { trackEventOnce } from "@/lib/track";

const searchSchema = z.object({
  payment_id: z.string().optional(),
  status: z.string().optional(),
});

const title = "Pedido concluído — ANÚNCIO ML";
const description =
  "Resumo do seu pedido no ANÚNCIO ML e os próximos passos para conectar sua conta do Mercado Livre e publicar anúncios.";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutSuccessPage,
});

const PERIOD_LABEL: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "3 meses",
  semiannual: "6 meses",
  annual: "Anual",
};

const steps = [
  {
    icon: Link2,
    title: "Conecte sua conta do Mercado Livre",
    text: "Autorize a integração oficial em Integrações para sincronizar seus anúncios.",
    to: "/integracoes" as const,
    cta: "Conectar agora",
  },
  {
    icon: Sparkles,
    title: "Busque e copie anúncios vencedores",
    text: "Use o radar de produtos para encontrar oportunidades e criar rascunhos em massa.",
    to: "/buscar" as const,
    cta: "Abrir radar",
  },
  {
    icon: KeyRound,
    title: "Veja sua licença e cota de anúncios",
    text: "Acompanhe validade, plano ativo e quantos anúncios ainda pode publicar.",
    to: "/licenca" as const,
    cta: "Ver licença",
  },
];

function CheckoutSuccessPage() {
  const { payment_id: paymentId } = Route.useSearch();
  const summaryFn = useServerFn(getCheckoutSummary);

  const { data, isLoading, error } = useQuery({
    queryKey: ["checkout-summary", paymentId],
    queryFn: () => summaryFn({ data: { payment_id: paymentId! } }),
    enabled: Boolean(paymentId),
    refetchInterval: (query) =>
      query.state.data && query.state.data.status !== "approved" ? 5000 : false,
  });

  const approved = data?.status === "approved";

  useEffect(() => {
    if (!approved || !data) return;
    trackEventOnce(data.id, "purchase", {
      amount_cents: data.amount_cents,
      period: data.period,
    });
  }, [approved, data]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Logo />
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              Ir para o painel <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            {approved ? (
              <CheckCircle2 className="h-7 w-7 text-success" />
            ) : (
              <Clock className="h-7 w-7 text-primary" />
            )}
          </span>
          <h1 className="mt-4 text-balance font-display text-3xl font-extrabold">
            {approved ? "Pagamento aprovado!" : "Pedido registrado!"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {approved
              ? "Sua licença já está ativa. Agora conecte sua conta do Mercado Livre e comece a publicar."
              : "Estamos confirmando seu pagamento com o Mercado Pago. Esta página atualiza automaticamente assim que for aprovado."}
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Próximos passos
            </h2>
            {steps.map((step, index) => (
              <Card key={step.title} className="border-border/60 bg-surface/60 p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {index + 1}. {step.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link to={step.to}>{step.cta}</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="h-fit border-border/60 bg-surface/60 p-5 lg:sticky lg:top-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Resumo do pedido
              </p>
              {data && (
                <Badge variant={approved ? "default" : "secondary"}>
                  {approved ? "Aprovado" : "Processando"}
                </Badge>
              )}
            </div>

            {!paymentId && (
              <p className="mt-4 text-sm text-muted-foreground">
                Não encontramos a referência do pedido. Consulte seus pagamentos na área de licença.
              </p>
            )}
            {paymentId && isLoading && (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-8 w-1/2" />
              </div>
            )}
            {paymentId && error && (
              <p className="mt-4 text-sm text-destructive">
                Não foi possível carregar o resumo deste pedido.
              </p>
            )}

            {data && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-semibold">{data.plan_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Período</span>
                  <span className="font-semibold">
                    {PERIOD_LABEL[data.period] ?? data.period}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Pedido</span>
                  <span className="font-mono text-xs">{data.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Data</span>
                  <span className="font-semibold">{formatDate(new Date(data.created_at))}</span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2 border-t border-border/60 pt-3">
                  <span className="text-sm text-muted-foreground">Total pago</span>
                  <span className="font-display text-2xl font-extrabold">
                    {formatBRL(data.amount_cents)}
                  </span>
                </div>

                {data.license ? (
                  <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Sua chave de licença
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate font-mono text-sm font-bold">
                        {data.license.code}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Copiar chave de licença"
                        onClick={() => {
                          void navigator.clipboard.writeText(data.license!.code);
                          toast.success("Chave copiada");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {data.license.expires_at && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Válida até {formatDate(new Date(data.license.expires_at))}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> A licença é liberada
                    automaticamente após a confirmação do pagamento.
                  </p>
                )}

                <p className="mt-3 text-[11px] text-muted-foreground">
                  O recibo e a confirmação ficam disponíveis em Licença › Pagamentos.
                </p>
              </div>
            )}

            <Button asChild className="mt-5 w-full font-semibold shadow-glow">
              <Link to="/dashboard">Ir para o painel</Link>
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
}
