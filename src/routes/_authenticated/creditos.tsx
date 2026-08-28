import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, PackagePlus, ShieldCheck, ShoppingCart, TrendingUp } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app/AppShell";
import { PaymentTrust } from "@/components/app/PaymentTrust";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { confirmCheckoutPayment } from "@/lib/checkout.functions";
import { createExtraAdsCheckout, getExtraAdPackages } from "@/lib/extra-ads.functions";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/creditos")({
  validateSearch: (search) => z.object({ payment_id: z.string().uuid().optional() }).parse(search),
  head: () => ({
    meta: [{ title: "Créditos extras — ANÚNCIO ML" }, { name: "robots", content: "noindex" }],
  }),
  component: CreditsPage,
});

function CreditsPage() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const load = useServerFn(getExtraAdPackages);
  const checkout = useServerFn(createExtraAdsCheckout);
  const confirm = useServerFn(confirmCheckoutPayment);
  const confirmed = useRef(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["extra-ad-packages"],
    queryFn: () => load(),
  });

  const purchase = useMutation({
    mutationFn: (packageId: string) => checkout({ data: { package_id: packageId } }),
    onSuccess: (result) => {
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      toast.error("Checkout indisponível", {
        description: "O Mercado Pago ainda não está configurado para esta compra.",
      });
    },
    onError: (error) =>
      toast.error("Não foi possível iniciar a compra", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  useEffect(() => {
    if (!search.payment_id || confirmed.current) return;
    confirmed.current = true;
    void confirm({ data: { payment_id: search.payment_id } })
      .then(async (result) => {
        if (result.status === "approved") {
          toast.success("Pagamento aprovado!", {
            description: "Seus anúncios extras já foram adicionados ao saldo.",
          });
          await queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
          await queryClient.invalidateQueries({ queryKey: ["license"] });
          await refetch();
          window.history.replaceState({}, "", "/creditos");
        } else if (result.status === "pending" || result.status === "in_process") {
          toast.info("Pagamento em processamento", {
            description: "Assim que o Mercado Pago aprovar, o saldo será liberado automaticamente.",
          });
        } else {
          toast.error("Pagamento não aprovado", {
            description: "Você pode tentar novamente ou escolher outro meio de pagamento.",
          });
        }
      })
      .catch(() => toast.error("Não foi possível confirmar o pagamento agora."));
  }, [search.payment_id, confirm, queryClient, refetch]);

  const quota = data?.quota;
  const percent = quota?.total ? Math.min(100, (quota.used / quota.total) * 100) : 0;

  return (
    <AppShell title="Comprar anúncios extras" description="Aumente seu saldo sem precisar trocar de plano.">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <PaymentTrust />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" /> Seu saldo de anúncios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="h-16 animate-pulse rounded-lg bg-muted" />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border p-3">
                      <p className="text-2xl font-bold">{quota?.total ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-2xl font-bold">{quota?.used ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Usados</p>
                    </div>
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <p className="text-2xl font-bold text-primary">{quota?.remaining ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Disponíveis</p>
                    </div>
                  </div>
                  <Progress value={percent} />
                </>
              )}
            </CardContent>
          </Card>

          {!data?.eligible && !isLoading ? (
            <Card className="border-warning/40">
              <CardContent className="space-y-3 p-5">
                <p className="font-semibold">Pacotes extras são exclusivos para clientes com plano ativo.</p>
                <p className="text-sm text-muted-foreground">
                  Se os 10 anúncios gratuitos acabaram, primeiro escolha um plano. Depois você poderá comprar créditos avulsos sempre que precisar.
                </p>
                <Button asChild>
                  <Link to="/licenca">Escolher um plano</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(data?.packages ?? []).map((pack) => (
                <Card
                  key={pack.id}
                  className={pack.highlighted ? "border-primary/50 ring-1 ring-primary/20" : ""}
                >
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between">
                      <PackagePlus className="h-5 w-5 text-primary" />
                      {pack.badge && <Badge variant="secondary">{pack.badge}</Badge>}
                    </div>
                    <CardTitle className="text-lg">{pack.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{pack.tagline}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-2xl font-extrabold">{formatBRL(pack.price_monthly_cents)}</p>
                      <p className="text-xs text-muted-foreground">pagamento único</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span>{pack.ad_quota} anúncios adicionados ao saldo</span>
                    </div>
                    <div className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/[.04] p-3 text-xs leading-5 text-muted-foreground">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>Você será direcionado ao Mercado Pago para escolher saldo, Pix, cartão ou outro meio disponível.</span>
                    </div>
                    <Button
                      className="w-full"
                      variant={pack.highlighted ? "default" : "outline"}
                      disabled={purchase.isPending}
                      onClick={() => purchase.mutate(pack.id)}
                    >
                      {purchase.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      Continuar para pagamento seguro
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Seu plano continua igual.</p>
            <p>2. Você compra apenas a quantidade extra que precisa.</p>
            <p>3. Você é direcionado ao ambiente oficial do Mercado Pago para escolher o meio disponível.</p>
            <p>4. Após a aprovação, você retorna para esta tela e o saldo é recarregado automaticamente.</p>
            <p>5. A liberação só acontece depois da confirmação do pagamento pelo provedor.</p>
            <p>6. Os créditos extras são consumidos junto com a sua cota de anúncios.</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/licenca">Ver upgrade de plano</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
