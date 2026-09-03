import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, type LinkComponentProps } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  HeartPulse,
  Lightbulb,
  PackageSearch,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getSellerGrowthOverview } from "@/lib/seller-growth.functions";

export const Route = createFileRoute("/_authenticated/oportunidades")({
  head: () => ({ meta: [{ title: "Oportunidades — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: OpportunitiesPage,
});

type AppTo = NonNullable<LinkComponentProps["to"]>;
function destination(value: unknown): AppTo {
  switch (value) {
    case "/estoque": return "/estoque";
    case "/integracoes": return "/integracoes";
    case "/buscar": return "/buscar";
    case "/saude-anuncios": return "/saude-anuncios";
    case "/vendas": return "/vendas";
    case "/mercado": return "/mercado";
    case "/precificacao": return "/precificacao";
    case "/crescimento": return "/crescimento";
    default: return "/anuncios";
  }
}

function healthLabel(score: number) {
  if (score >= 85) return { label: "Operação saudável", detail: "Poucos pontos objetivos exigem atenção agora." };
  if (score >= 65) return { label: "Há espaço para melhorar", detail: "Resolva as prioridades para elevar a saúde da operação." };
  return { label: "Atenção recomendada", detail: "Comece pelas ações de maior impacto listadas abaixo." };
}

function OpportunitiesPage() {
  const overviewFn = useServerFn(getSellerGrowthOverview);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["seller-growth"],
    queryFn: () => overviewFn(),
    staleTime: 60_000,
  });

  const opportunities = data?.opportunities ?? [];
  const total = opportunities.reduce((sum, item) => sum + item.count, 0);
  const urgent = opportunities.filter((item) => item.severity === "high").reduce((sum, item) => sum + item.count, 0);
  const attention = opportunities.filter((item) => item.severity === "medium").reduce((sum, item) => sum + item.count, 0);
  const score = Math.max(0, Math.min(100, Number(data?.score ?? 0)));
  const health = healthLabel(score);
  const nextAction = opportunities.find((item) => item.severity === "high") ?? opportunities.find((item) => item.severity === "medium") ?? opportunities[0];

  return (
    <AppShell
      title="Central de oportunidades"
      description="Veja o que merece atenção, entenda o impacto e vá direto para a ação."
      actions={
        <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar análise
        </Button>
      }
    >
      {isError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-3 font-semibold">Não foi possível analisar a operação.</p>
            <p className="mt-1 text-sm text-muted-foreground">Tente novamente para recalcular as oportunidades com os dados disponíveis.</p>
            <Button className="mt-4" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
            <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[.06] via-background to-background">
              <CardContent className="p-5 sm:p-6">
                {isLoading ? (
                  <div className="space-y-4"><Skeleton className="h-6 w-44" /><Skeleton className="h-16 w-full" /><Skeleton className="h-10 w-40" /></div>
                ) : nextAction ? (
                  <div className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={nextAction.severity === "high" ? "destructive" : "secondary"}>Próxima melhor ação</Badge>
                        <span className="text-xs font-semibold text-muted-foreground">{nextAction.count} item(ns) identificado(s)</span>
                      </div>
                      <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{nextAction.title}</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{nextAction.description}</p>
                    </div>
                    <Button asChild size="lg" className="shrink-0 gap-2 font-bold shadow-glow">
                      <Link to={destination(nextAction.action_to)}>Resolver agora <ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-h-36 flex-col justify-center">
                    <div className="flex items-center gap-2 text-primary"><CheckCircle2 className="h-5 w-5" /><span className="text-sm font-bold">Sem prioridade crítica agora</span></div>
                    <h2 className="mt-3 text-2xl font-black">Sua fila operacional está limpa.</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Continue acompanhando vendas, estoque, mercado e qualidade dos anúncios.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex h-full items-center gap-5 p-5 sm:p-6">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${score * 3.6}deg, hsl(var(--muted)) 0deg)` }}>
                  <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-card">
                    <span className="font-display text-2xl font-black">{isLoading ? "…" : score}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">de 100</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-primary"><Gauge className="h-4 w-4" /> Saúde operacional</div>
                  <p className="mt-2 text-lg font-black">{isLoading ? "Calculando…" : health.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{health.detail}</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric loading={isLoading} label="Ações encontradas" value={String(total)} detail="fila total" icon={Lightbulb} />
            <Metric loading={isLoading} label="Prioridade alta" value={String(urgent)} detail="resolver primeiro" icon={Target} emphasis={urgent > 0} />
            <Metric loading={isLoading} label="Precisam de atenção" value={String(attention)} detail="impacto moderado" icon={PackageSearch} />
            <Metric loading={isLoading} label="Índice operacional" value={`${score}/100`} detail={health.label.toLowerCase()} icon={ShieldCheck} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
            <Card>
              <CardHeader className="border-b border-border/70 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div><CardTitle className="text-base">Fila de ações</CardTitle><p className="mt-1 text-xs text-muted-foreground">Comece pelo topo. Cada item leva para o módulo responsável pela correção.</p></div>
                  <Badge variant="outline">{isLoading ? "…" : `${total} itens`}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                {isLoading ? (
                  <div className="space-y-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}</div>
                ) : !opportunities.length ? (
                  <div className="flex flex-col items-center rounded-xl border border-dashed py-10 text-center">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                    <p className="mt-3 font-semibold">Nenhuma pendência importante encontrada</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">Continue acompanhando vendas, estoque e qualidade dos anúncios.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {opportunities.map((item, index) => (
                      <div key={item.key} className="group flex flex-col gap-3 rounded-xl border border-border/70 bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-black text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "secondary" : "outline"}>{item.count}</Badge>
                              <p className="font-semibold">{item.title}</p>
                            </div>
                            <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p>
                          </div>
                        </div>
                        <Button asChild size="sm" variant={index === 0 ? "default" : "outline"} className="shrink-0">
                          <Link to={destination(item.action_to)}>Resolver <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Índice operacional</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between"><span className="font-display text-4xl font-bold">{isLoading ? "…" : score}</span><span className="text-sm text-muted-foreground">de 100</span></div>
                  <Progress className="mt-4" value={score} />
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">O índice diminui somente quando encontramos riscos objetivos nos dados disponíveis, como margem baixa, estoque crítico, cadastro incompleto ou problemas de conexão.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />Atalhos de inteligência</CardTitle></CardHeader>
                <CardContent className="grid gap-2">
                  <ActionLink to="/precificacao" icon={CircleDollarSign} title="Simular preço e margem" text="Entenda o impacto antes de alterar preço." />
                  <ActionLink to="/saude-anuncios" icon={HeartPulse} title="Rodar Raio-X" text="Encontre pontos concretos para melhorar anúncios." />
                  <ActionLink to="/mercado" icon={BarChart3} title="Pesquisar mercado" text="Compare referências antes de tomar decisão." />
                  <ActionLink to="/crescimento" icon={TrendingUp} title="Abrir radar" text="Acompanhe concorrência e evolução." />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Metric({ label, value, detail, icon: Icon, loading, emphasis = false }: { label: string; value: string; detail: string; icon: typeof Target; loading?: boolean; emphasis?: boolean }) {
  return (
    <Card className={emphasis ? "border-destructive/25" : undefined}>
      <CardContent className="flex items-center justify-between gap-3 pt-6">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="mt-2 h-7 w-16" /> : <p className="mt-1 font-display text-2xl font-bold">{value}</p>}
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
        </div>
        <div className={`rounded-lg p-2 ${emphasis ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}

function ActionLink({ to, icon: Icon, title, text }: { to: AppTo; icon: typeof Target; title: string; text: string }) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start p-3 text-left">
      <Link to={to}>
        <Icon className="mr-3 h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0"><strong className="block text-sm">{title}</strong><span className="block text-xs font-normal text-muted-foreground">{text}</span></span>
        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </Button>
  );
}
