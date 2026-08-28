import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Bot, Check, Copy, KeyRound, Loader2, PackagePlus, ShoppingCart, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLicense } from "@/hooks/useLicense";
import { usePeriods, usePlans } from "@/hooks/usePlans";
import { createMercadoPagoCheckout } from "@/lib/checkout.functions";
import { daysUntil, formatBRL, formatDate, formatNumber } from "@/lib/format";
import { activateLicense } from "@/lib/licenses.functions";
import { periodMonthlyCents, periodSavingsCents, periodTotalCents, type BillingPeriod } from "@/lib/pricing";
import { getAdQuota } from "@/lib/quota.functions";
import { getSubscriptionCenter } from "@/lib/subscription-center.functions";
import { cn } from "@/lib/utils";

const title = "Plano e licença — ANÚNCIO ML";
const description = "Veja sua capacidade, compare planos e ative uma licença quando necessário.";

export const Route = createFileRoute("/_authenticated/licenca")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { name: "robots", content: "noindex" }] }),
  component: LicensePage,
});

function LicensePage() {
  const queryClient = useQueryClient();
  const { data: license } = useLicense();
  const { data: plans = [] } = usePlans();
  const { data: periods = [] } = usePeriods();
  const activate = useServerFn(activateLicense);
  const checkout = useServerFn(createMercadoPagoCheckout);
  const quotaFn = useServerFn(getAdQuota);
  const subscriptionFn = useServerFn(getSubscriptionCenter);
  const { data: quota } = useQuery({ queryKey: ["ad-quota"], queryFn: () => quotaFn({}) });
  const { data: subscription } = useQuery({ queryKey: ["subscription-center"], queryFn: () => subscriptionFn({}), staleTime: 30_000 });
  const [code, setCode] = useState("");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const discount = periods.find((item) => item.period === period) ?? periods[0];

  const activation = useMutation({
    mutationFn: (value: string) => activate({ data: { code: value } }),
    onSuccess: (result) => {
      if (!result.ok) return toast.error("Chave não aceita", { description: result.reason });
      void queryClient.invalidateQueries({ queryKey: ["license"] });
      void queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
      void queryClient.invalidateQueries({ queryKey: ["subscription-center"] });
      toast.success("Licença ativada", { description: `Plano ${result.license.plan ?? ""} válido até ${formatDate(result.license.expires_at)}` });
      setCode("");
    },
    onError: () => toast.error("Não foi possível validar a chave agora."),
  });

  const purchase = useMutation({
    mutationFn: (planId: string) => checkout({ data: { plan_id: planId, period } }),
    onSuccess: (result) => {
      if (result.checkout_url) { window.location.href = result.checkout_url; return; }
      toast.error("Pagamento indisponível", { description: result.reason ?? "Não foi possível abrir o Mercado Pago agora." });
    },
    onError: (error) => toast.error("Falha ao iniciar o checkout.", { description: error instanceof Error ? error.message : undefined }),
  });

  const adsUsed = Number(quota?.used ?? 0);
  const adsTotal = Number(quota?.quota ?? 10);
  const adsRemaining = Number(quota?.remaining ?? Math.max(adsTotal - adsUsed, 0));
  const ai = subscription?.ai ?? { used: 0, limit: 0, remaining: 0 };

  return (
    <AppShell title="Plano e licença" description="Capacidade de anúncios e IA sem informação misturada.">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-base">Seu acesso atual</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-primary"/><div><p className="font-display text-xl font-extrabold">{license?.plan?.name ?? "Teste grátis"}</p><p className="text-xs text-muted-foreground">{license?.expires_at ? `Válido até ${formatDate(license.expires_at)}` : "Sem limite por tempo; teste limitado por quantidade"}</p></div></div>
              {license?.plan ? <Badge>ativo</Badge> : <Badge variant="secondary">10 anúncios para testar</Badge>}
            </div>

            <Usage label="Criações e duplicações" used={adsUsed} total={adsTotal} remaining={adsRemaining} detail="Cada novo anúncio criado ou duplicado consome 1 unidade. Editar ou publicar o mesmo rascunho não consome novamente." />
            <Usage label="Créditos de IA" used={Number(ai.used ?? 0)} total={Number(ai.limit ?? 0)} remaining={Number(ai.remaining ?? 0)} detail="Otimizações, sugestões de resposta e demais ações de IA usam um saldo separado." />

            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline"><Link to="/creditos"><PackagePlus className="mr-2 h-4 w-4"/>Comprar anúncios extras</Link></Button>
              <Button asChild variant="outline"><Link to="/creditos-ia" as any><Sparkles className="mr-2 h-4 w-4"/>Comprar créditos de IA</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Ativar uma chave</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (code.trim().length >= 6) activation.mutate(code.trim()); }}>
              <div className="space-y-2"><Label htmlFor="code">Código da licença</Label><Input id="code" value={code} placeholder="AML-XXXX-XXXX-XXXX" onChange={(event) => setCode(event.target.value.toUpperCase())}/></div>
              <Button type="submit" className="w-full" disabled={activation.isPending || code.trim().length < 6}>{activation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <KeyRound className="mr-2 h-4 w-4"/>}Ativar licença</Button>
            </form>
            {license?.code && <div className="mt-4 rounded-xl border p-3"><p className="text-xs text-muted-foreground">Licença atual</p><div className="mt-1 flex items-center justify-between gap-2"><code className="truncate text-xs">{license.code}</code><Button size="icon" variant="ghost" onClick={() => { void navigator.clipboard.writeText(license.code); toast.success("Código copiado"); }}><Copy className="h-4 w-4"/></Button></div></div>}
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="font-display text-xl font-extrabold">Planos</h2><p className="mt-1 text-sm text-muted-foreground">Compare capacidade de anúncios e créditos de IA. O teste grátis não faz parte do Starter.</p></div>
          <Tabs value={period} onValueChange={(value) => setPeriod(value as BillingPeriod)}><TabsList className="h-auto flex-wrap">{periods.map((item) => <TabsTrigger key={item.period} value={item.period}>{item.label}{Number(item.discount_percent) > 0 && <span className="ml-1 text-[10px] text-primary">-{Number(item.discount_percent)}%</span>}</TabsTrigger>)}</TabsList></Tabs>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = license?.plan?.id === plan.id;
            const total = discount ? periodTotalCents(plan, discount) : plan.price_monthly_cents;
            const monthly = discount ? periodMonthlyCents(plan, discount) : plan.price_monthly_cents;
            const savings = discount ? periodSavingsCents(plan, discount) : 0;
            return <Card key={plan.id} className={cn("relative flex flex-col", plan.highlighted && "border-primary/50 ring-1 ring-primary/30")}>
              <CardHeader className="space-y-2"><div className="flex items-center justify-between"><CardTitle>{plan.name}</CardTitle>{plan.highlighted && <Badge>mais escolhido</Badge>}</div><p className="text-xs text-muted-foreground">{plan.tagline}</p><div className="pt-2"><span className="font-display text-3xl font-extrabold">{formatBRL(monthly)}</span><span className="text-sm text-muted-foreground">/mês</span>{discount && discount.months > 1 && <p className="mt-1 text-xs text-muted-foreground">{formatBRL(total)} no período{savings > 0 ? ` · economize ${formatBRL(savings)}` : ""}</p>}</div></CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="grid grid-cols-2 gap-2"><Capacity icon={PackagePlus} value={plan.listing_limit == null ? "Ilimitados" : formatNumber(plan.listing_limit)} label="anúncios/ciclo"/><Capacity icon={Bot} value={formatNumber(plan.ai_credits ?? 0)} label="créditos IA/ciclo"/></div>
                <ul className="flex-1 space-y-2 text-sm text-muted-foreground">{plan.features.slice(0, 4).map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>{feature}</li>)}</ul>
                <Button className="w-full" variant={plan.highlighted ? "default" : "outline"} disabled={purchase.isPending || isCurrent} onClick={() => purchase.mutate(plan.id)}>{purchase.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShoppingCart className="mr-2 h-4 w-4"/>}{isCurrent ? "Plano atual" : "Contratar"}</Button>
              </CardContent>
            </Card>;
          })}
        </div>
      </section>
    </AppShell>
  );
}

function Usage({ label, used, total, remaining, detail }: { label: string; used: number; total: number; remaining: number; detail: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return <div className="rounded-2xl border bg-muted/20 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{label}</p><strong className="text-sm">{formatNumber(used)} / {formatNumber(total)}</strong></div><Progress value={pct} className="mt-3"/><div className="mt-2 flex items-start justify-between gap-3"><p className="max-w-xl text-xs leading-5 text-muted-foreground">{detail}</p><Badge variant="outline" className="shrink-0">{formatNumber(remaining)} restantes</Badge></div></div>;
}

function Capacity({ icon: Icon, value, label }: { icon: typeof PackagePlus; value: string; label: string }) {
  return <div className="rounded-xl border bg-muted/20 p-3"><Icon className="h-4 w-4 text-primary"/><p className="mt-2 text-lg font-extrabold">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>;
}
