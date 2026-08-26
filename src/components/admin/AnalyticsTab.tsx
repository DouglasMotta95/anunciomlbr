import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminGetFunnelAnalytics, adminGetVisitAnalytics } from "@/lib/analytics.functions";
import { formatBRL, formatNumber } from "@/lib/format";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="mt-2 font-display text-2xl font-extrabold tracking-tight">{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

const shortDate = (value: string) => value.slice(8, 10) + "/" + value.slice(5, 7);

function FunnelSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "funnel-analytics"],
    queryFn: () => adminGetFunnelAnalytics(),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) {
    return <p className="text-sm text-destructive">Falha ao carregar o funil de conversão.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Planos visualizados" value={formatNumber(data.viewPlan)} hint="Evento view_plan" />
        <Stat
          label="Checkouts iniciados"
          value={formatNumber(data.startCheckout)}
          hint={`${data.viewToCheckoutRate}% dos planos vistos`}
        />
        <Stat
          label="Compras"
          value={formatNumber(data.purchase)}
          hint={`${data.checkoutToPurchaseRate}% dos checkouts`}
        />
        <Stat
          label="Receita rastreada"
          value={formatBRL(data.revenueCents)}
          hint={`Conversão geral ${data.overallRate}%`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil por dia (30 dias)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={shortDate} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                labelFormatter={(l) => `Dia ${shortDate(String(l))}`}
              />
              <Line type="monotone" dataKey="view_plan" name="Planos vistos" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="start_checkout" name="Checkouts" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="purchase" name="Compras" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversão por plano</CardTitle>
        </CardHeader>
        <CardContent>
          {data.plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento de funil registrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Vistos</TableHead>
                  <TableHead className="text-right">Checkouts</TableHead>
                  <TableHead className="text-right">Compras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.plans.map((row) => (
                  <TableRow key={row.plan}>
                    <TableCell className="font-medium uppercase">{row.plan}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.view_plan)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.start_checkout)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.purchase)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "visit-analytics"],
    queryFn: () => adminGetVisitAnalytics(),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">Falha ao carregar analytics de visitas.</p>;
  }

  return (
    <div className="space-y-5">
      {data.alerts.length > 0 && (
        <div className="space-y-3">
          {data.alerts.map((alert, i) => (
            <Card
              key={i}
              className={
                alert.level === "warning"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-muted/30"
              }
            >
              <CardContent className="flex items-start gap-3 py-4">
                <span
                  className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    alert.level === "warning" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  !
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{alert.title}</p>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Visitas hoje" value={formatNumber(data.today)} hint={`${formatNumber(data.uniqueToday)} visitantes únicos`} />
        <Stat label="Últimos 7 dias" value={formatNumber(data.last7)} hint={`${formatNumber(data.unique7)} visitantes únicos`} />
        <Stat label="Últimos 30 dias" value={formatNumber(data.last30)} hint={`${formatNumber(data.unique30)} visitantes únicos`} />
        <Stat label="Total de visitas" value={formatNumber(data.total)} hint={`${formatNumber(data.uniqueTotal)} visitantes únicos`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tráfego suspeito descartado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="Bots/spam (30 dias)" value={formatNumber(data.bots30)} hint="Não entram nas métricas acima" />
            <Stat label="Bots/spam (total)" value={formatNumber(data.botsTotal)} hint="Histórico completo" />
          </div>
          {data.botReasons.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.botReasons.map((r) => (
                <span
                  key={r.reason}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
                >
                  {r.reason} · {formatNumber(r.hits)}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Visitantes únicos são deduplicados por identificador do navegador (com sessão como reserva) e
            acessos repetidos da mesma página em até 30 minutos contam uma única vez.
          </p>
        </CardContent>
      </Card>



      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visitas por dia (30 dias)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={shortDate} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                labelFormatter={(l) => `Dia ${shortDate(String(l))}`}
              />
              <Line type="monotone" dataKey="visits" name="Visitas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="visitors" name="Únicos" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Origem do acesso</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {data.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma visita registrada ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sources}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="source" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="visits" name="Visitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campanhas (UTM)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma campanha identificada ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.campaigns.map((row) => (
                    <TableRow key={row.campaign}>
                      <TableCell className="font-medium">{row.campaign}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.visits)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2 pt-2">
        <h3 className="font-display text-lg font-extrabold tracking-tight">Funil de conversão</h3>
        <p className="text-xs text-muted-foreground">
          Eventos reais medidos na landing e no checkout: view_plan → start_checkout → purchase.
        </p>
      </div>
      <FunnelSection />
    </div>
  );
}
