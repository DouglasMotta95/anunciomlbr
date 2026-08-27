import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, HeartPulse } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useListings } from "@/hooks/useLicense";
import { calculateListingHealth } from "@/lib/listing-health";

export const Route = createFileRoute("/_authenticated/saude-anuncios")({
  head: () => ({ meta: [{ title: "Saúde dos anúncios — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: ListingHealthPage,
});

function ListingHealthPage() {
  const { data: listings = [] } = useListings();
  const rows = listings.map((listing) => ({ listing, health: calculateListingHealth(listing) })).sort((a,b)=>a.health.score-b.health.score);
  const average = rows.length ? Math.round(rows.reduce((sum,r)=>sum+r.health.score,0)/rows.length) : 0;
  const critical = rows.filter((r)=>r.health.status === "critico").length;
  const good = rows.filter((r)=>["bom","excelente"].includes(r.health.status)).length;

  return <AppShell title="Saúde dos anúncios" description="Veja quais anúncios precisam de atenção antes de gastar tempo e tráfego neles.">
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Score médio" value={`${average}/100`} /><Metric label="Críticos" value={String(critical)} /><Metric label="Bons ou excelentes" value={String(good)} /></div>
    <div className="mt-4 space-y-3">{rows.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhum anúncio cadastrado ainda.</CardContent></Card> : rows.map(({listing,health})=><Card key={listing.id}><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="truncate text-base">{listing.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{listing.source_ml_id ?? listing.published_ml_id ?? "Rascunho local"}</p></div><Badge variant={health.status === "critico" ? "destructive" : health.status === "atencao" ? "secondary" : "default"}>{health.score}/100 · {health.status === "atencao" ? "atenção" : health.status}</Badge></div></CardHeader><CardContent><Progress value={health.score}/>{health.fixes.length > 0 ? <div className="mt-4 grid gap-2 md:grid-cols-2">{health.fixes.map((fix,i)=><div key={i} className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/><span>{fix}</span></div>)}</div> : <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary"/>Nenhuma correção básica pendente.</div>}<div className="mt-4"><Button asChild size="sm" variant="outline"><Link to="/editor/$id" params={{id:listing.id}}><HeartPulse className="mr-2 h-4 w-4"/>Abrir anúncio</Link></Button></div></CardContent></Card>)}</div>
  </AppShell>;
}

function Metric({label,value}:{label:string;value:string}){return <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></CardContent></Card>}
