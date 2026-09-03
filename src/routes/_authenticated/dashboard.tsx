import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  type LinkComponentProps,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Bell,
  Boxes,
  Bot,
  CheckCircle2,
  Circle,
  ExternalLink,
  PackagePlus,
  Search,
  ShoppingBag,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useAuth";
import { useLicense, useListings } from "@/hooks/useLicense";
import { getDashboardPlatformMetrics } from "@/lib/dashboard.functions";
import { formatBRL, formatNumber } from "@/lib/format";
import { getSellerGrowthOverview } from "@/lib/seller-growth.functions";
import { getSubscriptionCenter } from "@/lib/subscription-center.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel do vendedor — ANÚNCIO ML" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

type DashboardTo = NonNullable<LinkComponentProps["to"]>;

type JourneyProps = {
  done: boolean;
  number: string;
  title: string;
  text: string;
  to: DashboardTo;
};

type MetricProps = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  loading?: boolean;
};

type QuickProps = {
  to: DashboardTo;
  label: string;
  description: string;
  icon: LucideIcon;
  primary?: boolean;
};

function priorityDestination(value: unknown): DashboardTo {
  switch (value) {
    case "/assinatura": return "/assinatura";
    case "/buscar": return "/buscar";
    case "/crescimento": return "/crescimento";
    case "/estoque": return "/estoque";
    case "/integracoes": return "/integracoes";
    case "/notificacoes": return "/notificacoes";
    case "/perguntas": return "/perguntas";
    case "/saude-anuncios": return "/saude-anuncios";
    case "/vendas": return "/vendas";
    case "/anuncios":
    default: return "/anuncios";
  }
}

