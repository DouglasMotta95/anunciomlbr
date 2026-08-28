import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, PackagePlus, ShieldCheck, TrendingUp } from "lucide-react";
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
  head: () => ({ meta: [{ title: "Créditos extras — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: CreditsPage,
});

function CreditsPage() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const load = useServerFn(getExtraAdPackages);
  const checkout = useServerFn(createExtraAdsCheckout);
  const confirm = useServerFn(confirmCheckoutPayment);
  const confirmed = useRef(false);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["extra-ad-packages"], queryFn: () => load() });

  const purchase = useMutation({
    mutationFn: (packageId: string) => checkout({ data: { package_id: packageId } }),
    onSuccess: (result) => {
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      toast.error("Checkout indisponível", { description: "Não foi possível abrir o Mercado Pago agora. Tente novamente em instantes." });
    },
    onError: (error) => toast.error("Não foi possível iniciar a compra", { description: error instanceof Error ? error.message : undefined }),
  });

  useEffect(() => {
    if (!search.payment_id || confirmed.current) return;
    confirmed.current = true;
    void confirm({ data: { payment_id: search.payment_id } })
      .then(async (result) => {
        if (result.status === "approved") {
          toast.success("Pagamento aprovado!", { description: "Seus anúncios extras já foram adicionados ao saldo." });
          await queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
          await queryClient.invalidateQueries({ queryKey: ["license"] });
          await refetch();
          window.history.replaceState({}, "", "/creditos");
        } else if (result.status === "pending" || result.status === "in_process") {
          toast.info("Pagamento em processamento", { description: "Assim que o Mercado Pago aprovar, o saldo será liberado automaticamente." });
        } else {
          toast.error("Pagamento não aprovado", { description: "Você pode tentar novamente." });
        }
      })
      .catch(() => toast.error("Não foi possível confirmar o pagamento agora."));
  }, [search.payment_id, confirm, queryClient, refetch]);

  const quota = data?.quota;
  const percent = quota?.total ? Math.min(100, (quota.used / quota.total) * 100) : 0;
  const packages = data?.packages ?? [];

  return (
    <AppShell title="Comprar anúncios extras" description="Escolha um pacote, veja o valor e siga direto para o pagamento no Mercado Pago.">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <PaymentTrust />

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" /> Seu saldo de anúncios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? <div className="h-16 animate-pulse rounded-lg bg-muted" /> : <>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border p-3"><p className="text-2xl font-bold">{quota?.total ?? 0}</p><p className="text-xs text-muted-foreground">Total</p></div>
                  <div className="rounded-lg border p-3"><p className="text-2xl font-bold">{quota?.used ?? 0}</p><p className="text-xs text-muted-foreground">Usados</p></div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="text-2xl font-bold text-primary">{quota?.remaining ?? 0}</p><p className="text-xs text-muted-foreground">Disponíveis</p></div>
                </div>
                <Progress value={percent} />
              </>}
            </CardContent>
          </Card>

          <div>
            <div className="mb-4">
              <h2 className="text-xl font-extrabold">Escolha quantos anúncios extras quer comprar</h2>
              <p className="mt-1 text-sm text-muted-foreground">O valor aparece no próprio botão. Ao clicar, o sistema abre o checkout do Mercado Pago.</p>
            </div>

            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-muted/30" />)}</div>
            ) : isError ? (
              <Card className="border-destructive/30"><CardContent className="p-5"><p className="font-semibold">Não foi possível carregar os pacotes.</p><Button className="mt-3" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></CardContent></Card>
            ) : packages.length === 0 ? (
              <Card className="border-warning/40"><CardContent className="p-5"><p className="font-semibold">Os pacotes de anúncios extras ainda não estão disponíveis.</p><p className="mt-1 text-sm text-muted-foreground">Tente novamente em instantes ou acesse os planos.</p><Button asChild className="mt-3"><Link to="/licenca">Ver planos</Link></Button></CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {packages.map((pack) => (
                  <Card key={pack.id} className={pack.highlighted ? "border-primary/50 ring-1 ring-primary/20" : ""}>
                    <CardHeader className="space-y-2">
                      <div className="flex items-center justify-between"><PackagePlus className="h-5 w-5 text-primary" />{pack.badge && <Badge variant="secondary">{pack.badge}</Badge>}</div>
                      <CardTitle className="text-lg">{pack.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{pack.tagline}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div><p className="text-2xl font-extrabold">{formatBRL(pack.price_monthly_cents)}</p><p className="text-xs text-muted-foreground">pagamento único</p></div>
                      <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success" /><span>{pack.ad_quota} anúncios adicionados ao saldo</span></div>
                      <Button className="w-full font-bold" variant={pack.highlighted ? "default" : "outline"} disabled={purchase.isPending} onClick={() => purchase.mutate(pack.id)}>
                        {purchase.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Comprar por {formatBRL(pack.price_monthly_cents)}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">Como funciona</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Escolha o pacote que deseja.</p>
            <p>2. Clique no botão com o valor da compra.</p>
            <p>3. Você será direcionado para o checkout do Mercado Pago.</p>
            <p>4. Depois da aprovação, os anúncios extras entram no seu saldo.</p>
            <Button asChild variant="outline" className="w-full"><Link to="/licenca">Ver upgrade de plano</Link></Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
