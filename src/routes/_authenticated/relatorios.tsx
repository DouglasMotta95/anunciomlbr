import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Download,
  FileWarning,
  Link2,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useListings } from "@/hooks/useLicense";
import { formatBRL, formatDate, formatNumber } from "@/lib/format";
import { getOrdersSummary } from "@/lib/orders.functions";
import { resolvePeriodRange, type PeriodKey } from "@/lib/period";

const title = "Relatórios — ANÚNCIO ML";
const description = "Relatórios de vendas, anúncios, estoque e performance com exportação em CSV.";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RelatoriosPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};

const chartConfig = {
  faturamento_cents: { label: "Faturamento", color: "hsl(var(--primary))" },
  quantidade: { label: "Quantidade", color: "hsl(var(--primary))" },
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#ef4444", "#10b981"];

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const first = rows[0];
  if (!first) return;
  const headers = Object.keys(first);
  const csv = [
    headers.join(";"),
    ...rows.map((row) => headers.map((h) => String(row[h] ?? "").replace(/;/g, ",")).join(";")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RelatoriosPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [tab, setTab] = useState("vendas");

  const range = useMemo(() => resolvePeriodRange(period, custom), [period, custom]);
  const ordersSummaryFn = useServerFn(getOrdersSummary);

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders-summary", range.fromISO, range.toISO],
    queryFn: () => ordersSummaryFn({ data: range }),
  });

  const { data: listings = [], isLoading: listingsLoading } = useListings();

  const notConnected = ordersData && !ordersData.ok && !ordersData.configured;
  const summary = ordersData && ordersData.ok ? ordersData.summary : null;

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of listings) map.set(l.status, (map.get(l.status) ?? 0) + 1);
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
  }, [listings]);

  const stockTotals = useMemo(() => {
    const total = listings.reduce((sum, l) => sum + (l.stock ?? 0), 0);
    const semEstoque = listings.filter((l) => (l.stock ?? 0) === 0).length;
    const baixo = listings.filter((l) => (l.stock ?? 0) > 0 && (l.stock ?? 0) <= 5).length;
    return { total, semEstoque, baixo };
  }, [listings]);

  const scoreBuckets = useMemo(() => {
    const buckets = [
      { label: "0–39", min: 0, max: 39, quantidade: 0 },
      { label: "40–59", min: 40, max: 59, quantidade: 0 },
      { label: "60–79", min: 60, max: 79, quantidade: 0 },
      { label: "80–100", min: 80, max: 100, quantidade: 0 },
    ];
    for (const l of listings) {
      const score = l.ai_score ?? null;
      if (score === null) continue;
      const bucket = buckets.find((b) => score >= b.min && score <= b.max);
      if (bucket) bucket.quantidade += 1;
    }
    return buckets;
  }, [listings]);

  const isLoading = ordersLoading || listingsLoading;

  function handleExport() {
    if (tab === "vendas" && summary) {
      downloadCsv(
        "relatorio-vendas.csv",
        summary.recentOrders.map((o) => ({
          pedido: o.id,
          data: o.date_created,
          status: o.status,
          comprador: o.buyer_nickname ?? "",
          itens: o.items_summary,
          total: (o.total_amount_cents / 100).toFixed(2),
        })),
      );
    } else if (tab === "anuncios") {
      downloadCsv(
        "relatorio-anuncios-status.csv",
        statusCounts.map((s) => ({ status: STATUS_LABEL[s.status] ?? s.status, quantidade: s.count })),
      );
    } else if (tab === "estoque") {
      downloadCsv(
        "relatorio-estoque.csv",
        listings.map((l) => ({
          titulo: l.title,
          sku: l.sku ?? "",
          estoque: l.stock ?? 0,
          preco: ((l.price_cents ?? 0) / 100).toFixed(2),
        })),
      );
    } else if (tab === "performance") {
      downloadCsv(
        "relatorio-performance.csv",
        scoreBuckets.map((b) => ({ faixa: b.label, quantidade: b.quantidade })),
      );
    }
  }

  return (
    <AppShell
      title="Relatórios"
      description="Vendas, anúncios, estoque e performance a partir dos seus dados reais."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter value={period} onChange={setPeriod} custom={custom} onCustomChange={setCustom} />
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      }
    >
      {isLoading && <ReportsSkeleton />}

      {!isLoading && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="anuncios">Anúncios por status</TabsTrigger>
            <TabsTrigger value="estoque">Estoque</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="vendas">
            {notConnected ? (
              <EmptyState
                icon={Link2}
                title="Configuração pendente"
                text="Conecte sua conta do Mercado Livre para gerar relatórios de vendas reais."
                action={
                  <Button asChild size="sm">
                    <Link to="/onboarding">Conectar agora</Link>
                  </Button>
                }
              />
            ) : !summary || summary.recentOrders.length === 0 ? (
              <EmptyState icon={FileWarning} title="Sem dados no período" text="Nenhuma venda encontrada para o período selecionado." />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Faturamento por dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <BarChart data={summary.series}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickFormatter={(v) => formatBRL(v)} tickLine={false} axisLine={false} width={90} fontSize={12} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(v) => formatDate(v as string)}
                            formatter={(value) => formatBRL(value as number)}
                          />
                        }
                      />
                      <Bar dataKey="faturamento_cents" fill="var(--color-faturamento_cents)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                  <div className="mt-6 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.recentOrders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs">{o.id}</TableCell>
                            <TableCell className="text-xs">{formatDate(o.date_created)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{o.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{formatBRL(o.total_amount_cents)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="anuncios">
            {statusCounts.length === 0 ? (
              <EmptyState icon={FileWarning} title="Nenhum anúncio" text="Cadastre ou sincronize anúncios para ver a distribuição por status." />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Anúncios por status</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  <ChartContainer config={chartConfig} className="mx-auto h-[260px] w-full max-w-[320px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie data={statusCounts} dataKey="count" nameKey="status" innerRadius={50}>
                        {statusCounts.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statusCounts.map((s) => (
                        <TableRow key={s.status}>
                          <TableCell>{STATUS_LABEL[s.status] ?? s.status}</TableCell>
                          <TableCell className="text-right">{formatNumber(s.count)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="estoque">
            {listings.length === 0 ? (
              <EmptyState icon={FileWarning} title="Nenhum anúncio" text="Sem dados de estoque para exibir." />
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard icon={BarChart3} label="Estoque total" value={formatNumber(stockTotals.total)} />
                <MetricCard icon={BarChart3} label="Itens com estoque baixo" value={formatNumber(stockTotals.baixo)} />
                <MetricCard icon={BarChart3} label="Itens sem estoque" value={formatNumber(stockTotals.semEstoque)} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="performance">
            {listings.length === 0 ? (
              <EmptyState icon={Sparkles} title="Sem dados de performance" text="Otimize anúncios com IA para gerar o score de performance." />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição de score de IA</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <BarChart data={scoreBuckets}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="quantidade" fill="var(--color-quantidade)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BarChart3 }) {
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

function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: typeof FileWarning;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <Icon className="h-10 w-10 text-muted-foreground" />
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{text}</p>
        {action}
      </CardContent>
    </Card>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64 rounded-lg" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
