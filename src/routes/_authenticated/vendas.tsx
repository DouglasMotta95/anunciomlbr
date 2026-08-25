import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Ban,
  Banknote,
  Link2,
  Package,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app/AppShell";
import { PeriodFilter } from "@/components/app/PeriodFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { getOrdersSummary } from "@/lib/orders.functions";
import { resolvePeriodRange, type PeriodKey } from "@/lib/period";

const title = "Vendas — ANÚNCIO ML";
const description = "Acompanhe pedidos, faturamento e desempenho de vendas reais do Mercado Livre.";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
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

const chartConfig = {
  faturamento_cents: { label: "Faturamento", color: "hsl(var(--primary))" },
};

const PAGE_SIZE = 10;

function VendasPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);

  const range = useMemo(() => resolvePeriodRange(period, custom), [period, custom]);
  const ordersSummaryFn = useServerFn(getOrdersSummary);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["orders-summary", range.fromISO, range.toISO],
    queryFn: () => ordersSummaryFn({ data: range }),
  });

  const notConnected = data && !data.ok && !data.configured;
  const otherError = data && !data.ok && data.configured;

  const summary = data && data.ok ? data.summary : null;
  const totalPages = summary ? Math.max(1, Math.ceil(summary.recentOrders.length / PAGE_SIZE)) : 1;
  const pageOrders = summary
    ? summary.recentOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : [];

  return (
    <AppShell
      title="Vendas"
      description="Pedidos e faturamento reais integrados via API oficial do Mercado Livre."
      actions={
        <PeriodFilter value={period} onChange={(v) => { setPeriod(v); setPage(1); }} custom={custom} onCustomChange={setCustom} />
      }
    >
      {isLoading && <VendasSkeleton />}

      {!isLoading && (notConnected || isError) && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Link2 className="h-10 w-10 text-muted-foreground" />
            <h3 className="font-display text-lg font-bold">Configuração pendente</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Conecte sua conta do Mercado Livre para visualizarmos seus pedidos e vendas reais.
              Nenhum dado é exibido até a integração estar ativa.
            </p>
            <Button asChild size="sm">
              <Link to="/onboarding">Conectar agora</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && otherError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <h3 className="font-display text-lg font-bold">Não foi possível carregar</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {"reason" in data && data.reason
                ? `Erro: ${data.reason}`
                : "A API do Mercado Livre não respondeu como esperado. Tente novamente em instantes."}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && summary && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Pedidos" value={String(summary.pedidos)} icon={ShoppingCart} />
            <MetricCard label="Vendas (unidades)" value={String(summary.vendas)} icon={Package} />
            <MetricCard label="Faturamento" value={formatBRL(summary.faturamento_cents)} icon={Banknote} />
            <MetricCard label="Ticket médio" value={formatBRL(summary.ticket_medio_cents)} icon={Receipt} />
            <MetricCard label="Cancelamentos" value={String(summary.cancelamentos)} icon={Ban} />
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Faturamento por dia</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.series.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma venda no período selecionado.
                </p>
              ) : (
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <AreaChart data={summary.series}>
                    <defs>
                      <linearGradient id="fillFaturamento" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-faturamento_cents)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--color-faturamento_cents)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => formatDate(v)}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={(v) => formatBRL(v)}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                      fontSize={12}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(v) => formatDate(v as string)}
                          formatter={(value) => formatBRL(value as number)}
                        />
                      }
                    />
                    <Area
                      dataKey="faturamento_cents"
                      type="monotone"
                      fill="url(#fillFaturamento)"
                      stroke="var(--color-faturamento_cents)"
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Pedidos recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.recentOrders.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum pedido encontrado no período.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Comprador</TableHead>
                          <TableHead>Itens</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-xs">{order.id}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatDateTime(order.date_created)}
                            </TableCell>
                            <TableCell className="text-sm">{order.buyer_nickname ?? "—"}</TableCell>
                            <TableCell className="max-w-[260px] truncate text-xs" title={order.items_summary}>
                              {order.items_summary || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(order.status)}>
                                {STATUS_LABEL[order.status] ?? order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatBRL(order.total_amount_cents)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Página {page} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Próxima
                      </Button>
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

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShoppingCart;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-2 font-display text-2xl font-extrabold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function VendasSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
