import { createFileRoute, Link, type LinkComponentProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDollarSign, Lightbulb, PackageSearch, ShieldCheck, Sparkles, Target } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
    default: return "/anuncios";
  }
}

function OpportunitiesPage() {
  const overviewFn = useServerFn(getSellerGrowthOverview);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["seller-growth"], queryFn: () => overviewFn() });
  const opportunities = data?.opportunities ?? [];
  const total = opportunities.reduce((sum, item) => sum + item.count, 0);
  const urgent = opportunities.filter((item) => item.severity === "high").reduce((sum, item) => sum + item.count, 0);
  const attention = opportunities.filter((item) => item.severity === "medium").reduce((sum, item) => sum + item.count, 0);

  return <AppShell title="Central de oportunidades" description="O ANÚNCIO ML reúne os pontos que merecem ação e leva você direto para a correção.">
    {isError ? <Card><CardContent className="py-12 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-destructive"/><p className="mt-3 font-semibold">Não foi possível analisar a operação.</p><Button className="mt-4" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></CardContent></Card> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Saúde da operação" value={isLoading ? "…" : `${data?.score ?? 0}/100`} icon={ShieldCheck}/>
        <Metric label="Ações encontradas" value={isLoading ? "…" : String(total)} icon={Lightbulb}/>
        <Metric label="Prioridade alta" value={isLoading ? "…" : String(urgent)} icon={Target}/>
        <Metric label="Precisam de atenção" value={isLoading ? "…" : String(attention)} icon={PackageSearch}/>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">Fila de ações</CardTitle><p className="mt-1 text-xs text-muted-foreground">Ordenada por impacto. Os números vêm dos dados disponíveis na sua conta.</p></div><Badge variant="outline">{total} itens</Badge></div></CardHeader><CardContent className="space-y-2">
          {!isLoading && !opportunities.length ? <div className="flex flex-col items-center rounded-xl border border-dashed py-10 text-center"><CheckCircle2 className="h-8 w-8 text-primary"/><p className="mt-3 font-semibold">Nenhuma pendência importante encontrada</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Continue acompanhando vendas, estoque e qualidade dos anúncios.</p></div> : opportunities.map((item) => <div key={item.key} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "secondary" : "outline"}>{item.count}</Badge><p className="font-semibold">{item.title}</p></div><p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p></div><Button asChild size="sm" className="shrink-0"><Link to={destination(item.action_to)}>Resolver<ArrowRight className="ml-2 h-4 w-4"/></Link></Button></div>)}
        </CardContent></Card>

        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="text-base">Índice operacional</CardTitle></CardHeader><CardContent><div className="flex items-end justify-between"><span className="font-display text-4xl font-bold">{data?.score ?? 0}</span><span className="text-sm text-muted-foreground">de 100</span></div><Progress className="mt-4" value={data?.score ?? 0}/><p className="mt-3 text-xs leading-5 text-muted-foreground">O índice diminui quando encontramos riscos objetivos como margem baixa, estoque crítico, cadastro incompleto ou problemas de conexão.</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary"/>Próximas análises</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Quick icon={CircleDollarSign} title="Margem e lucro" text="Complete custos para transformar faturamento em visão real de rentabilidade."/><Quick icon={PackageSearch} title="Qualidade dos anúncios" text="Use o Raio-X para encontrar títulos, imagens e cadastros que precisam de melhoria."/><Quick icon={Target} title="Mercado e concorrência" text="Cruze a pesquisa de mercado com o radar antes de alterar preços."/></CardContent></Card>
        </div>
      </div>
    </>}
  </AppShell>;
}

function Metric({label,value,icon:Icon}:{label:string;value:string;icon:typeof Target}){return <Card><CardContent className="flex items-center justify-between gap-3 pt-6"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p></div><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5"/></div></CardContent></Card>}
function Quick({icon:Icon,title,text}:{icon:typeof Target;title:string;text:string}){return <div className="flex gap-3 rounded-xl border p-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><div><p className="font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></div>}
