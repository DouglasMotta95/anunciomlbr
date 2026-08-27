import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Bell, Boxes, Bot, Crown, Package, Search, ShoppingBag, Sparkles, TrendingUp, Trophy, WalletCards, Zap } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { AdQuotaBar } from "@/components/app/PublishButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/useAuth";
import { useLicense, useListings } from "@/hooks/useLicense";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumber, relativeTime } from "@/lib/format";
import { getSellerGrowthOverview } from "@/lib/seller-growth.functions";

export const Route=createFileRoute("/_authenticated/dashboard")({head:()=>({meta:[{title:"Dashboard — ANÚNCIO ML"},{name:"robots",content:"noindex"}]}),component:DashboardPage});

function DashboardPage(){
  const {data:profile}=useProfile();
  const {data:license}=useLicense();
  const {data:listings=[]}=useListings();
  const overviewFn=useServerFn(getSellerGrowthOverview);
  const {data:overview}=useQuery({queryKey:["seller-growth","dashboard"],queryFn:()=>overviewFn(),staleTime:60000});
  const {data:connection}=useQuery({queryKey:["ml-connection"],queryFn:async()=>{const {data}=await supabase.from("ml_connections").select("*").maybeSingle();return data;}});
  const sales=overview?.sales??{orders:0,revenue_cents:0,ticket_cents:0,units:0};
  const opportunities=overview?.opportunities??[];
  const champions=(overview as any)?.champions??[];
  const active=listings.filter(l=>l.status==="active").length;
  const optimized=listings.filter(l=>(l.ai_score??0)>0).length;
  const created=listings.length;
  const remaining=overview?.quota.remaining??0;
  const used=(overview?.quota as any)?.used??Math.max(0,created);
  const limit=(overview?.quota as any)?.limit??(remaining+used);
  const pct=limit?Math.min(100,Math.round((used/limit)*100)):0;
  return <AppShell title={`Painel do vendedor${profile?.full_name?` · ${profile.full_name.split(" ")[0]}`:""}`} description="A mesma visão apresentada na demonstração, agora alimentada pelos dados reais da sua conta." actions={<><Button asChild variant="outline" size="sm"><Link to="/notificacoes" as any><Bell className="mr-2 h-4 w-4"/>Alertas</Link></Button><Button asChild size="sm"><Link to="/buscar"><Search className="mr-2 h-4 w-4"/>Buscar e copiar</Link></Button></>}>
    <AdQuotaBar/>
    {pct>=70&&<div className="mt-4 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/[.06] p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-semibold">Você já utilizou {pct}% da franquia deste ciclo.</p><p className="text-sm text-muted-foreground">Pausar ou excluir anúncios não devolve usos do ciclo. A franquia é renovada no próximo período.</p></div><div className="flex gap-2"><Button asChild size="sm"><Link to="/creditos">Comprar extras</Link></Button><Button asChild variant="outline" size="sm"><Link to="/licenca">Ver upgrade</Link></Button></div></div>}

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Anúncios criados" value={formatNumber(created)} hint={limit?`${formatNumber(used)} de ${formatNumber(limit)} usos no ciclo`:"dados da sua conta"} icon={Package}/>
      <Metric label="Anúncios ativos" value={formatNumber(active)} hint="sincronizados com sua operação" icon={Boxes}/>
      <Metric label="Otimizados por IA" value={formatNumber(optimized)} hint="anúncios já trabalhados pela IA" icon={Bot}/>
      <Metric label="Faturamento · 30 dias" value={formatBRL(sales.revenue_cents)} hint="vendas reais do Mercado Livre" icon={WalletCards}/>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
      <Card className="border-primary/20"><CardHeader><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Atalhos rápidos</p><CardTitle>Trabalhe seus anúncios</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2"><Quick to="/buscar" icon={Search} label="Buscar anúncios"/><Quick to="/anuncios" icon={Zap} label="Copiar em massa"/><Quick to="/anuncios" icon={Sparkles} label="ANÚNCIO AI"/><Quick to="/resultados" icon={TrendingUp} label="Relatórios e resultados"/></CardContent></Card>
      <Card><CardHeader><div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4"/><span className="text-xs font-semibold uppercase">ANÚNCIO AI</span></div><CardTitle>Otimização sob demanda</CardTitle></CardHeader><CardContent className="space-y-4"><div><div className="mb-2 flex justify-between text-sm"><span className="text-muted-foreground">Anúncios otimizados</span><strong>{optimized}</strong></div><Progress value={created?Math.round((optimized/created)*100):0}/></div><p className="text-sm text-muted-foreground">Melhore título, descrição e análise diretamente nos seus anúncios.</p><Button asChild className="w-full"><Link to="/anuncios"><Sparkles className="mr-2 h-4 w-4"/>Otimizar anúncio</Link></Button></CardContent></Card>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Pedidos · 30 dias" value={formatNumber(sales.orders)} hint={`${formatNumber((sales as any).units??sales.orders)} unidade(s) vendida(s)`} icon={ShoppingBag}/><Metric label="Ticket médio" value={formatBRL(sales.ticket_cents)} hint="por pedido no período" icon={Crown}/><Metric label="Franquia utilizada" value={limit?`${formatNumber(used)} / ${formatNumber(limit)}`:formatNumber(used)} hint={`${remaining} uso(s) disponível(is)`} icon={Zap}/><Metric label="Saúde da operação" value={`${overview?.score??0}/100`} hint={connection?.connected?"Mercado Livre conectado":"Integração requer atenção"} icon={TrendingUp}/></div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.85fr]"><Card><CardHeader><CardTitle>O que merece sua atenção hoje</CardTitle></CardHeader><CardContent className="space-y-2">{opportunities.length?opportunities.slice(0,4).map(o=><Link key={o.key} to={o.action_to as "/anuncios"} className="flex items-center gap-3 rounded-2xl border p-3"><Badge variant={o.severity==="high"?"destructive":"secondary"}>{o.count}</Badge><div className="flex-1"><p className="font-semibold">{o.title}</p><p className="text-xs text-muted-foreground">{o.description}</p></div><ArrowRight className="h-4 w-4"/></Link>):<p className="text-sm text-muted-foreground">Tudo em ordem por aqui.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Conta e plano</CardTitle></CardHeader><CardContent className="space-y-4"><Row label="Mercado Livre" value={connection?.connected?"Conectado":"Atenção"}/><Row label="Última sincronização" value={connection?.last_sync_at?relativeTime(connection.last_sync_at):"—"}/><Row label="Plano" value={license?.plan?.name??"Teste grátis"}/><Row label="Disponíveis no ciclo" value={formatNumber(remaining)}/><Button asChild variant="outline" className="w-full"><Link to="/assinatura" as any>Central da assinatura</Link></Button></CardContent></Card></div>

    <Card className="mt-4 border-primary/25"><CardHeader><p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Trophy className="h-4 w-4"/>Anúncios campeões</p><CardTitle>Repita o que já está vendendo</CardTitle></CardHeader><CardContent>{champions.length?<div className="grid gap-3 md:grid-cols-3">{champions.slice(0,3).map((c:any,i:number)=><div key={c.listing_id??i} className="rounded-2xl border p-3"><Badge>#{i+1}</Badge><p className="mt-2 font-semibold">{c.title}</p><p className="text-xs text-muted-foreground">{c.units} vendidos · {formatBRL(c.revenue_cents)}</p><Button asChild variant="outline" className="mt-3 w-full"><Link to="/anuncios">Duplicar campeão</Link></Button></div>)}</div>:<p className="text-sm text-muted-foreground">Os campeões aparecerão quando as vendas reais estiverem disponíveis.</p>}</CardContent></Card>
  </AppShell>;
}
function Metric({label,value,hint,icon:Icon}:any){return <Card><CardContent className="p-5"><div className="flex justify-between"><div><p className="text-[11px] uppercase text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p><p className="text-xs text-muted-foreground">{hint}</p></div><Icon className="h-5 w-5 text-primary"/></div></CardContent></Card>};
function Row({label,value}:any){return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div>};
function Quick({to,label,icon:Icon}:any){return <Button asChild variant="outline" className="h-auto min-h-12 justify-start"><Link to={to}><Icon className="mr-2 h-4 w-4 text-primary"/>{label}</Link></Button>}
