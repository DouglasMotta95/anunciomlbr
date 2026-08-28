import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, HeartPulse, RefreshCcw } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useListings } from "@/hooks/useLicense";
import { calculateListingHealth } from "@/lib/listing-health";

export const Route = createFileRoute("/_authenticated/saude-anuncios")({
  head: () => ({ meta: [{ title: "Saúde dos anúncios — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: ListingHealthPage,
});

function ListingHealthPage() {
  const { data: listings = [], isLoading, isError, error, refetch, isFetching } = useListings();
  const rows = listings
    .map((listing) => ({ listing, health: calculateListingHealth(listing) }))
    .sort((a, b) => a.health.score - b.health.score);
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.health.score, 0) / rows.length) : 0;
  const critical = rows.filter((row) => row.health.status === "critico").length;
  const good = rows.filter((row) => ["bom", "excelente"].includes(row.health.status)).length;

  return (
    <AppShell title="Saúde dos anúncios" description="Veja quais anúncios precisam de atenção antes de gastar tempo e tráfego neles.">
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}</div>
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="font-semibold">Não foi possível analisar seus anúncios</p>
            <p className="max-w-md text-sm text-muted-foreground">{error instanceof Error ? error.message : "Os anúncios não puderam ser carregados agora."}</p>
            <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}><RefreshCcw className="mr-2 h-4 w-4" />Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Score médio" value={`${average}/100`} />
            <Metric label="Críticos" value={String(critical)} />
            <Metric label="Bons ou excelentes" value={String(good)} />
          </div>
          <div className="mt-4 space-y-3">
            {rows.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><HeartPulse className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-semibold">Nenhum anúncio para analisar</p><p className="mt-1 text-sm text-muted-foreground">Sincronize sua conta ou crie um anúncio para começar.</p><Button asChild size="sm" className="mt-4"><Link to="/buscar">Buscar anúncios</Link></Button></CardContent></Card>
            ) : rows.map(({ listing, health }) => (
              <Card key={listing.id} className="transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><CardTitle className="truncate text-base">{listing.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{listing.source_ml_id ?? listing.published_ml_id ?? "Rascunho local"}</p></div>
                    <Badge variant={health.status === "critico" ? "destructive" : health.status === "atencao" ? "secondary" : "default"}>{health.score}/100 · {health.status === "atencao" ? "atenção" : health.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={health.score} />
                  {health.fixes.length > 0 ? (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">{health.fixes.map((fix, index) => <div key={`${fix}-${index}`} className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{fix}</span></div>)}</div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />Nenhuma correção básica pendente.</div>
                  )}
                  <div className="mt-4"><Button asChild size="sm" variant="outline"><Link to="/editor/$id" params={{ id: listing.id }}><HeartPulse className="mr-2 h-4 w-4" />Abrir anúncio</Link></Button></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="transition-all duration-300 hover:border-primary/25"><CardContent className="pt-6"><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></CardContent></Card>;
}
