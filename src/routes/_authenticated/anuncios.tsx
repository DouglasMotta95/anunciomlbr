import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, AlertTriangle, Copy, Download, ExternalLink, Files, ImagePlus, Loader2, Pause, Play, PlusCircle, Sparkles, Tag, Trash2 } from "lucide-react";
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
import { createAiListingVariants } from "@/lib/listing-variants.functions";
import { getProductImage } from "@/lib/product-image";

const title = "Meus anúncios — ANÚNCIO ML";
const description = "Gerencie rascunhos, ativos, arquivados e otimize seus anúncios com IA antes de publicar.";

export const Route = createFileRoute("/_authenticated/anuncios")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { name: "robots", content: "noindex" }] }),
  component: ListingsPage,
});

type Listing = ReturnType<typeof useListings>["data"] extends (infer T)[] | undefined ? T : never;
type BulkKind = "pause" | "activate" | "archive" | "delete" | "duplicate" | "optimize";
const PAGE_SIZE = 10;
const TABS = [
  { value: "all", label: "Todos" }, { value: "active", label: "Ativos" }, { value: "paused", label: "Pausados" },
  { value: "draft", label: "Rascunhos" }, { value: "closed", label: "Arquivados" }, { value: "error", label: "Erros" },
  { value: "health", label: "Precisam de ajuste" }, { value: "low_stock", label: "Estoque baixo" },
] as const;
const STATUS_LABEL: Record<string, string> = { active: "Ativo", paused: "Pausado", draft: "Rascunho", error: "Erro", closed: "Arquivado", under_review: "Em análise", inactive: "Inativo" };

function healthIssues(listing: any) {
  const issues: string[] = [];
  const images = Array.isArray(listing.images) ? listing.images : [];
  const attributes = Array.isArray(listing.attributes) ? listing.attributes : [];
  if (String(listing.title ?? "").trim().length < 35) issues.push("título curto");
  if (!listing.category) issues.push("categoria ausente");
  if (!String(listing.description ?? "").trim()) issues.push("descrição vazia");
  if (!images.length) issues.push("sem imagem"); else if (images.length < 3) issues.push("poucas imagens");
  if (!attributes.length) issues.push("atributos faltando");
  if (!listing.price_cents || listing.price_cents <= 0) issues.push("preço inválido");
  return issues;
}
function isImportedListing(listing: any) { return Boolean(listing.source_ml_id && listing.published_ml_id && listing.source_ml_id === listing.published_ml_id); }

