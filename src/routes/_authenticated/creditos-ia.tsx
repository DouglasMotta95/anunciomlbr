import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, CheckCircle2, Loader2, ShoppingCart, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { confirmCheckoutPayment } from "@/lib/checkout.functions";
import { createExtraAiCheckout, getExtraAiPackages } from "@/lib/extra-ai.functions";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/creditos-ia")({
  validateSearch: (search) => z.object({ payment_id: z.string().uuid().optional() }).parse(search),
  head: () => ({ meta: [{ title: "Créditos de IA — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: AiCreditsPage,
});

function AiCreditsPage() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const load = useServerFn(getExtraAiPackages);
  const checkout = useServerFn(createExtraAiCheckout);
  const confirm = useServerFn(confirmCheckoutPayment);
  const confirmed = useRef(false);

  const { data, isLoading, refetch } = useQuery({ queryKey: ["extra-ai-packages"], queryFn: () => load() });

  const purchase = useMutation({
    mutationFn: (packageId: string) => checkout({ data: { package_id: packageId } }),
    onSuccess: (result) => {
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      toast.error("Checkout indisponível", { description: "O Mercado Pago ainda não está configurado para esta compra." });
    },
    onError: (error) =>
      toast.error("Não foi possível iniciar a compra", { description: error instanceof Error ? error.message : undefined }),
  });

  useEffect(() => {
    if (!search.payment_id || confirmed.current) return;
    confirmed.current = true;
    void confirm({ data: { payment_id: search.payment_id } })
      .then(async (result) => {
        if (result.status === "approved") {
          toast.success("Pagamento aprovado!", { description: "Seus créditos extras de IA já foram adicionados ao saldo." });
          await queryClient.invalidateQueries({ queryKey: ["subscription-center"] });
          await queryClient.invalidateQueries({ queryKey: ["extra-ai-packages"] });
          await refetch();
          window.history.replaceState({}, "", "/creditos-ia");
        } else if (result.status === "pending" || result.status === "in_process") {
          toast.info("Pagamento em processamento", { description: "Assim que o Mercado Pago aprovar, os créditos serão liberados." });
        } else {
          toast.error("Pagamento não aprovado", { description: "Você pode tentar novamente ou escolher outro meio de pagamento." });
        }
      })
      .catch(() => toast.error("Não foi possível confirmar o pagamento agora."));
  }, [search.payment_id, confirm, queryClient, refetch]);

  const quota = data?.quota;
  const percent = quota?.total ? Math.min(100, (quota.used / quota.total) * 100) : 0;

  return (
    <AppShell title="Créditos de IA" description="Compre créditos extras sem trocar de plano e continue usando otimização, sugestões e respostas com IA.">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4 text-primary" /> Seu saldo de IA</CardTitle></CardHeader>
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

          {!data?.eligible && !isLoading ? (
            <Card className="border-warning/40"><CardContent className="space-y-3 p-5"><p className="font-semibold">Créditos extras de IA são exclusivos para clientes com plano ativo.</p><p className="text-sm text-muted-foreground">O teste grátis continua com os créditos iniciais. Para comprar saldo adicional, primeiro escolha um plano.</p><Button asChild><Link to="/licenca">Escolher um plano</Link></Button></CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(data?.packages ?? []).map((pack: any) => (
                <Card key={pack.id} className={pack.highlighted ? "border-primary/50 ring-1 ring-primary/20" : ""}>
                  <CardHeader className="space-y-2"><div className="flex items-center justify-between"><Sparkles className="h-5 w-5 text-primary" />{pack.badge && <Badge variant="secondary">{pack.badge}</Badge>}</div><CardTitle className="text-lg">{pack.name}</CardTitle><p className="text-xs text-muted-foreground">{pack.tagline}</p></CardHeader>
                  <CardContent className="space-y-4"><div><p className="text-2xl font-extrabold">{formatBRL(pack.price_monthly_cents)}</p><p className="text-xs text-muted-foreground">pagamento único</p></div><div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success" /><span>{pack.ai_credits} créditos de IA adicionados ao saldo</span></div><Button className="w-full" variant={pack.highlighted ? "default" : "outline"} disabled={purchase.isPending} onClick={() => purchase.mutate(pack.id)}>{purchase.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}Comprar</Button></CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit"><CardHeader><CardTitle className="text-base">Como os créditos funcionam</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>1. Cada plano possui uma franquia de IA por ciclo.</p><p>2. Otimizações, sugestões e respostas com IA consomem créditos.</p><p>3. Ao acabar, você pode comprar créditos extras sem trocar de plano.</p><p>4. Os extras ficam separados da franquia mensal e valem por até 12 meses.</p><p>5. O sistema usa primeiro a franquia do ciclo e depois o saldo extra.</p><Button asChild variant="outline" className="w-full"><Link to="/creditos">Comprar anúncios extras</Link></Button></CardContent></Card>
      </div>
    </AppShell>
  );
}
