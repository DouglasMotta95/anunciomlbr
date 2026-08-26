import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Loader2, Pause, Play, PlusCircle, Sparkles, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { BulkJobDialog } from "@/components/app/BulkJobDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListings } from "@/hooks/useLicense";
import { startBulkJob } from "@/lib/bulk.functions";
import { formatBRL, formatDate } from "@/lib/format";
import { getProductImage } from "@/lib/product-image";

const title = "Meus anúncios — ANÚNCIO ML";
const description =
  "Gerencie rascunhos, ativos, pausados e otimize seus anúncios com o ANÚNCIO AI antes de publicar.";

export const Route = createFileRoute("/_authenticated/anuncios")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ListingsPage,
});

type Listing = ReturnType<typeof useListings>["data"] extends (infer T)[] | undefined ? T : never;

const PAGE_SIZE = 10;

const TABS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "paused", label: "Pausados" },
  { value: "draft", label: "Rascunhos" },
  { value: "error", label: "Erros" },
  { value: "low_stock", label: "Estoque baixo" },
  { value: "low_score", label: "Baixa performance" },
] as const;

function ListingsPage() {
  const queryClient = useQueryClient();
  const { data: listings = [], isLoading } = useListings();
  const startJob = useServerFn(startBulkJob);

  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [jobId, setJobId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return (listings as Listing[]).filter((listing: any) => {
      if (tab === "all") return true;
      if (tab === "low_stock") return (listing.stock ?? 0) <= 2;
      if (tab === "low_score") return listing.ai_score != null && listing.ai_score < 50;
      return listing.status === tab;
    });
  }, [listings, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) as any[];
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedListings = (listings as any[]).filter((l) => selected[l.id]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Anúncio excluído");
    },
    onError: () => toast.error("Não foi possível excluir."),
  });

  const startBulk = async (kind: "pause" | "activate" | "delete" | "optimize") => {
    if (!selectedListings.length) return;
    const result = await startJob({
      data: {
        kind,
        items: selectedListings.map((l) => ({ id: l.id, label: l.title })),
      },
    });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    setJobId(result.jobId);
  };

  const copyCodes = async () => {
    const codes = selectedListings.map((l) => l.source_ml_id || l.id);
    await navigator.clipboard.writeText(codes.join("\n"));
    toast.success(`✓ ${codes.length} códigos copiados`);
  };

  const exportCsv = () => {
    const header = "id,titulo,preco,status,estoque,score\n";
    const rows = selectedListings
      .map((l) => [l.id, String(l.title).replace(/,/g, " "), l.price_cents ?? "", l.status, l.stock, l.ai_score ?? ""].join(","))
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meus-anuncios.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  return (
    <AppShell
      title="Meus anúncios"
      description="Rascunhos, otimizações de IA e anúncios prontos para publicar."
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link to="/buscar">
              <Tag className="mr-1.5 h-3.5 w-3.5" /> Copiar do ML
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/editor/$id" params={{ id: "novo" }}>
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Novo anúncio
            </Link>
          </Button>
        </>
      }
    >
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as typeof tab);
          setPage(1);
          setSelected({});
        }}
      >
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="rounded-full border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <Tag className="h-8 w-8 text-muted-foreground" />
              <p className="font-display text-lg font-bold">Nenhum anúncio nesta visão</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Busque produtos no Mercado Livre e copie a estrutura em massa, ou crie um anúncio do
                zero e otimize com a IA.
              </p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link to="/buscar">Buscar e copiar</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/editor/$id" params={{ id: "novo" }}>Criar do zero</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-3 pb-2">
              <Checkbox
                checked={pageItems.length > 0 && pageItems.every((l) => selected[l.id])}
                onCheckedChange={(checked) =>
                  setSelected((prev) => ({
                    ...prev,
                    ...Object.fromEntries(pageItems.map((l) => [l.id, !!checked])),
                  }))
                }
                id="select-page"
              />
              <label htmlFor="select-page" className="text-xs text-muted-foreground">
                Selecionar página ({pageItems.length})
              </label>
            </div>

            <div className="grid gap-3 pb-20">
              {pageItems.map((listing) => (
                <Card key={listing.id}>
                  <CardContent className="flex flex-wrap items-center gap-4 pt-6">
                    <Checkbox
                      checked={!!selected[listing.id]}
                      onCheckedChange={(checked) => setSelected((prev) => ({ ...prev, [listing.id]: !!checked }))}
                    />
                    {getProductImage(listing.images) ? (
                      <img
                        src={getProductImage(listing.images) ?? undefined}
                        alt={listing.title}
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                        Sem imagem
                      </div>
                    )}
                    <div className="min-w-[240px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{listing.title}</span>
                        <Badge variant={listing.status === "active" ? "default" : "outline"}>
                          {listing.status === "draft" ? "rascunho" : listing.status}
                        </Badge>
                        {listing.ai_score != null && (
                          <Badge variant={listing.ai_score < 50 ? "destructive" : "secondary"}>
                            score {listing.ai_score}
                          </Badge>
                        )}
                        {listing.stock <= 2 && <Badge variant="destructive">estoque baixo</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatBRL(listing.price_cents)} · estoque {listing.stock} · criado em{" "}
                        {formatDate(listing.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/editor/$id" params={{ id: listing.id }}>Editar</Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove.mutate(listing.id)}
                        aria-label="Excluir anúncio"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pb-24 text-sm text-muted-foreground">
                <span>
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm font-semibold">{selectedIds.length} anúncios selecionados</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => startBulk("activate")}>
                <Play className="mr-1.5 h-3.5 w-3.5" /> Ativar
              </Button>
              <Button size="sm" variant="outline" onClick={() => startBulk("pause")}>
                <Pause className="mr-1.5 h-3.5 w-3.5" /> Pausar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => startBulk("optimize")}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Otimizar com IA
              </Button>
              <Button size="sm" variant="outline" onClick={copyCodes}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar códigos
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => startBulk("delete")}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      <BulkJobDialog
        jobId={jobId}
        onOpenChange={(open) => !open && setJobId(null)}
        onFinished={() => queryClient.invalidateQueries({ queryKey: ["listings"] })}
      />
    </AppShell>
  );
}
