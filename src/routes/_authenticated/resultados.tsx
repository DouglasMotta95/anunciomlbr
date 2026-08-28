import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BarChart3, Clock3, PackageCheck, RefreshCcw, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatNumber } from "@/lib/format";
import { getMonthlyResults } from "@/lib/monthly-results.functions";

export const Route = createFileRoute("/_authenticated/resultados")({
  head: () => ({ meta: [{ title: "Resultados do mês — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: Resultados,
});

function Resultados() {
  const load = useServerFn(getMonthlyResults);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["monthly-results"],
    queryFn: () => load(),
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return <AppShell title="Resultados do mês"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div></AppShell>;
  }

  if (isError || !data) {
    return (
      <AppShell title="Resultados do mês" description="Acompanhe somente dados confirmados da sua operação.">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <AlertTriangle className="h-9 w-9 text-destructive" />
            <h2 className="font-display text-lg font-bold">Não foi possível carregar seus resultados</h2>
            <p className="max-w-md text-sm text-muted-foreground">{error instanceof Error ? error.message : "Tente novamente em instantes. Nenhum valor estimado foi exibido como se fosse resultado real."}</p>
            <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}><RefreshCcw className="mr-2 h-4 w-4" />Tentar novamente</Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const cards = [
    ["Anúncios trabalhados", formatNumber(data.listings_worked ?? 0), PackageCheck, "anúncios criados ou atualizados no mês"],
    ["Ações com IA", formatNumber(data.ai_actions ?? 0), Sparkles, "uso real dos créditos de IA"],
    ["Tempo estimado economizado", `${Math.floor((data.estimated_minutes_saved ?? 0) / 60)}h ${(data.estimated_minutes_saved ?? 0) % 60}min`, Clock3, "estimativa baseada nas ações executadas"],
    ["Faturamento do mês", formatBRL(data.sales.revenue_cents ?? 0), BarChart3, "vendas reais sincronizadas do Mercado Livre"],
  ] as const;
  const change = data.revenue_change_percent;

  return (
    <AppShell title="Resultados do mês" description="Veja execução da plataforma e resultados comerciais sincronizados, sem misturar estimativa com faturamento.">
      <div className="space-y-5">
        {!data.connected && <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-semibold">Conecte o Mercado Livre para completar seus resultados</p><p className="text-sm text-muted-foreground">Anúncios e IA continuam sendo contabilizados, mas vendas e faturamento dependem da integração.</p></div><Button asChild><Link to="/integracoes">Ver integração</Link></Button></CardContent></Card>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, Icon, hint]) => <Card key={label} className="transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30"><CardContent className="p-5"><Icon className="mb-4 h-5 w-5 text-primary" /><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></CardContent></Card>)}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Desempenho comercial</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-xl border p-3"><p className="text-xl font-bold">{formatNumber(data.sales.orders ?? 0)}</p><p className="text-xs text-muted-foreground">Pedidos</p></div><div className="rounded-xl border p-3"><p className="text-xl font-bold">{formatNumber(data.sales.units ?? 0)}</p><p className="text-xs text-muted-foreground">Unidades</p></div><div className="rounded-xl border p-3"><p className="text-xl font-bold">{data.sales.orders ? formatBRL(Math.round((data.sales.revenue_cents ?? 0) / data.sales.orders)) : formatBRL(0)}</p><p className="text-xs text-muted-foreground">Ticket médio</p></div></div>{change !== null && change !== undefined ? <div className="flex items-center gap-2 rounded-xl border p-3">{change >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <TrendingDown className="h-5 w-5 text-destructive" />}<div><p className="text-sm font-semibold">{change >= 0 ? "+" : ""}{change}% vs. mês anterior</p><p className="text-xs text-muted-foreground">Comparação do faturamento sincronizado.</p></div></div> : <p className="text-sm text-muted-foreground">A comparação aparecerá quando existir faturamento no mês anterior.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Uso da plataforma no mês</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-xl border p-4"><p className="text-sm font-semibold">Você trabalhou {formatNumber(data.listings_worked ?? 0)} anúncios e executou {formatNumber(data.ai_actions ?? 0)} ações com IA neste mês.</p><p className="mt-1 text-xs text-muted-foreground">O tempo economizado é uma estimativa operacional e não é apresentado como venda ou lucro.</p></div><div className="flex flex-wrap gap-2"><Button asChild><Link to="/crescimento">Ver próximas oportunidades</Link></Button><Button asChild variant="outline"><Link to="/assinatura">Gerenciar assinatura</Link></Button></div></CardContent></Card>
        </section>
      </div>
    </AppShell>
  );
}
