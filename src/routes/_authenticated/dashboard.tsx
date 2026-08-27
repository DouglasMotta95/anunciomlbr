import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bot, Boxes, Crown, PackageOpen, Search, ShoppingBag, Sparkles, Target, Trophy, WalletCards } from "lucide-react";
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
import { getProductImage } from "@/lib/product-image";
import { getSellerGrowthOverview } from "@/lib/seller-growth.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/dashboard")({ head:()=>({meta:[{title:"Dashboard — ANÚNCIO ML"},{name:"robots",content:"noindex"}]}), component:DashboardPage });

function DashboardPage(){
 const {data:profile}=useProfile(); const {data:license}=useLicense(); const {data:listings=[]}=useListings(); const overviewFn=useServerFn(getSellerGrowthOverview);
 const {data:overview}=useQuery({queryKey:["seller-growth","dashboard"],queryFn:()=>overviewFn(),staleTime:60000});
 const {data:connection}=useQuery({queryKey:["ml-connection"],queryFn:async()=>{const {data}=await supabase.from("ml_connections").select("*").maybeSingle();return data;}});
 const sales=overview?.sales ?? {orders:0,revenue_cents:0,ticket_cents:0,units:0}; const opportunities=overview?.opportunities??[];
 const champions=(overview as any)?.champions??[]; const active=listings.filter(l=>l.status==="active").length; const optimized=listings.filter(l=>(l.ai_score??0)>0).length;
 return <AppShell title={`Boa tarde, ${profile?.full_name?.split(" ")[0]??"vendedor"}`} description={opportunities.length?`Encontramos ${opportunities.reduce((s,o)=>s+o.count,0)} oportunidades para melhorar sua operação.`:"Sua operação está em dia. Continue acompanhando vendas e anúncios."} actions={<><Button asChild variant="outline" size="sm"><Link to="/crescimento"><Target className="mr-2 h-4 w-4"/>Central inteligente</Link></Button><Button asChild size="sm"><Link to="/buscar"><Search className="mr-2 h-4 w-4"/>Buscar e copiar</Link></Button></>}>
  <AdQuotaBar/>
  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <Metric label="Faturamento · 30 dias" value={formatBRL(sales.revenue_cents)} hint="vendas reais sincronizadas" icon={WalletCards}/>
   <Metric label="Pedidos · 30 dias" value={formatNumber(sales.orders)} hint={`${formatNumber((sales as any).units??sales.orders)} unidade(s) vendida(s)`} icon={ShoppingBag}/>
   <Metric label="Ticket médio" value={formatBRL(sales.ticket_cents)} hint="por pedido no período" icon={Crown}/>
   <Metric label="Anúncios ativos" value={formatNumber(active)} hint={`${optimized} otimizado(s) por IA`} icon={Boxes}/>
  </div>

  <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.85fr]">
   <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.06]">
    <CardHeader className="flex flex-row items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Central inteligente</p><CardTitle className="mt-1 text-xl">O que merece sua atenção hoje</CardTitle></div><Bot className="h-6 w-6 text-primary"/></CardHeader>
    <CardContent className="space-y-2">{opportunities.length===0?<div className="rounded-2xl border border-border/60 bg-background/50 p-5"><p className="font-semibold">Tudo em ordem por aqui.</p><p className="mt-1 text-sm text-muted-foreground">Assim que encontrarmos estoque baixo, margem apertada ou anúncio incompleto, a prioridade aparecerá aqui.</p></div>:opportunities.slice(0,4).map(o=><Link key={o.key} to={o.action_to as "/anuncios"} className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-background/55 p-3.5 transition hover:border-primary/35 hover:bg-primary/[0.04]"><Badge variant={o.severity==="high"?"destructive":o.severity==="medium"?"secondary":"outline"}>{o.count}</Badge><div className="min-w-0 flex-1"><p className="font-semibold">{o.title}</p><p className="truncate text-xs text-muted-foreground">{o.description}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"/></Link>)}<Button asChild variant="outline" className="mt-2 w-full"><Link to="/crescimento"><Sparkles className="mr-2 h-4 w-4"/>Ver análise completa e usar o copiloto</Link></Button></CardContent>
   </Card>
   <Card><CardHeader><CardTitle className="text-base">Saúde da operação</CardTitle></CardHeader><CardContent className="space-y-5"><div><div className="flex items-end justify-between"><span className="font-display text-3xl font-extrabold">{overview?.score??0}</span><span className="text-xs text-muted-foreground">de 100</span></div><Progress value={overview?.score??0} className="mt-2"/></div><div className="space-y-2 text-sm"><Row label="Mercado Livre" value={connection?.connected?"Conectado":"Atenção"}/><Row label="Última sincronização" value={connection?.last_sync_at?relativeTime(connection.last_sync_at):"—"}/><Row label="Plano" value={license?.plan?.name??"Teste grátis"}/><Row label="Anúncios disponíveis" value={formatNumber(overview?.quota.remaining??0)}/></div><Button asChild variant="outline" className="w-full"><Link to="/integracoes">Ver integrações</Link></Button></CardContent></Card>
  </div>

  <Card className="mt-4 border-primary/25">
   <CardHeader className="flex flex-row items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-primary"><Trophy className="h-4 w-4"/>Anúncios campeões</p><CardTitle className="mt-1 text-lg">Repita o que já está vendendo</CardTitle></div><Button asChild variant="ghost" size="sm"><Link to="/vendas">Ver vendas</Link></Button></CardHeader>
   <CardContent>{champions.length?<div className="grid gap-3 md:grid-cols-3">{champions.slice(0,3).map((c:any,i:number)=><div key={c.listing_id??c.ml_item_id??i} className="overflow-hidden rounded-2xl border bg-background/60"><div className="flex gap-3 p-3"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">{c.image?<img src={c.image} alt="" className="h-full w-full object-cover"/>:<Trophy className="m-6 h-8 w-8 text-primary"/>}</div><div className="min-w-0"><Badge variant="secondary">#{i+1} campeão</Badge><p className="mt-1 line-clamp-2 text-sm font-semibold">{c.title}</p><p className="mt-1 text-xs text-muted-foreground">{c.units} vendidos · {formatBRL(c.revenue_cents)}</p></div></div><div className="grid grid-cols-2 border-t"><Button asChild variant="ghost" className="rounded-none"><Link to="/anuncios">Duplicar</Link></Button><Button asChild variant="ghost" className="rounded-none border-l"><Link to="/anuncios"><Sparkles className="mr-1 h-3.5 w-3.5"/>Otimizar</Link></Button></div></div>)}</div>:<div className="flex flex-col items-center rounded-2xl border border-dashed p-7 text-center"><Trophy className="h-8 w-8 text-primary"/><p className="mt-3 font-semibold">Seus campeões aparecerão aqui</p><p className="mt-1 max-w-xl text-sm text-muted-foreground">Quando a permissão de Vendas do Mercado Livre estiver ativa, vamos ranquear os anúncios por unidades vendidas e faturamento — sem inventar números.</p></div>}</CardContent>
  </Card>

  <div className="mt-4 grid gap-4 lg:grid-cols-2">
   <Card><CardHeader><CardTitle className="text-base">Ações rápidas</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2"><Quick to="/buscar" icon={Search} label="Buscar anúncio"/><Quick to="/anuncios" icon={Sparkles} label="Otimizar com IA"/><Quick to="/estoque" icon={PackageOpen} label="Estoque e margem"/><Quick to="/creditos" icon={ShoppingBag} label="Comprar anúncios"/></CardContent></Card>
   <Card><CardHeader><CardTitle className="text-base">Últimos anúncios</CardTitle></CardHeader><CardContent className="space-y-2">{listings.length?listings.slice(0,3).map(l=>{const img=getProductImage(l.images);return <Link key={l.id} to="/anuncios" className="flex items-center gap-3 rounded-xl border p-2.5 transition hover:border-primary/30"><div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">{img&&<img src={img} alt="" className="h-full w-full object-cover"/>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{l.title}</p><p className="text-xs text-muted-foreground">{formatBRL(l.price_cents??0)}</p></div></Link>}):<p className="text-sm text-muted-foreground">Nenhum anúncio ainda. Busque um anúncio para começar.</p>}</CardContent></Card>
  </div>
 </AppShell>;
}
function Metric({label,value,hint,icon:Icon}:{label:string;value:string;hint:string;icon:typeof ShoppingBag}){return <Card className="border-border/70"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-extrabold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div><div className="rounded-xl bg-primary/10 p-2.5"><Icon className="h-4 w-4 text-primary"/></div></div></CardContent></Card>}
function Row({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><strong className="text-right text-xs">{value}</strong></div>}
function Quick({to,label,icon:Icon}:{to:"/buscar"|"/anuncios"|"/estoque"|"/creditos";label:string;icon:typeof Search}){return <Button asChild variant="outline" className="h-auto justify-start gap-2 py-4"><Link to={to}><Icon className="h-4 w-4 text-primary"/>{label}</Link></Button>}
