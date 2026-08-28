import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Ban, Banknote, Link2, Package, Receipt, RefreshCcw, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app/AppShell";
import { PeriodFilter } from "@/components/app/PeriodFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { getOrdersSummary } from "@/lib/orders.functions";
import { resolvePeriodRange, type PeriodKey } from "@/lib/period";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas — ANÚNCIO ML" },
      { name: "description", content: "Acompanhe pedidos, faturamento e desempenho de vendas reais do Mercado Livre." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendasPage,
});

const STATUS_LABEL: Record<string, string> = {
  paid: "Pago",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  invalid: "Inválido",
  pending: "Pendente",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "cancelled" || status === "invalid") return "destructive";
  if (status === "paid" || status === "confirmed") return "default";
  return "secondary";
}

const chartConfig = { faturamento_cents: { label: "Faturamento", color: "hsl(var(--primary))" } };
const PAGE_SIZE = 8;

function VendasPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const range = useMemo(() => resolvePeriodRange(period, custom), [period, custom]);
  const fn = useServerFn(getOrdersSummary);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["orders-summary", range.fromISO, range.toISO],
    queryFn: () => fn({ data: range }),
    retry: 1,
  });

  const notConnected = !!data && !data.ok && !data.configured;
  const apiError = !!data && !data.ok && data.configured;
  const summary = data && data.ok ? data.summary : null;
  const totalPages = summary ? Math.max(1, Math.ceil(summary.recentOrders.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(page, totalPages);
  const pageOrders = summary
    ? summary.recentOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : [];

  const periodFilter = (
    <PeriodFilter
      value={period}
      onChange={(value) => {
        setPeriod(value);
        setPage(1);
      }}
      custom={custom}
      onCustomChange={(value) => {
        setCustom(value);
        setPage(1);
      }}
    />
  );

  return (
    <AppShell
      title="Vendas"
      description="Pedidos, produtos e faturamento reais da sua conta do Mercado Livre."
      actions={periodFilter}
    >
      {isLoading && <VendasSkeleton />}

      {!isLoading && isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <h3 className="font-display text-lg font-bold">Falha ao consultar as vendas</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Não foi possível consultar o Mercado Livre agora."}
            </p>
            <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && notConnected && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Link2 className="h-10 w-10 text-muted-foreground" />
            <h3 className="font-display text-lg font-bold">Mercado Livre não conectado</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Conecte sua conta para carregar pedidos, produtos e faturamento reais.
            </p>
            <Button asChild size="sm"><Link to="/integracoes">Conectar Mercado Livre</Link></Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && apiError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <h3 className="font-display text-lg font-bold">Não foi possível carregar</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {data.reason || "A API do Mercado Livre não respondeu como esperado."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
                <RefreshCcw className="mr-2 h-4 w-4" /> Tentar novamente
              </Button>
              <Button asChild size="sm" variant="ghost"><Link to="/integracoes">Ver conexão</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && summary && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Pedidos" value={String(summary.pedidos)} icon={ShoppingCart} />
            <MetricCard label="Vendas (unidades)" value={String(summary.vendas)} icon={Package} />
            <MetricCard label="Faturamento" value={formatBRL(summary.faturamento_cents)} icon={Banknote} />
            <MetricCard label="Ticket médio" value={formatBRL(summary.ticket_medio_cents)} icon={Receipt} />
            <MetricCard label="Cancelamentos" value={String(summary.cancelamentos)} icon={Ban} />
          </div>

          <Card className="mt-4 overflow-hidden">
            <CardHeader className="border-b bg-muted/20"><CardTitle className="text-base">Faturamento por dia</CardTitle></CardHeader>
            <CardContent className="pt-5">
              {summary.series.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma venda no período selecionado.</p>
              ) : (
                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <AreaChart data={summary.series}>
                    <defs>
                      <linearGradient id="fillFaturamento" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-faturamento_cents)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--color-faturamento_cents)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickFormatter={(value) => formatBRL(value)} tickLine={false} axisLine={false} width={90} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatDate(value as string)} formatter={(value) => formatBRL(value as number)} />} />
                    <Area dataKey="faturamento_cents" type="monotone" fill="url(#fillFaturamento)" stroke="var(--color-faturamento_cents)" />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4 overflow-hidden">
            <CardHeader className="border-b bg-muted/20"><CardTitle className="text-base">Pedidos recentes</CardTitle></CardHeader>
            <CardContent className="pt-5">
              {summary.recentOrders.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhum pedido encontrado no período.</p>
              ) : (
                <>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {pageOrders.map((order) => (
                      <div key={order.id} className="group flex gap-3 rounded-2xl border bg-card p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                        {order.image ? (
                          <img src={order.image} alt={order.item_title} className="h-20 w-20 shrink-0 rounded-xl border bg-white object-contain" />
                        ) : (
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-muted"><Package className="h-6 w-6 text-muted-foreground" /></div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="line-clamp-2 text-sm font-semibold">{order.item_title}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">Pedido #{order.id}</p>
                            </div>
                            <Badge variant={statusVariant(order.status)}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <span className="text-muted-foreground">Quantidade</span><strong className="text-right">{order.quantity}</strong>
                            <span className="text-muted-foreground">Comprador</span><strong className="truncate text-right">{order.buyer_nickname ?? "Não informado"}</strong>
                            <span className="text-muted-foreground">Data</span><strong className="text-right">{formatDateTime(order.date_created)}</strong>
                            <span className="text-muted-foreground">Total</span><strong className="text-right text-primary">{formatBRL(order.total_amount_cents)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Página {safePage} de {totalPages}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
                      <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Próxima</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ShoppingCart }) {
  return (
    <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className="rounded-xl bg-primary/10 p-2"><Icon className="h-4 w-4 text-primary" /></span>
        </div>
        <div className="mt-2 font-display text-2xl font-extrabold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function VendasSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 w-full rounded-xl" />)}</div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
