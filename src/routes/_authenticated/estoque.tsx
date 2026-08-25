import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  PackageX,
  Save,
  Tag,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useListings } from "@/hooks/useLicense";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumber } from "@/lib/format";

const title = "Estoque — ANÚNCIO ML";
const description = "Visão geral de estoque, alertas e margem estimada dos seus anúncios.";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EstoquePage,
});

type Filter = "todos" | "baixo" | "sem_estoque";

const LOW_STOCK_THRESHOLD = 5;

function EstoquePage() {
  const { data: listings = [], isLoading } = useListings();
  const [filter, setFilter] = useState<Filter>("todos");
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { cost: string; fees: string }>>({});

  const updateCosts = useMutation({
    mutationFn: async ({ id, cost_cents, fees_cents }: { id: string; cost_cents: number | null; fees_cents: number | null }) => {
      const { error } = await supabase
        .from("listings")
        .update({ cost_cents, fees_cents })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Custos atualizados");
    },
    onError: () => toast.error("Não foi possível salvar. Tente novamente."),
  });

  const totalEstoque = listings.reduce((sum, l) => sum + (l.stock ?? 0), 0);
  const estoqueBaixo = listings.filter((l) => (l.stock ?? 0) > 0 && (l.stock ?? 0) <= LOW_STOCK_THRESHOLD);
  const semEstoque = listings.filter((l) => (l.stock ?? 0) === 0);

  const withMargin = listings.map((l) => {
    const price = l.price_cents ?? 0;
    const cost = l.cost_cents ?? 0;
    const fees = l.fees_cents ?? 0;
    const lucro = price - cost - fees;
    const margem = price > 0 ? (lucro / price) * 100 : null;
    return { ...l, lucro_cents: lucro, margem };
  });

  const totalLucro = withMargin.reduce((sum, l) => sum + (l.price_cents ? l.lucro_cents : 0), 0);
  const totalReceitaCatalogo = withMargin.reduce((sum, l) => sum + (l.price_cents ?? 0), 0);
  const margemMedia = totalReceitaCatalogo > 0 ? (totalLucro / totalReceitaCatalogo) * 100 : null;

  const filtered = useMemo(() => {
    if (filter === "baixo") return withMargin.filter((l) => (l.stock ?? 0) > 0 && (l.stock ?? 0) <= LOW_STOCK_THRESHOLD);
    if (filter === "sem_estoque") return withMargin.filter((l) => (l.stock ?? 0) === 0);
    return withMargin;
  }, [withMargin, filter]);

  function getEdit(id: string, cost_cents: number | null, fees_cents: number | null) {
    return edits[id] ?? { cost: cost_cents != null ? String(cost_cents / 100) : "", fees: fees_cents != null ? String(fees_cents / 100) : "" };
  }

  function handleSave(id: string, cost_cents: number | null, fees_cents: number | null) {
    const edit = getEdit(id, cost_cents, fees_cents);
    const cost = edit.cost.trim() === "" ? null : Math.round(parseFloat(edit.cost.replace(",", ".")) * 100);
    const fees = edit.fees.trim() === "" ? null : Math.round(parseFloat(edit.fees.replace(",", ".")) * 100);
    if ((edit.cost.trim() !== "" && Number.isNaN(cost)) || (edit.fees.trim() !== "" && Number.isNaN(fees))) {
      toast.error("Informe valores numéricos válidos.");
      return;
    }
    updateCosts.mutate({ id, cost_cents: cost, fees_cents: fees });
  }

  return (
    <AppShell title="Estoque" description="Estoque atual, alertas e margem estimada por anúncio.">
      {isLoading && <EstoqueSkeleton />}

      {!isLoading && listings.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Boxes className="h-10 w-10 text-muted-foreground" />
            <h3 className="font-display text-lg font-bold">Nenhum anúncio cadastrado</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Crie ou sincronize anúncios para acompanhar estoque e margem por aqui.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && listings.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Estoque atual" value={formatNumber(totalEstoque)} icon={Boxes} />
            <MetricCard label="Estoque baixo" value={formatNumber(estoqueBaixo.length)} icon={AlertTriangle} tone={estoqueBaixo.length > 0 ? "warning" : undefined} />
            <MetricCard label="Sem estoque" value={formatNumber(semEstoque.length)} icon={PackageX} tone={semEstoque.length > 0 ? "destructive" : undefined} />
            <MetricCard label="Total de anúncios" value={formatNumber(listings.length)} icon={Tag} />
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Lucro e margem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Lucro estimado (catálogo)</span>
                  <div className="mt-1 font-display text-xl font-extrabold">{formatBRL(totalLucro)}</div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Margem média</span>
                  <div className="mt-1 font-display text-xl font-extrabold">
                    {margemMedia !== null ? `${margemMedia.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Informe custo e taxas por anúncio na tabela abaixo para estimar o lucro real.
              </p>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Anúncios</CardTitle>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  <TabsTrigger value="todos">Todos</TabsTrigger>
                  <TabsTrigger value="baixo">Estoque baixo</TabsTrigger>
                  <TabsTrigger value="sem_estoque">Sem estoque</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum anúncio nesse filtro.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Anúncio</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Estoque</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Custo</TableHead>
                        <TableHead>Taxas</TableHead>
                        <TableHead>Lucro</TableHead>
                        <TableHead>Margem</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((l) => {
                        const edit = getEdit(l.id, l.cost_cents, l.fees_cents);
                        const stock = l.stock ?? 0;
                        return (
                          <TableRow key={l.id}>
                            <TableCell className="max-w-[220px] truncate text-sm" title={l.title}>
                              {l.title}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{l.sku ?? "—"}</TableCell>
                            <TableCell>
                              {stock === 0 ? (
                                <Badge variant="destructive">Sem estoque</Badge>
                              ) : stock <= LOW_STOCK_THRESHOLD ? (
                                <Badge className="bg-warning text-warning-foreground hover:bg-warning">{stock} un.</Badge>
                              ) : (
                                <span className="text-sm">{stock} un.</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{formatBRL(l.price_cents)}</TableCell>
                            <TableCell>
                              <Input
                                className="h-8 w-24"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={edit.cost}
                                onChange={(e) =>
                                  setEdits((prev) => ({ ...prev, [l.id]: { ...edit, cost: e.target.value } }))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 w-24"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={edit.fees}
                                onChange={(e) =>
                                  setEdits((prev) => ({ ...prev, [l.id]: { ...edit, fees: e.target.value } }))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-sm font-semibold">
                              {l.price_cents ? formatBRL(l.lucro_cents) : "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {l.margem !== null ? `${l.margem.toFixed(1)}%` : "—"}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updateCosts.isPending}
                                onClick={() => handleSave(l.id, l.cost_cents, l.fees_cents)}
                              >
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
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
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Boxes;
  tone?: "warning" | "destructive" | undefined;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon
            className={
              tone === "destructive"
                ? "h-4 w-4 text-destructive"
                : tone === "warning"
                  ? "h-4 w-4 text-amber-500"
                  : "h-4 w-4 text-primary"
            }
          />
        </div>
        <div className="mt-2 font-display text-2xl font-extrabold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function EstoqueSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
