import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Clipboard, Download, Edit, Eye, Files, Loader2, Search, SearchX, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { BulkJobDialog } from "@/components/app/BulkJobDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { startBulkJob } from "@/lib/bulk.functions";
import { formatBRL } from "@/lib/format";
import { createListingDraft } from "@/lib/listing-create.functions";
import {
  getMercadoLivreItem,
  getMercadoLivreItemFromLink,
  searchMercadoLivre,
  searchMercadoLivreProducts,
  searchMercadoLivreSeller,
} from "@/lib/ml-search-production.functions";
import type { MlItem } from "@/lib/ml.functions";
import { getProductImage } from "@/lib/product-image";
import { listingStatusLabel } from "@/lib/status-labels";

const title = "Buscar e clonar anúncios — ANÚNCIO ML";
const description = "Encontre anúncios por palavra-chave, ID, link ou vendedor e transforme a estrutura em um novo rascunho.";

export const Route = createFileRoute("/_authenticated/buscar")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { name: "robots", content: "noindex" }] }),
  component: SearchPage,
});

type PreviewAction = "import" | "clone";

function conditionLabel(condition: string | null) {
  if (!condition) return null;
  const map: Record<string, string> = { new: "Novo", used: "Usado", refurbished: "Recondicionado" };
  return map[condition] ?? condition;
}

function getItemImages(item: MlItem): string[] {
  const images = (item.images ?? []).filter((image): image is string => typeof image === "string" && image.length > 0);
  if (images.length) return Array.from(new Set(images));
  return item.thumbnail ? [item.thumbnail] : [];
}

function mlDraftData(item: MlItem, dedupeSource: boolean) {
  return {
    title: item.title.replace(/\s*\((?:copy|cópia)\)\s*$/i, "").slice(0, 60),
    price_cents: item.price_cents,
    category: item.category,
    condition: item.condition,
    source_ml_id: dedupeSource ? item.id : null,
    source_permalink: item.permalink,
    images: getItemImages(item),
    attributes: item.attributes ?? [],
    stock: item.available_quantity ?? 1,
    dedupe_source: dedupeSource,
  };
}

function SearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchKeyword = useServerFn(searchMercadoLivre);
  const searchProduct = useServerFn(searchMercadoLivreProducts);
  const searchSeller = useServerFn(searchMercadoLivreSeller);
  const lookupById = useServerFn(getMercadoLivreItem);
  const lookupByLink = useServerFn(getMercadoLivreItemFromLink);
  const startJob = useServerFn(startBulkJob);
  const createDraft = useServerFn(createListingDraft);

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MlItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ item: MlItem; action: PreviewAction } | null>(null);

  const runSearch = useMutation({
    mutationFn: async (raw: string) => {
      const term = raw.trim();
      const upper = term.toUpperCase().replace("-", "");
      if (/^https?:\/\//i.test(term) || /mercadolivre\.com\.br|mercadolibre\.com|meli\.la/i.test(term)) return lookupByLink({ data: { link: term } });
      if (/^MLB\d+$/i.test(upper)) return lookupById({ data: { id: upper } });
      if (/^vendedor\s*:/i.test(term)) return searchSeller({ data: { query: term.replace(/^vendedor\s*:/i, "").trim(), limit: 24 } });
      if (term.startsWith("@")) return searchSeller({ data: { query: term.slice(1).trim(), limit: 24 } });
      if (/^\d{5,}$/.test(term)) return searchSeller({ data: { query: term, limit: 24 } });
      if (/^produto\s*:/i.test(term)) return searchProduct({ data: { query: term.replace(/^produto\s*:/i, "").trim(), limit: 24 } });
      return searchKeyword({ data: { query: term, limit: 24 } });
    },
    onSuccess: (result) => {
      setSearched(true);
      setItems(result.items);
      setSelected({});
      setNotice(result.reason);
      if (result.ok && result.items.length) toast.success(`${result.items.length} resultado(s) encontrado(s)`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível buscar agora."),
  });

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedItems = items.filter((item) => selected[item.id]);

  const createOne = useMutation({
    mutationFn: async ({ item, action }: { item: MlItem; action: PreviewAction }) => {
      const result = await createDraft({ data: mlDraftData(item, action === "import") });
      if (!result.ok) throw new Error(result.reason);
      return { ...result, action };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
      void queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
      setPreview(null);
      toast.success(result.action === "clone" ? "Anúncio clonado como novo rascunho" : result.existed ? "Esse anúncio já estava nos seus rascunhos" : "Anúncio importado para seus rascunhos");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível criar o rascunho."),
  });

  const editOne = useMutation({
    mutationFn: async (item: MlItem) => {
      const result = await createDraft({ data: mlDraftData(item, true) });
      if (!result.ok) throw new Error(result.reason);
      return result.id;
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      await queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
      navigate({ to: "/editor/$id", params: { id } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível abrir o anúncio para edição."),
  });

  const startBulk = async (kind: "copy" | "optimize", scope: MlItem[]) => {
    if (!scope.length) return;
    let jobItems: { id: string; label: string; source?: Record<string, unknown> }[];
    if (kind === "optimize") {
      const mlIds = scope.map((item) => item.id);
      const { data: existing, error } = await supabase.from("listings").select("id,title,source_ml_id").in("source_ml_id", mlIds);
      if (error) return void toast.error("Não foi possível verificar os anúncios já importados.");
      const byMl = new Map((existing ?? []).filter((row) => !!row.source_ml_id).map((row) => [row.source_ml_id as string, { id: row.id, title: row.title }]));
      for (const item of scope.filter((row) => !byMl.has(row.id))) {
        const created = await createDraft({ data: mlDraftData(item, true) });
        if (!created.ok) return void toast.error(created.reason);
        byMl.set(item.id, { id: created.id, title: item.title.slice(0, 60) });
      }
      jobItems = scope.map((item) => byMl.get(item.id)).filter((row): row is { id: string; title: string } => !!row).map((row) => ({ id: row.id, label: row.title }));
    } else {
      jobItems = scope.map((item) => ({ id: item.id, label: item.title, source: { title: item.title, price_cents: item.price_cents, category: item.category, condition: item.condition, permalink: item.permalink, thumbnail: item.thumbnail, images: getItemImages(item), attributes: item.attributes ?? [], available_quantity: item.available_quantity } }));
    }
    const result = await startJob({ data: { kind, items: jobItems } });
    if (!result.ok) return void toast.error(result.reason);
    setJobId(result.jobId);
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(selectedIds.join("\n"));
    toast.success(`${selectedIds.length} código(s) copiado(s)`);
  };

  const exportCsv = () => {
    const header = "id,titulo,preco,categoria,vendedor,condicao\n";
    const rows = selectedItems.map((item) => [item.id, item.title.replace(/,/g, " "), item.price_cents ?? "", item.category ?? "", item.seller ?? "", conditionLabel(item.condition) ?? ""].join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "anuncios-selecionados.csv"; a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  return (
    <AppShell title="Buscar e clonar" description="Encontre um anúncio, confira a estrutura e transforme em rascunho sem sair da plataforma.">
      <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[.10] via-card to-card shadow-sm">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.35fr_.65fr] lg:items-center">
          <div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">BUSCA INTELIGENTE</Badge>
            <h2 className="mt-3 max-w-2xl text-2xl font-extrabold tracking-tight sm:text-3xl">Ache o anúncio que você quer usar como base.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Digite um produto, palavra-chave, código MLB, link ou vendedor. O sistema identifica o tipo de busca automaticamente.</p>
            <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (query.trim().length > 1) runSearch.mutate(query.trim()); }}>
              <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: iPhone 15, MLB123..., link ou @vendedor" className="h-14 rounded-2xl bg-background/90 pl-12 text-base shadow-sm"/></div>
              <Button type="submit" size="lg" className="h-14 rounded-2xl px-8" disabled={runSearch.isPending || query.trim().length < 2}>{runSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}{runSearch.isPending ? "Buscando..." : "Buscar anúncios"}</Button>
            </form>
          </div>
          <div className="grid gap-2 rounded-2xl border border-border/70 bg-background/65 p-4 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Você pode buscar por</p>
            <div className="grid gap-2 text-sm"><span className="rounded-xl bg-muted/60 px-3 py-2">Produto ou palavra-chave</span><span className="rounded-xl bg-muted/60 px-3 py-2">ID do anúncio · MLB123...</span><span className="rounded-xl bg-muted/60 px-3 py-2">Link do Mercado Livre</span><span className="rounded-xl bg-muted/60 px-3 py-2">Vendedor · @NICKNAME</span></div>
          </div>
        </div>
      </section>

      {notice && <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-muted-foreground">{notice}</div>}
      {runSearch.isPending && <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[360px] rounded-3xl"/>)}</div>}
      {!runSearch.isPending && searched && !items.length && <div className="mt-6 flex flex-col items-center gap-2 rounded-3xl border border-dashed bg-muted/20 p-10 text-center text-muted-foreground"><SearchX className="h-9 w-9"/><p className="font-semibold text-foreground">Nenhum anúncio clonável encontrado</p><p className="max-w-lg text-sm">Tente uma descrição mais específica. Você também pode colar o link ou o ID do anúncio para buscar diretamente.</p></div>}

      {!!items.length && <>
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Checkbox checked={selectedIds.length === items.length} onCheckedChange={(checked) => setSelected(checked ? Object.fromEntries(items.map((item) => [item.id, true])) : {})} id="select-all"/><label htmlFor="select-all" className="cursor-pointer text-sm font-semibold">{items.length} anúncio(s) encontrado(s)</label></div><p className="text-xs text-muted-foreground">Selecione vários para clonar ou otimizar em lote.</p></div>
        <div className="mt-3 grid gap-4 pb-28 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => { const image = getProductImage(item); return <Card key={item.id} className="group overflow-hidden rounded-3xl border-border/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"><CardContent className="p-0"><div className="relative aspect-[4/3] overflow-hidden border-b bg-white"><Checkbox checked={!!selected[item.id]} onCheckedChange={(checked) => setSelected((prev) => ({ ...prev, [item.id]: !!checked }))} className="absolute left-3 top-3 z-10 bg-background shadow"/>{image ? <img src={image} alt={item.title} loading="lazy" className="h-full w-full object-contain p-5 transition-transform duration-300 group-hover:scale-[1.03]"/> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem imagem</div>}</div><div className="space-y-4 p-4"><div><p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5">{item.title}</p><p className="mt-2 font-display text-2xl font-extrabold">{formatBRL(item.price_cents)}</p></div><div className="flex flex-wrap gap-1.5">{item.seller&&<Badge variant="outline" className="text-[10px]">{item.seller}</Badge>}{conditionLabel(item.condition)&&<Badge variant="secondary" className="text-[10px]">{conditionLabel(item.condition)}</Badge>}{item.status&&<Badge variant="secondary" className="text-[10px]">{listingStatusLabel(item.status)}</Badge>}</div><div className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2"><span className="font-mono text-[10px] text-muted-foreground">{item.id}</span><Button size="icon" variant="ghost" className="h-7 w-7" onClick={async()=>{await navigator.clipboard.writeText(item.id);toast.success("Código copiado")}} aria-label="Copiar código MLB"><Clipboard className="h-3.5 w-3.5"/></Button></div><Button className="w-full rounded-xl" onClick={() => setPreview({ item, action: "clone" })}><Files className="mr-2 h-4 w-4"/>Clonar este anúncio<ArrowRight className="ml-auto h-4 w-4"/></Button><div className="grid grid-cols-3 gap-2"><Button size="sm" variant="outline" onClick={() => setPreview({ item, action: "import" })}><Eye className="h-3.5 w-3.5"/>Importar</Button><Button size="sm" variant="outline" onClick={() => startBulk("optimize", [item])}><Sparkles className="h-3.5 w-3.5"/>IA</Button><Button size="sm" variant="outline" disabled={editOne.isPending} onClick={() => editOne.mutate(item)}><Edit className="h-3.5 w-3.5"/>Editar</Button></div></div></CardContent></Card>; })}</div>
      </>}

      {!!selectedIds.length && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-2xl backdrop-blur-xl"><div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{selectedIds.length} anúncio(s) selecionado(s)</p><p className="text-xs text-muted-foreground">Ações em lote para acelerar sua operação.</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Button size="sm" onClick={() => startBulk("copy", selectedItems)}><Files className="h-3.5 w-3.5"/>Clonar selecionados</Button><Button size="sm" variant="secondary" onClick={() => startBulk("optimize", selectedItems)}><Sparkles className="h-3.5 w-3.5"/>Otimizar com IA</Button><Button size="sm" variant="outline" onClick={copyCodes}><Clipboard className="h-3.5 w-3.5"/>Códigos</Button><Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5"/>Exportar</Button></div></div></div>}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}><DialogContent className="max-w-xl">{preview&&<><DialogHeader><DialogTitle>Prévia antes de {preview.action === "clone" ? "clonar" : "importar"}</DialogTitle><DialogDescription>Confira os dados antes de criar o rascunho. Uma nova criação consome 1 unidade da sua franquia.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-[160px_1fr]">{getProductImage(preview.item)?<img src={getProductImage(preview.item)??undefined} alt={preview.item.title} className="aspect-square w-full rounded-xl border bg-white object-contain p-2"/>:<div className="flex aspect-square items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">Sem imagem</div>}<div className="space-y-2"><p className="font-semibold leading-5">{preview.item.title}</p><p className="text-2xl font-extrabold">{formatBRL(preview.item.price_cents)}</p><div className="flex flex-wrap gap-1.5">{preview.item.seller&&<Badge variant="outline">{preview.item.seller}</Badge>}{preview.item.category&&<Badge variant="secondary">{preview.item.category}</Badge>}</div><p className="text-xs text-muted-foreground">Estoque retornado: {preview.item.available_quantity ?? "—"} · ID {preview.item.id}</p></div></div><DialogFooter><Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button><Button disabled={createOne.isPending} onClick={() => createOne.mutate(preview)}>{createOne.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<Files className="h-4 w-4"/>}{preview.action === "clone" ? "Confirmar clonagem" : "Confirmar importação"}</Button></DialogFooter></>}</DialogContent></Dialog>
      <BulkJobDialog jobId={jobId} onOpenChange={(open) => !open && setJobId(null)} onFinished={() => { void queryClient.invalidateQueries({ queryKey: ["listings"] }); void queryClient.invalidateQueries({ queryKey: ["ad-quota"] }); }}/>
    </AppShell>
  );
}