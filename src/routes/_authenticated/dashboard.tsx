import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BadgeCheck,
  Link2,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/useAuth";
import { useActivity, useLicense, useListings } from "@/hooks/useLicense";
import { supabase } from "@/integrations/supabase/client";
import { daysUntil, formatBRL, formatDate, relativeTime } from "@/lib/format";

const title = "Dashboard — ANÚNCIO ML";
const description = "Acompanhe anúncios, licença, integrações e otimizações de IA em um só painel.";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: profile } = useProfile();
  const { data: license } = useLicense();
  const { data: listings = [] } = useListings();
  const { data: activity = [] } = useActivity(8);

  const { data: connection } = useQuery({
    queryKey: ["ml-connection"],
    queryFn: async () => {
      const { data } = await supabase.from("ml_connections").select("*").maybeSingle();
      return data;
    },
  });

  const drafts = listings.filter((l) => l.status === "draft").length;
  const published = listings.filter((l) => l.status === "active").length;
  const optimized = listings.filter((l) => (l.ai_score ?? 0) > 0).length;
  const avgScore = optimized
    ? Math.round(
        listings.reduce((sum, l) => sum + (l.ai_score ?? 0), 0) / optimized,
      )
    : 0;
  const potential = listings.reduce((sum, l) => sum + (l.price_cents ?? 0), 0);

  const freeRemaining =
    (profile?.free_listings_limit ?? 10) - (profile?.free_listings_used ?? 0);
  const remainingDays = daysUntil(license?.expires_at);

  return (
    <AppShell
      title={`Olá, ${profile?.full_name?.split(" ")[0] ?? "vendedor"}`}
      description="Encontre. Copie. Otimize. Publique. Venda."
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link to="/anuncios">
              <Tag className="mr-1.5 h-3.5 w-3.5" /> Meus anúncios
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/buscar">
              <Search className="mr-1.5 h-3.5 w-3.5" /> Buscar e copiar
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Anúncios criados" value={String(listings.length)} icon={Tag} hint={`${drafts} em rascunho`} />
        <StatCard label="Publicados no ML" value={String(published)} icon={ArrowUpRight} hint="via integração oficial" />
        <StatCard label="Otimizados por IA" value={String(optimized)} icon={Sparkles} hint={avgScore ? `Score médio ${avgScore}` : "Nenhum ainda"} />
        <StatCard label="Valor em catálogo" value={formatBRL(potential)} icon={TrendingUp} hint="soma dos preços cadastrados" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Próximos passos</CardTitle>
            <Badge variant="outline">Onboarding</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <StepRow
              done={!!connection?.connected}
              title="Conectar sua conta do Mercado Livre"
              text="Autorização oficial via OAuth para publicar direto na sua conta."
              action={
                <Button asChild size="sm" variant={connection?.connected ? "outline" : "default"}>
                  <Link to="/onboarding">
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />
                    {connection?.connected ? "Gerenciar" : "Conectar"}
                  </Link>
                </Button>
              }
            />
            <StepRow
              done={listings.length > 0}
              title="Copiar seu primeiro anúncio"
              text="Busque um produto, copie a estrutura e ajuste o que quiser."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to="/buscar">Buscar</Link>
                </Button>
              }
            />
            <StepRow
              done={!!license}
              title="Ativar um plano"
              text="Chave de licença ou pagamento pelo Mercado Pago."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to="/licenca">
                    <BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> Licença
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sua licença</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {license?.plan ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-bold">{license.plan.name}</span>
                  <Badge>{license.status === "active" ? "Ativa" : license.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Chave {license.code}</p>
                <p className="text-sm text-muted-foreground">
                  Válida até {formatDate(license.expires_at)}
                  {remainingDays !== null && remainingDays >= 0 ? ` · ${remainingDays} dia(s)` : ""}
                </p>
                <div className="text-sm text-muted-foreground">
                  Limite do plano:{" "}
                  {license.plan.listing_limit === null ? "ilimitado" : license.plan.listing_limit}{" "}
                  anúncios
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Você está no teste gratuito com {Math.max(freeRemaining, 0)} anúncio(s) restante(s).
                </p>
                <Progress
                  value={
                    ((profile?.free_listings_used ?? 0) / (profile?.free_listings_limit ?? 10)) * 100
                  }
                />
                <Button asChild className="w-full">
                  <Link to="/licenca">Escolher plano</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Atividade recente</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nada por aqui ainda. Suas ações aparecerão neste histórico.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-sm">{event.message}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(event.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Tag;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-2 font-display text-2xl font-extrabold tracking-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function StepRow({
  done,
  title,
  text,
  action,
}: {
  done: boolean;
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3.5">
      <div className="min-w-[220px] flex-1">
        <div className="flex items-center gap-2">
          <span
            className={
              done
                ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                : "flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground"
            }
          >
            {done ? "✓" : ""}
          </span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{text}</p>
      </div>
      {action}
    </div>
  );
}