function ListingsPage() {
  const queryClient = useQueryClient();
  const { data: listings = [], isLoading } = useListings();
  const startJob = useServerFn(startBulkJob);
  const variantsFn = useServerFn(createAiListingVariants);
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [jobId, setJobId] = useState<string | null>(null);

  const filtered = useMemo(() => (listings as Listing[]).filter((listing: any) => {
    if (tab === "all") return true;
    if (tab === "low_stock") return (listing.stock ?? 0) <= 2;
    if (tab === "health") return healthIssues(listing).length > 0;
    return listing.status === tab;
  }), [listings, tab]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) as any[];
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedListings = (listings as any[]).filter((listing) => selected[listing.id]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["listings"] }); toast.success("Anúncio excluído"); },
    onError: () => toast.error("Não foi possível excluir."),
  });

  const variants = useMutation({
    mutationFn: async (count: 5 | 10) => {
      const listing = selectedListings[0];
      if (!listing || selectedListings.length !== 1) throw new Error("Selecione apenas um anúncio.");
      const result = await variantsFn({ data: { listingId: listing.id, count } });
      if (!result.ok) throw new Error(result.reason);
      return result;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "ai-credit-balance" });
      toast.success(`${result.created.length} anúncios criados com IA`, { description: "Os novos rascunhos consumiram a franquia informada e 1 crédito de IA." });
      setSelected({});
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível criar as variações."),
  });

  const startBulk = async (kind: BulkKind, scope: any[] = selectedListings) => {
    if (!scope.length) return;
    if (kind === "optimize") toast.info(`Esta ação usa ${scope.length} crédito(s) de IA — 1 por anúncio selecionado.`);
    if (kind === "duplicate") toast.info(`Esta ação cria ${scope.length} novo(s) rascunho(s) e usa ${scope.length} da sua franquia.`);
    const result = await startJob({ data: { kind, items: scope.map((listing) => ({ id: listing.id, label: listing.title })) } });
    if (!result.ok) return void toast.error(result.reason);
    setJobId(result.jobId);
  };

  const copyCodes = async () => {
    const codes = selectedListings.map((listing) => listing.source_ml_id || listing.id);
    await navigator.clipboard.writeText(codes.join("\n"));
    toast.success(`✓ ${codes.length} códigos copiados`);
  };
  const exportCsv = () => {
    const header = "id,titulo,preco,status,estoque,score\n";
    const rows = selectedListings.map((listing) => [listing.id, String(listing.title).replace(/,/g, " "), listing.price_cents ?? "", STATUS_LABEL[listing.status] ?? listing.status, listing.stock, listing.ai_score ?? ""].join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "meus-anuncios.csv"; anchor.click(); URL.revokeObjectURL(url); toast.success("CSV exportado");
  };

  return <AppShell title="Meus anúncios" description="Status, saúde do anúncio, otimizações de IA e ações em massa em um só lugar." actions={<><Button asChild variant="outline" size="sm"><Link to="/buscar"><Tag className="mr-1.5 h-3.5 w-3.5" />Buscar no ML</Link></Button><Button asChild size="sm"><Link to="/editor/$id" params={{ id: "novo" }}><PlusCircle className="mr-1.5 h-3.5 w-3.5" />Novo anúncio</Link></Button></>}>
    <Tabs value={tab} onValueChange={(value) => { setTab(value as typeof tab); setPage(1); setSelected({}); }}><TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">{TABS.map((item) => <TabsTrigger key={item.value} value={item.value} className="rounded-full border border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">{item.label}</TabsTrigger>)}</TabsList></Tabs>
    <div className="mt-4">
      {isLoading ? <div className="grid gap-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div> : filtered.length === 0 ? <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><Tag className="h-8 w-8 text-muted-foreground" /><p className="font-display text-lg font-bold">Nenhum anúncio nesta visão</p><p className="max-w-md text-sm text-muted-foreground">Busque anúncios no Mercado Livre, copie estruturas ou crie um anúncio do zero.</p><div className="flex gap-2"><Button asChild><Link to="/buscar">Buscar e copiar</Link></Button><Button variant="outline" asChild><Link to="/editor/$id" params={{ id: "novo" }}>Criar do zero</Link></Button></div></CardContent></Card> : <>
        <div className="flex items-center gap-3 pb-2"><Checkbox checked={pageItems.length > 0 && pageItems.every((listing) => selected[listing.id])} onCheckedChange={(checked) => setSelected((prev) => ({ ...prev, ...Object.fromEntries(pageItems.map((listing) => [listing.id, !!checked])) }))} id="select-page" /><label htmlFor="select-page" className="text-xs text-muted-foreground">Selecionar página ({pageItems.length})</label></div>
        <div className="grid gap-3 pb-24">{pageItems.map((listing) => {
          const issues = healthIssues(listing); const optimized = Number(listing.ai_score ?? 0) > 0; const imageIssue = issues.includes("sem imagem") || issues.includes("poucas imagens"); const imported = isImportedListing(listing);
          return <Card key={listing.id} className={issues.length ? "border-amber-500/25" : ""}><CardContent className="space-y-3 pt-6"><div className="flex flex-wrap items-center gap-4"><Checkbox checked={!!selected[listing.id]} onCheckedChange={(checked) => setSelected((prev) => ({ ...prev, [listing.id]: !!checked }))} />{getProductImage(listing.images) ? <img src={getProductImage(listing.images) ?? undefined} alt={listing.title} loading="lazy" className="h-16 w-16 shrink-0 rounded-md object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">Sem imagem</div>}<div className="min-w-[240px] flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{listing.title}</span><Badge variant={listing.status === "active" ? "default" : "outline"}>{STATUS_LABEL[listing.status] ?? "Status desconhecido"}</Badge><Badge variant="outline">{imported ? "Importado do Mercado Livre" : "Criado no ANÚNCIO ML"}</Badge>{optimized && <Badge variant="secondary"><Sparkles className="mr-1 h-3 w-3" />Otimizado</Badge>}{listing.stock <= 2 && <Badge variant="destructive">Estoque baixo</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{formatBRL(listing.price_cents)} · estoque {listing.stock} · adicionado em {formatDate(listing.created_at)}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link to="/editor/$id" params={{ id: listing.id }}>Editar</Link></Button><Button size="sm" variant="secondary" onClick={() => void startBulk("duplicate", [listing])} title="Cria um novo rascunho e usa 1 da franquia"><Files className="mr-1.5 h-3.5 w-3.5" />Duplicar</Button>{listing.source_permalink && <Button size="sm" variant="outline" asChild><a href={listing.source_permalink} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Ver no Mercado Livre</a></Button>}<Button size="icon" variant="ghost" onClick={() => remove.mutate(listing.id)} aria-label="Excluir anúncio"><Trash2 className="h-4 w-4" /></Button></div></div>{issues.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[.05] p-3"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div><p className="text-xs font-semibold">Saúde do anúncio: {issues.length} ponto(s) para corrigir</p><p className="mt-1 text-xs text-muted-foreground">{issues.join(" · ")}</p></div></div><div className="flex flex-wrap gap-2">{imageIssue && <Button size="sm" asChild><Link to="/editor/$id" params={{ id: listing.id }}><ImagePlus className="mr-1.5 h-3.5 w-3.5" />Gerar imagem com IA</Link></Button>}<Button size="sm" variant="outline" asChild><Link to="/editor/$id" params={{ id: listing.id }}>{imageIssue ? "Outros ajustes" : "Corrigir no editor"}</Link></Button></div></div> : <div className="rounded-xl bg-emerald-500/[.06] p-3 text-xs font-medium text-emerald-700">Saúde básica em dia: nenhum alerta estrutural detectado.</div>}</CardContent></Card>;
        })}</div>
        {totalPages > 1 && <div className="flex items-center justify-between pb-24 text-sm text-muted-foreground"><span>Página {page} de {totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Próxima</Button></div></div>}
      </>}
    </div>
    {selectedIds.length > 0 && <div className="fixed inset-x-0 bottom-20 z-40 max-h-[55vh] overflow-y-auto border-t border-border bg-card/95 shadow-2xl backdrop-blur lg:bottom-0 lg:max-h-none"><div className="mx-auto max-w-6xl px-4 py-3 sm:px-6"><div className="mb-3 rounded-xl border border-primary/15 bg-primary/[.04] px-3 py-2 text-xs text-muted-foreground"><strong className="text-foreground">Antes de executar:</strong> duplicar usa {selectedIds.length} anúncio(s) da franquia; otimizar usa {selectedIds.length} crédito(s) de IA.</div><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">{selectedIds.length} anúncio(s) selecionado(s)</p><p className="text-xs text-muted-foreground">Ações ficam acima da navegação no celular.</p></div><div className="flex flex-wrap gap-2">{selectedIds.length === 1 && <><Button size="sm" variant="secondary" disabled={variants.isPending} onClick={() => variants.mutate(5)}>{variants.isPending && variants.variables === 5 ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}Criar 5 · 5 franquia + 1 IA</Button><Button size="sm" variant="secondary" disabled={variants.isPending} onClick={() => variants.mutate(10)}>{variants.isPending && variants.variables === 10 ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}Criar 10 · 10 franquia + 1 IA</Button></>}<Button size="sm" onClick={() => void startBulk("duplicate")}><Files className="mr-1.5 h-3.5 w-3.5" />Duplicar · {selectedIds.length} franquia</Button><Button size="sm" variant="secondary" onClick={() => void startBulk("optimize")}><Sparkles className="mr-1.5 h-3.5 w-3.5" />Otimizar · {selectedIds.length} IA</Button><Button size="sm" variant="outline" onClick={() => void startBulk("activate")}><Play className="mr-1.5 h-3.5 w-3.5" />Ativar</Button><Button size="sm" variant="outline" onClick={() => void startBulk("pause")}><Pause className="mr-1.5 h-3.5 w-3.5" />Pausar</Button><Button size="sm" variant="outline" onClick={() => void startBulk("archive")}><Archive className="mr-1.5 h-3.5 w-3.5" />Arquivar</Button><Button size="sm" variant="outline" onClick={() => void copyCodes()}><Copy className="mr-1.5 h-3.5 w-3.5" />Códigos</Button><Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-1.5 h-3.5 w-3.5" />Exportar</Button><Button size="sm" variant="destructive" onClick={() => void startBulk("delete")}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button></div></div></div></div>}
    <BulkJobDialog jobId={jobId} onOpenChange={(open) => !open && setJobId(null)} onFinished={() => { setSelected({}); void queryClient.invalidateQueries({ queryKey: ["listings"] }); void queryClient.invalidateQueries({ queryKey: ["ad-quota"] }); void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "ai-credit-balance" }); }} />
  </AppShell>;
}