function DashboardPage() {
  const { data: profile } = useProfile();
  const { data: license } = useLicense();
  const listingsQuery = useListings();
  const listings = listingsQuery.data ?? [];

  const overviewFn = useServerFn(getSellerGrowthOverview);
  const platformFn = useServerFn(getDashboardPlatformMetrics);
  const subscriptionFn = useServerFn(getSubscriptionCenter);
  const overviewQuery = useQuery({
    queryKey: ["seller-growth", "dashboard"],
    queryFn: () => overviewFn(),
    staleTime: 60_000,
  });
  const platformQuery = useQuery({
    queryKey: ["dashboard-platform-metrics"],
    queryFn: () => platformFn(),
    staleTime: 60_000,
  });
  const subscriptionQuery = useQuery({
    queryKey: ["subscription-center"],
    queryFn: () => subscriptionFn(),
    staleTime: 30_000,
  });

  const overview = overviewQuery.data;
  const sales = overview?.sales;
  const champions = (overview as any)?.champions ?? [];
  const priorities = ((overview as any)?.opportunities ?? []).slice(0, 4);
  const active = listings.filter((listing) => listing.status === "active").length;
  const optimized = listings.filter(
    (listing) => listing.ai_score !== null && listing.ai_score !== undefined && Number(listing.ai_score) > 0,
  ).length;
  const remaining = overview?.quota.remaining ?? 0;
  const used = (overview?.quota as any)?.used ?? 0;
  const limit = (overview?.quota as any)?.quota ?? remaining + used;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const createdByPlatform = platformQuery.data?.created_by_platform ?? used;
  const isFree = !license && limit === 10;
  const lowFree = isFree && remaining > 0 && remaining <= 3;
  const ai = subscriptionQuery.data?.ai ?? { limit: 0, used: 0, remaining: 0 };
  const aiPct = ai.limit ? Math.min(100, Math.round((ai.used / ai.limit) * 100)) : 0;
  const connected = Boolean(overview?.connection?.connected);
  const hasListings = listings.length > 0;
  const hasOptimized = optimized > 0;
  const metricsLoading = listingsQuery.isLoading || platformQuery.isLoading;
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <AppShell
      title={firstName ? `Olá, ${firstName}` : "Visão geral"}
      description="Acompanhe sua operação e acesse as tarefas mais importantes."
      actions={
        <>
          <Button asChild variant="outline" size="sm"><Link to="/notificacoes"><Bell className="mr-2 h-4 w-4" />Alertas</Link></Button>
          <Button asChild size="sm"><Link to="/buscar"><Search className="mr-2 h-4 w-4" />Buscar anúncios</Link></Button>
        </>
      }
    >
      {isFree && (
        <Card className={lowFree ? "mb-4 border-amber-500/35" : "mb-4"}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Teste grátis</p>
                <p className="mt-1 text-xs text-muted-foreground">{used} de 10 anúncios usados</p>
              </div>
              <Badge variant={lowFree ? "destructive" : "outline"}>{remaining} restantes</Badge>
            </div>
            <Progress value={pct} className="mt-3" />
            {lowFree && <Button asChild size="sm" className="mt-3"><Link to="/licenca">Ver planos</Link></Button>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric loading={metricsLoading} label="Criados no ANÚNCIO ML" value={formatNumber(createdByPlatform)} hint="criados ou copiados" icon={PackagePlus} />
        <Metric loading={listingsQuery.isLoading} label="Anúncios ativos" value={formatNumber(active)} hint="inclui anúncios sincronizados" icon={Boxes} />
        <Metric loading={listingsQuery.isLoading} label="Otimizados com IA" value={formatNumber(optimized)} hint="com avaliação ou otimização" icon={Bot} />
        <Metric loading={overviewQuery.isLoading} label="Faturamento · 30 dias" value={sales?.available ? formatBRL(sales.revenue_cents) : "—"} hint={sales?.available ? "pedidos consultados no Mercado Livre" : "aguardando dados de vendas"} icon={ShoppingBag} />
      </div>

      {(!connected || !hasListings || !hasOptimized) && (
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Configuração</CardTitle>
              <Badge variant="outline">{connected && hasListings ? "Em andamento" : "Primeiros passos"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Journey done={connected} number="1" title="Conectar Mercado Livre" text={connected ? "Conta conectada" : "Autorize a conta para sincronizar anúncios."} to="/integracoes" />
              <Journey done={hasListings} number="2" title="Buscar ou sincronizar" text="Encontre anúncios ou carregue os seus." to="/buscar" />
              <Journey done={hasOptimized} number="3" title="Otimizar" text="Revise e melhore seus anúncios." to="/anuncios" />
              <Journey done={Boolean(sales?.available)} number="4" title="Acompanhar vendas" text="Consulte pedidos e desempenho." to="/vendas" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardHeader className="border-b border-border/70 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Prioridades</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">O que merece atenção agora.</p>
              </div>
              <Button asChild size="sm" variant="outline"><Link to="/crescimento">Ver tudo<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {overviewQuery.isLoading ? (
              <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-24 rounded-lg" />)}</div>
            ) : priorities.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {priorities.map((item: any) => (
                  <div key={item.key} className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/10 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.severity === "high" ? "destructive" : "outline"}>{formatNumber(item.count ?? 0)}</Badge>
                        <p className="font-semibold">{item.title}</p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0"><Link to={priorityDestination(item.action_to)}>Abrir</Link></Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 p-6 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />
                <p className="mt-2 font-semibold">Tudo certo por enquanto</p>
                <p className="mt-1 text-xs text-muted-foreground">Nenhuma prioridade crítica encontrada.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ações rápidas</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <Quick to="/buscar" icon={Search} label="Buscar anúncios" description="Pesquise no Mercado Livre." primary />
            <Button asChild variant="outline" className="h-auto justify-start p-3 text-left"><Link to="/editor/$id" params={{ id: "novo" }}><PackagePlus className="mr-2 h-4 w-4 text-primary" /><span><strong className="block">Novo anúncio</strong><span className="block text-xs font-normal text-muted-foreground">Criar do zero</span></span></Link></Button>
            <Quick to="/anuncios" icon={Sparkles} label="Meus anúncios" description="Editar e otimizar." />
            <Quick to="/vendas" icon={ShoppingBag} label="Vendas" description="Pedidos e faturamento." />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="border-b border-border/70">
            <div className="flex items-center justify-between gap-3"><CardTitle>Franquia de anúncios</CardTitle><Badge variant={pct >= 85 ? "destructive" : "outline"}>{pct}% usado</Badge></div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-3xl font-bold tracking-tight">{formatNumber(used)} <span className="text-base font-medium text-muted-foreground">/ {formatNumber(limit)}</span></p><p className="mt-1 text-sm text-muted-foreground">criações e cópias utilizadas</p></div>
              <strong className="text-sm">{formatNumber(remaining)} disponíveis</strong>
            </div>
            <Progress value={pct} className="h-2" />
            <p className="text-xs leading-5 text-muted-foreground">Editar anúncios existentes e sincronizar anúncios antigos do Mercado Livre não consome outra unidade.</p>
            {pct >= 70 && <Button asChild size="sm"><Link to="/assinatura">Ver plano e extras</Link></Button>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-center justify-between gap-2"><CardTitle>Créditos de IA</CardTitle><Badge variant={aiPct >= 85 ? "destructive" : "outline"}>{aiPct}%</Badge></div></CardHeader>
          <CardContent className="space-y-4">
            {subscriptionQuery.isLoading ? <Skeleton className="h-9 w-32" /> : <p className="text-3xl font-bold">{formatNumber(ai.used)} <span className="text-base font-medium text-muted-foreground">/ {formatNumber(ai.limit)}</span></p>}
            <Progress value={aiPct} />
            <p className="text-xs leading-5 text-muted-foreground">Textos usam 1 crédito por ação. Imagens usam 3 por geração.</p>
            <Button asChild size="sm" variant="outline" className="w-full"><Link to="/creditos-ia">Gerenciar créditos</Link></Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader><CardTitle>Vendas · últimos 30 dias</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {overviewQuery.isLoading ? (
              <div className="space-y-3">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-6 w-full" />)}</div>
            ) : overviewQuery.isError ? (
              <DataUnavailable text="Não foi possível consultar as vendas agora." />
            ) : sales?.available ? (
              <><Row label="Pedidos" value={formatNumber(sales.orders)} /><Row label="Unidades vendidas" value={formatNumber(sales.units)} /><Row label="Faturamento" value={formatBRL(sales.revenue_cents)} /><Row label="Ticket médio" value={formatBRL(sales.ticket_cents)} /></>
            ) : (
              <DataUnavailable text={connected ? "Os dados de vendas estão indisponíveis no momento." : "Conecte o Mercado Livre para carregar vendas reais."} />
            )}
            <Button asChild variant="outline" className="w-full">{connected ? <Link to="/vendas">Abrir vendas</Link> : <Link to="/integracoes">Conectar Mercado Livre</Link>}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mais vendidos</CardTitle></CardHeader>
          <CardContent>
            {overviewQuery.isLoading ? (
              <div className="space-y-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-16 rounded-lg" />)}</div>
            ) : sales?.available && champions.length ? (
              <div className="space-y-2">
                {champions.slice(0, 3).map((champion: any, index: number) => (
                  <div key={champion.listing_id ?? champion.ml_item_id ?? index} className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
                    {champion.image ? <img src={champion.image} alt={champion.title} className="h-14 w-14 shrink-0 rounded-md border bg-white object-contain" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted"><ShoppingBag className="h-5 w-5 text-muted-foreground" /></div>}
                    <div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-semibold">{champion.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatNumber(champion.units)} vendidos · {formatBRL(champion.revenue_cents)}</p></div>
                    {champion.permalink && <Button asChild size="icon" variant="ghost"><a href={champion.permalink} target="_blank" rel="noopener noreferrer" aria-label="Ver anúncio no Mercado Livre"><ExternalLink className="h-4 w-4" /></a></Button>}
                  </div>
                ))}
              </div>
            ) : (
              <DataUnavailable text={sales?.available ? "Ainda não há vendas suficientes para esta lista." : "Aguardando dados reais de vendas."} />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Journey({ done, number, title, text, to }: JourneyProps) {
  return (
    <Link to={to} className="rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/35 hover:bg-muted/15">
      <div className="flex items-center justify-between"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">{number}</span>{done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground/50" />}</div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </Link>
  );
}

function Metric({ label, value, hint, icon: Icon, loading = false }: MetricProps) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">{label}</p>{loading ? <Skeleton className="mt-2 h-8 w-28" /> : <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>}<p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p></div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 text-sm last:border-0"><span className="text-muted-foreground">{label}</span><strong>{value}</strong></div>;
}

function DataUnavailable({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border/80 p-5 text-center"><p className="text-sm font-semibold">Dados indisponíveis</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>;
}

function Quick({ to, label, description, icon: Icon, primary = false }: QuickProps) {
  return (
    <Button asChild variant={primary ? "default" : "outline"} className="h-auto justify-start p-3 text-left">
      <Link to={to}><Icon className="mr-2 h-4 w-4" /><span><strong className="block">{label}</strong><span className={primary ? "block text-xs font-normal text-primary-foreground/75" : "block text-xs font-normal text-muted-foreground"}>{description}</span></span></Link>
    </Button>
  );
}
