import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BadgeCheck, Brain, CalendarDays, CreditCard, PackagePlus, RefreshCcw, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { getSubscriptionCenter } from "@/lib/subscription-center.functions";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({ meta: [{ title: "Central da assinatura — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: Assinatura,
});

function statusLabel(status: string) {
  if (status === "approved") return "Aprovado";
  if (status === "pending") return "Pendente";
  if (status === "rejected") return "Recusado";
  if (status === "cancelled") return "Cancelado";
  return status;
}

function Assinatura() {
  const load = useServerFn(getSubscriptionCenter);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["subscription-center"],
    queryFn: () => load(),
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return <AppShell title="Central da assinatura"><div className="space-y-4"><Skeleton className="h-48 rounded-2xl" /><div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div></div></AppShell>;
  }

  if (isError || !data) {
    return (
      <AppShell title="Central da assinatura" description="Plano, consumo, créditos e histórico financeiro.">
        <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><AlertTriangle className="h-9 w-9 text-destructive" /><h2 className="font-display text-lg font-bold">Não foi possível carregar sua assinatura</h2><p className="max-w-md text-sm text-muted-foreground">{error instanceof Error ? error.message : "Tente novamente em instantes."}</p><Button variant="outline" disabled={isFetching} onClick={() => void refetch()}><RefreshCcw className="mr-2 h-4 w-4" />Tentar novamente</Button></CardContent></Card>
      </AppShell>
    );
  }

  const q = data.quota ?? { total: 0, used: 0, remaining: 0 };
  const pct = q.total ? Math.min(100, Math.round((q.used / q.total) * 100)) : 0;
  const ai = data.ai ?? { limit: 0, used: 0, remaining: 0 };
  const aiPct = ai.limit ? Math.min(100, Math.round((ai.used / ai.limit) * 100)) : 0;

  return (
    <AppShell title="Central da assinatura" description="Plano, consumo, créditos, tentativas de pagamento e próximos passos em um único lugar.">
      <div className="space-y-5">
        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <Card className="border-primary/25">
            <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Plano atual</p><CardTitle className="mt-1 text-2xl">{data.plan?.name ?? "Teste grátis"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{data.plan?.tagline ?? "Use seus anúncios gratuitos para conhecer o fluxo completo."}</p></div><Badge variant={data.license ? "default" : "outline"}>{data.license ? "Ativo" : "Grátis"}</Badge></div></CardHeader>
            <CardContent className="space-y-4">
              {data.license && <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Período</p><p className="font-semibold">{data.license.period === "monthly" ? "Mensal" : data.license.period === "quarterly" ? "3 meses" : data.license.period === "semiannual" ? "6 meses" : "Anual"}</p></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Validade</p><p className="font-semibold">{formatDate(data.license.expires_at)}</p></div></div>}
              <div className="flex flex-wrap gap-2"><Button asChild><Link to="/licenca"><TrendingUp className="mr-2 h-4 w-4" />Ver upgrade</Link></Button>{data.license && <><Button asChild variant="outline"><Link to="/creditos"><PackagePlus className="mr-2 h-4 w-4" />Anúncios extras</Link></Button><Button asChild variant="outline"><Link to="/creditos-ia"><Sparkles className="mr-2 h-4 w-4" />Créditos de IA</Link></Button></>}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" />Controle da assinatura</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Licença</span><strong className="break-all text-right">{data.license?.code ?? "—"}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Início</span><strong>{data.license?.starts_at ? formatDate(data.license.starts_at) : "—"}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Cancelamento</span><strong>{data.cancellation ? "Solicitado" : "Não solicitado"}</strong></div>{data.license && <Button asChild variant="outline" className="w-full"><Link to="/cancelamento">Gerenciar/cancelar</Link></Button>}</CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BadgeCheck className="h-4 w-4 text-primary" />Uso de anúncios</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-3xl font-extrabold">{q.remaining}</p><p className="text-xs text-muted-foreground">disponíveis</p></div><p className="text-sm text-muted-foreground">{q.used} usados de {q.total}</p></div><Progress value={pct} /><p className="text-xs leading-5 text-muted-foreground">A franquia considera criações e duplicações feitas pela plataforma. Anúncios que já existiam no Mercado Livre não entram nessa conta.</p>{pct >= 70 && <div className="space-y-2"><p className="text-xs text-muted-foreground">Você já usou {pct}% da cota. Você pode comprar anúncios extras sem trocar de plano.</p><Button asChild size="sm" variant="outline"><Link to="/creditos">Comprar anúncios extras</Link></Button></div>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4 text-primary" />Créditos de IA</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-3xl font-extrabold">{ai.remaining}</p><p className="text-xs text-muted-foreground">restantes</p></div><p className="text-sm text-muted-foreground">{ai.used} usados de {ai.limit}</p></div><Progress value={aiPct} /><p className="text-xs leading-5 text-muted-foreground">Otimizações, sugestões de título, respostas e outras ações de IA usam esse saldo. Os créditos extras ficam separados da franquia do ciclo.</p>{ai.remaining <= Math.max(5, Math.round(ai.limit * 0.2)) && <Button asChild size="sm" variant="outline"><Link to="/creditos-ia">Comprar créditos de IA</Link></Button>}</CardContent></Card>
        </section>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4 text-primary" />Tentativas e pagamentos</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4 text-xs leading-5 text-muted-foreground">Esta lista pode incluir tentativas pendentes, recusadas ou canceladas. Somente itens com status <strong>Aprovado</strong> representam pagamento confirmado.</p>
            {data.payments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma tentativa de pagamento registrada ainda.</p> : <div className="space-y-2">{data.payments.map((payment: any) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-semibold">{formatBRL(payment.amount_cents)}</p><p className="text-xs text-muted-foreground">{formatDateTime(payment.created_at)} · {payment.period ?? "pagamento"}</p></div><Badge variant={payment.status === "approved" ? "default" : payment.status === "rejected" ? "destructive" : "secondary"}>{statusLabel(payment.status)}</Badge></div>)}</div>}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" />Resultados do mês</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Veja vendas, anúncios trabalhados e o uso da plataforma no período.</p><Button asChild variant="outline" className="mt-4"><Link to="/resultados">Abrir resultados</Link></Button></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Precisa de mais capacidade?</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Você escolhe: subir de plano, comprar anúncios extras ou repor apenas os créditos de IA.</p><div className="mt-4 flex flex-wrap gap-2"><Button asChild><Link to="/creditos">Anúncios extras</Link></Button><Button asChild variant="outline"><Link to="/creditos-ia">Créditos de IA</Link></Button><Button asChild variant="outline"><Link to="/licenca">Comparar planos</Link></Button></div></CardContent></Card>
        </div>
      </div>
    </AppShell>
  );
}
