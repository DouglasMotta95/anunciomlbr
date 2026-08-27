import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Bell, Boxes, Bot, PackagePlus, Search, ShoppingBag, Sparkles, Trophy, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/useAuth";
import { useLicense, useListings } from "@/hooks/useLicense";
import { formatBRL, formatNumber } from "@/lib/format";
import { getSellerGrowthOverview } from "@/lib/seller-growth.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Painel do vendedor — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: profile } = useProfile();
  const { data: license } = useLicense();
  const { data: listings = [] } = useListings();
  const overviewFn = useServerFn(getSellerGrowthOverview);
  const { data: overview } = useQuery({ queryKey: ["seller-growth", "dashboard"], queryFn: () => overviewFn(), staleTime: 60000 });
  const sales = overview?.sales ?? { orders: 0, revenue_cents: 0, ticket_cents: 0, units: 0 };
  const champions = (overview as any)?.champions ?? [];
  const active = listings.filter((l) => l.status === "active").length;
  const optimized = listings.filter((l) => (l.ai_score ?? 0) > 0).length;
  const created = listings.length;
  const remaining = overview?.quota.remaining ?? 0;
  const used = (overview?.quota as any)?.used ?? 0;
  const limit = (overview?.quota as any)?.limit ?? remaining + used;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return <AppShell
    title={`Painel do vendedor${profile?.full_name ? ` · ${profile.full_name.split(" ")[0]}` : ""}`}
    description="Acompanhe sua operação e execute as principais ações em um só lugar."
    actions={<><Button asChild variant="outline" size="sm"><Link to="/notificacoes" as any><Bell className="mr-2 h-4 w-4"/>Alertas</Link></Button><Button asChild size="sm"><Link to="/buscar"><PackagePlus className="mr-2 h-4 w-4"/>Duplicar anúncio</Link></Button></>}
  >
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Anúncios criados" value={formatNumber(created)} hint="na sua conta" icon={PackagePlus}/>
      <Metric label="Anúncios ativos" value={formatNumber(active)} hint="publicados e ativos" icon={Boxes}/>
      <Metric label="Otimizados por IA" value={formatNumber(optimized)} hint="anúncios trabalhados pela IA" icon={Bot}/>
      <Metric label="Faturamento · 30 dias" value={formatBRL(sales.revenue_cents)} hint={`${formatNumber(sales.orders)} pedido(s)`} icon={WalletCards}/>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
      <Card className="border-primary/25">
        <CardHeader><CardTitle>Uso do seu plano</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-4"><div><p className="text-3xl font-extrabold">{formatNumber(used)} <span className="text-base font-medium text-muted-foreground">/ {formatNumber(limit)}</span></p><p className="text-sm text-muted-foreground">anúncios utilizados neste ciclo</p></div><Badge variant={pct >= 85 ? "destructive" : "secondary"}>{pct}% usado</Badge></div>
          <Progress value={pct}/>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Pausar ou excluir não devolve anúncios ao ciclo.</span><strong>{formatNumber(remaining)} disponíveis</strong></div>
          {pct >= 70 && <Button asChild><Link to="/assinatura" as any>Ver opções de upgrade</Link></Button>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Resumo de vendas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Row label="Pedidos · 30 dias" value={formatNumber(sales.orders)}/>
          <Row label="Unidades vendidas" value={formatNumber((sales as any).units ?? sales.orders)}/>
          <Row label="Ticket médio" value={formatBRL(sales.ticket_cents)}/>
          <Row label="Plano atual" value={license?.plan?.name ?? "Teste grátis"}/>
          <Button asChild variant="outline" className="w-full"><Link to="/vendas">Abrir vendas e pedidos</Link></Button>
        </CardContent>
      </Card>
    </div>

    <Card className="mt-4">
      <CardHeader><CardTitle>Ações rápidas</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Quick to="/buscar" icon={Search} label="Buscar e duplicar" description="Encontre um anúncio e crie sua versão."/>
        <Quick to="/anuncios" icon={Sparkles} label="Meus anúncios" description="Edite, duplique e otimize com IA."/>
        <Quick to="/vendas" icon={ShoppingBag} label="Pedidos e vendas" description="Veja pedidos e faturamento reais."/>
        <Quick to="/resultados" icon={BarChart3} label="Meus resultados" description="Acompanhe sua evolução na plataforma."/>
      </CardContent>
    </Card>

    <Card className="mt-4 border-primary/20">
      <CardHeader><div className="flex items-center gap-2 text-primary"><Trophy className="h-5 w-5"/><CardTitle>Anúncios campeões</CardTitle></div></CardHeader>
      <CardContent>{champions.length ? <div className="grid gap-3 md:grid-cols-3">{champions.slice(0,3).map((c:any,i:number)=><div key={c.listing_id ?? i} className="rounded-2xl border p-4"><Badge>#{i+1}</Badge><p className="mt-3 line-clamp-2 font-semibold">{c.title}</p><p className="mt-1 text-sm text-muted-foreground">{formatNumber(c.units)} vendidos · {formatBRL(c.revenue_cents)}</p><Button asChild variant="outline" className="mt-4 w-full"><Link to="/anuncios">Ver anúncio</Link></Button></div>)}</div> : <div className="rounded-2xl border border-dashed p-8 text-center"><Trophy className="mx-auto h-8 w-8 text-muted-foreground"/><p className="mt-3 font-semibold">Seus campeões aparecerão aqui</p><p className="mt-1 text-sm text-muted-foreground">Assim que houver vendas sincronizadas, destacamos os anúncios com melhor desempenho.</p></div>}</CardContent>
    </Card>
  </AppShell>;
}

function Metric({ label, value, hint, icon: Icon }: any) { return <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div><div className="rounded-xl bg-primary/10 p-2"><Icon className="h-5 w-5 text-primary"/></div></div></CardContent></Card> }
function Row({ label, value }: any) { return <div className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div> }
function Quick({ to, label, description, icon: Icon }: any) { return <Button asChild variant="outline" className="h-auto justify-start p-4 text-left"><Link to={to}><Icon className="mr-3 h-5 w-5 shrink-0 text-primary"/><span><strong className="block">{label}</strong><span className="mt-1 block whitespace-normal text-xs font-normal text-muted-foreground">{description}</span></span></Link></Button> }
