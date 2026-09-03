import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clipboard, Download, Edit, ExternalLink, Eye, Files, Loader2, Search, SearchX, ShoppingCart, Sparkles, Store } from "lucide-react";
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
import { searchMercadoLivrePublicAds } from "@/lib/ml-public-search.functions";
import { normalizeSearchTerm, parseMlSearchInput } from "@/lib/ml-search-input";
import {
  getMercadoLivreItem,
  getMercadoLivreItemDescription,
  getMercadoLivreItemFromLink,
  searchMercadoLivreProducts,
  searchMercadoLivreSeller,
  type SearchMlItem,
} from "@/lib/ml-search-production.functions";
import type { MlItem } from "@/lib/ml.functions";
import { getProductImage } from "@/lib/product-image";
import { listingStatusLabel } from "@/lib/status-labels";

const title = "Buscar e copiar anúncios — ANÚNCIO ML";
const description = "Encontre anúncios reais do Mercado Livre, confira dados confirmados e crie sua própria cópia editável.";

export const Route = createFileRoute("/_authenticated/buscar")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { name: "robots", content: "noindex" }] }),
  component: SearchPage,
});

type DisplayItem = SearchMlItem;
type PreviewAction = "copy" | "import";
type SearchRequest = { raw: string; forceSeller?: boolean };
type DuplicatedDraft = { id: string; title: string };

function conditionLabel(condition: string | null) {
  if (!condition) return "Não informado";
  const map: Record<string, string> = { new: "Novo", used: "Usado", refurbished: "Recondicionado" };
  return map[condition] ?? "Não informado";
}

function getItemImages(item: MlItem): string[] {
  const images = (item.images ?? [])
    .map((image: any) => typeof image === "string" ? image : image?.secure_url ?? image?.url ?? null)
    .filter((image): image is string => typeof image === "string" && image.length > 0);
  if (images.length) return Array.from(new Set(images));
  return item.thumbnail ? [item.thumbnail] : [];
}

function mlDraftData(item: DisplayItem, dedupeSource: boolean) {
  return {
    title: item.title.replace(/\s*\((?:copy|cópia)\)\s*$/i, "").slice(0, 60),
    description: item.description ?? null,
    price_cents: item.price_cents,
    category: item.category,
    condition: item.condition,
    source_ml_id: dedupeSource ? item.id : null,
    source_permalink: item.permalink,
    images: getItemImages(item),
    attributes: item.attributes ?? [],
    stock: typeof item.available_quantity === "number" ? item.available_quantity : 1,
    dedupe_source: dedupeSource,
  };
}

function SearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchKeyword = useServerFn(searchMercadoLivrePublicAds);
  const searchProduct = useServerFn(searchMercadoLivreProducts);
  const searchSeller = useServerFn(searchMercadoLivreSeller);
  const lookupById = useServerFn(getMercadoLivreItem);
  const lookupByLink = useServerFn(getMercadoLivreItemFromLink);
  const loadDescription = useServerFn(getMercadoLivreItemDescription);
  const startJob = useServerFn(startBulkJob);
  const createDraft = useServerFn(createListingDraft);

  const [query, setQuery] = useState("");
  const [resultLimit, setResultLimit] = useState(20);
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ item: DisplayItem; action: PreviewAction } | null>(null);
  const [details, setDetails] = useState<DisplayItem | null>(null);
  const [detailsReason, setDetailsReason] = useState<string | null>(null);
  const [duplicatedDrafts, setDuplicatedDrafts] = useState<Record<string, DuplicatedDraft>>({});

  const runSearch = useMutation({
    mutationFn: async ({ raw, forceSeller = false }: SearchRequest) => {
      const term = raw.trim();
      if (forceSeller) return searchSeller({ data: { query: term.replace(/^@/, ""), limit: resultLimit } });
      if (/^produto\s*:/i.test(term)) return searchProduct({ data: { query: term.replace(/^produto\s*:/i, "").trim(), limit: resultLimit } });

      const parsed = parseMlSearchInput(term);
      console.info("[ML search input]", { type: parsed.type });
      switch (parsed.type) {
        case "item_id": return lookupById({ data: { id: parsed.itemId! } });
        case "item_url": return parsed.itemId ? lookupById({ data: { id: parsed.itemId } }) : lookupByLink({ data: { link: parsed.normalizedUrl ?? term, limit: resultLimit } });
        case "product_id":
        case "product_url":
        case "short_url":
        case "seller_url": return lookupByLink({ data: { link: parsed.normalizedUrl ?? term, limit: resultLimit } });
        case "seller_id": return searchSeller({ data: { query: parsed.sellerId!, limit: resultLimit } });
        case "seller_nickname": return searchSeller({ data: { query: parsed.sellerNickname!, limit: resultLimit } });
        default: return searchKeyword({ data: { query: parsed.searchQuery ?? term, limit: resultLimit } });
      }
    },
    onSuccess: (result) => {
      setSearched(true);
      setItems(result.items as DisplayItem[]);
      setSelected({});
      setDuplicatedDrafts({});
      setNotice(result.ok ? null : result.reason);
      if (result.ok && result.items.length) toast.success(`${result.items.length} anúncio(s) encontrado(s)`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível buscar agora."),
  });

  async function loadFullItem(item: DisplayItem) {
    let full = item;
    const detail = await lookupById({ data: { id: item.id } }).catch(() => null);
    if (detail?.items?.[0]) full = { ...item, ...(detail.items[0] as DisplayItem) };
    const description = await loadDescription({ data: { id: item.id } }).catch(() => null);
    if (description?.description) full = { ...full, description: description.description };
    return full;
  }

  const openDetails = useMutation({
    mutationFn: async (item: DisplayItem) => {
      const detail = await lookupById({ data: { id: item.id } }).catch(() => null);
      const description = await loadDescription({ data: { id: item.id } }).catch(() => null);
      return {
        item: detail?.items?.[0]
          ? { ...item, ...(detail.items[0] as DisplayItem), description: description?.description ?? null }
          : { ...item, description: description?.description ?? null },
        reason: description?.reason ?? (description?.description ? null : "Não foi possível carregar a descrição agora."),
      };
    },
    onMutate: (item) => { setDetails(item); setDetailsReason(null); },
    onSuccess: (result) => { setDetails(result.item); setDetailsReason(result.reason); },
    onError: () => setDetailsReason("Não foi possível carregar os detalhes adicionais agora."),
  });

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedItems = items.filter((item) => selected[item.id]);

  const createOne = useMutation({
    mutationFn: async ({ item, action }: { item: DisplayItem; action: PreviewAction }) => {
      const full = await loadFullItem(item);
      if (full.price_cents == null) throw new Error("Este anúncio existe no Mercado Livre, mas o preço ainda não pôde ser confirmado. Tente novamente em instantes ou abra o anúncio no Mercado Livre.");
      const result = await createDraft({ data: mlDraftData(full, action === "import") });
      if (!result.ok || !result.id) throw new Error(result.ok ? "O rascunho não retornou um identificador válido." : result.reason);
      return { ...result, action, sourceId: item.id, title: full.title.slice(0, 60) };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      await queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
      setPreview(null);
      setDuplicatedDrafts((current) => ({ ...current, [result.sourceId]: { id: result.id, title: result.title } }));
      toast.success(result.existed ? "Esse anúncio já existia no painel" : "Duplicação criada e confirmada", {
        description: "O novo anúncio está salvo no painel e pode ser aberto para edição.",
        action: { label: "Abrir cópia", onClick: () => navigate({ to: "/editor/$id", params: { id: result.id } }) },
      });
    },
    onError: (error) => toast.error("Duplicação não concluída", { description: error instanceof Error ? error.message : "Não foi possível criar o anúncio no painel." }),
  });

  const editOne = useMutation({
    mutationFn: async (item: DisplayItem) => {
      const full = await loadFullItem(item);
      if (full.price_cents == null) throw new Error("Este anúncio existe no Mercado Livre, mas o preço ainda não pôde ser confirmado para criar a cópia.");
      const result = await createDraft({ data: mlDraftData(full, true) });
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

  const startBulk = async (kind: "copy" | "optimize", scope: DisplayItem[]) => {
    const complete = scope.filter((item) => item.price_cents != null);
    if (!complete.length) return void toast.error("Nenhum anúncio selecionado possui preço completo.");
    let jobItems: { id: string; label: string; source?: Record<string, unknown> }[];
    if (kind === "optimize") {
      const mlIds = complete.map((item) => item.id);
      const { data: existing, error } = await supabase.from("listings").select("id,title,source_ml_id").in("source_ml_id", mlIds);
      if (error) return void toast.error("Não foi possível verificar os anúncios já importados.");
      const byMl = new Map((existing ?? []).filter((row) => !!row.source_ml_id).map((row) => [row.source_ml_id as string, { id: row.id, title: row.title }]));
      for (const item of complete.filter((row) => !byMl.has(row.id))) {
        const full = await loadFullItem(item);
        const created = await createDraft({ data: mlDraftData(full, true) });
        if (!created.ok) return void toast.error(created.reason);
        byMl.set(item.id, { id: created.id, title: item.title.slice(0, 60) });
      }
      jobItems = complete.map((item) => byMl.get(item.id)).filter((row): row is { id: string; title: string } => !!row).map((row) => ({ id: row.id, label: row.title }));
    } else {
      jobItems = complete.map((item) => ({ id: item.id, label: item.title, source: { title: item.title, description: item.description ?? null, price_cents: item.price_cents, category: item.category, condition: item.condition, permalink: item.permalink, thumbnail: item.thumbnail, images: getItemImages(item), attributes: item.attributes ?? [], available_quantity: item.available_quantity } }));
    }
    const result = await startJob({ data: { kind, items: jobItems } });
    if (!result.ok) return void toast.error(result.reason);
    setJobId(result.jobId);
  };

  const copyCodes = async () => { await navigator.clipboard.writeText(selectedIds.join("\n")); toast.success(`${selectedIds.length} código(s) copiado(s)`); };
  const exportCsv = () => {
    const header = "id,titulo,preco,vendas,categoria,vendedor,condicao\n";
    const rows = selectedItems.map((item) => [item.id, item.title.replace(/,/g, " "), item.price_cents ?? "", item.verified_item ? item.sold_quantity ?? "" : "", item.category ?? "", item.seller ?? "", conditionLabel(item.condition)].join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "anuncios-mercado-livre.csv"; a.click(); URL.revokeObjectURL(url); toast.success("CSV exportado");
  };
  const searchSellerFromCard = (item: DisplayItem) => { const value = item.seller_id ?? item.seller; if (!value) return; setQuery(item.seller ? `@${item.seller}` : String(value)); runSearch.mutate({ raw: String(value), forceSeller: true }); };
  const marketplaceSearchUrl = query.trim() ? `https://lista.mercadolivre.com.br/${normalizeSearchTerm(query.trim())}` : null;

  return (
    <AppShell title="Buscar e copiar" description="Pesquise anúncios reais do Mercado Livre, confira os dados e crie uma cópia editável.">
      <section className="overflow-hidden rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/15 via-card to-card shadow-sm">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.35fr_.65fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge className="bg-yellow-400 text-black hover:bg-yellow-400">ANÚNCIOS DO MERCADO LIVRE</Badge><Badge variant="outline">BUSCA PÚBLICA</Badge></div>
            <h2 className="mt-3 max-w-2xl text-2xl font-extrabold tracking-tight sm:text-3xl">Pesquise como no Mercado Livre e duplique o anúncio que interessa.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Digite qualquer produto, marca ou modelo. O sistema filtra anúncios reais, ativos e relacionados à sua pesquisa, priorizando os resultados mais completos.</p>
            <form className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]" onSubmit={(event) => { event.preventDefault(); if (query.trim().length > 1) runSearch.mutate({ raw: query.trim() }); }}>
              <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite um produto, marca, modelo, código MLB, link ou vendedor" className="h-14 rounded-2xl bg-background/95 pl-12 text-base shadow-sm"/></div>
              <label className="sr-only" htmlFor="result-limit">Quantidade de resultados</label><select id="result-limit" value={resultLimit} onChange={e=>setResultLimit(Number(e.target.value))} className="h-14 rounded-2xl border bg-background px-3 text-sm font-semibold shadow-sm"><option value={20}>20 resultados</option><option value={50}>50 resultados</option></select>
              <Button type="submit" size="lg" className="h-14 rounded-2xl bg-yellow-400 px-6 text-black hover:bg-yellow-300" disabled={runSearch.isPending || query.trim().length < 2}>{runSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}{runSearch.isPending ? "Buscando..." : "Buscar"}</Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">Preço, vendas, estoque e situação só aparecem quando há confirmação nas fontes do Mercado Livre.</p>
          </div>
          <div className="grid gap-2 rounded-2xl border border-yellow-400/20 bg-background/75 p-4 backdrop-blur"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Você pode pesquisar por</p><div className="grid gap-2 text-sm"><span className="rounded-xl bg-muted/60 px-3 py-2">Produto, marca ou modelo</span><span className="rounded-xl bg-muted/60 px-3 py-2">Código do anúncio · MLB123...</span><span className="rounded-xl bg-muted/60 px-3 py-2">Link do Mercado Livre</span><span className="rounded-xl bg-muted/60 px-3 py-2">Nome ou código do vendedor</span></div></div>
        </div>
      </section>

      {notice && <div className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-4 text-sm leading-6 text-muted-foreground">{notice}</div>}
      {runSearch.isPending && <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[450px] rounded-3xl"/>)}</div>}
      {!runSearch.isPending && searched && !items.length && <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-muted/20 p-10 text-center text-muted-foreground"><SearchX className="h-9 w-9"/><p className="font-semibold text-foreground">Nenhum anúncio ativo e confirmado encontrado</p><p className="max-w-lg text-sm">Tente outro produto, marca, modelo, vendedor, link ou código MLB.</p>{marketplaceSearchUrl&&<Button variant="outline" asChild><a href={marketplaceSearchUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4"/>Abrir esta busca no Mercado Livre</a></Button>}</div>}

      {!!items.length && <>
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><Checkbox checked={selectedIds.length === items.length} onCheckedChange={(checked) => setSelected(checked ? Object.fromEntries(items.map((item) => [item.id, true])) : {})} id="select-all"/><label htmlFor="select-all" className="cursor-pointer text-sm font-semibold">{items.length} anúncio(s) encontrado(s)</label></div><div className="flex items-center gap-2"><p className="text-xs text-muted-foreground">Somente anúncios reais, ativos e confirmados.</p>{marketplaceSearchUrl&&<Button size="sm" variant="outline" asChild><a href={marketplaceSearchUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5"/>Comparar no ML</a></Button>}</div></div>
        <div className="mt-3 grid gap-4 pb-28 sm:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => {
          const image = getProductImage(item);
          const hasSales = item.verified_item === true && item.sold_quantity != null;
          const duplicated = duplicatedDrafts[item.id];
          return <Card key={item.id} className="group overflow-hidden rounded-3xl border-border/70 transition-all duration-300 hover:-translate-y-1 hover:border-yellow-400/60 hover:shadow-lg"><CardContent className="p-0">
            <div className="relative aspect-[4/3] overflow-hidden border-b bg-white"><Checkbox checked={!!selected[item.id]} onCheckedChange={(checked) => setSelected((prev) => ({ ...prev, [item.id]: !!checked }))} className="absolute left-3 top-3 z-10 bg-background shadow"/>{image ? <img src={image} alt={item.title} loading={index < 4 ? "eager" : "lazy"} className="h-full w-full object-contain p-5 transition-transform duration-300 group-hover:scale-[1.03]"/> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Imagem indisponível</div>}</div>
            <div className="space-y-4 p-4">
              <div><div className="mb-2 flex items-center justify-between gap-2"><div className="flex flex-wrap gap-1.5"><Badge variant="outline" className="text-[10px]">{item.verified_item ? "Anúncio confirmado" : "Anúncio público"}</Badge>{item.source_kind === "catalog_offer" && <Badge className="bg-sky-500/15 text-sky-700 hover:bg-sky-500/15">Oferta de catálogo</Badge>}</div>{hasSales && <span className="flex items-center gap-1 text-xs font-semibold"><ShoppingCart className="h-3.5 w-3.5"/>{item.sold_quantity} venda(s)</span>}</div><p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5">{item.title}</p><p className="mt-2 font-display text-2xl font-extrabold">{item.price_cents == null ? <span className="text-base text-muted-foreground">Preço não disponível</span> : formatBRL(item.price_cents)}</p></div>
              {(item.seller || item.seller_id || item.condition || item.status) && <div className="flex flex-wrap gap-1.5">{(item.seller||item.seller_id)&&<Button type="button" size="sm" variant="outline" className="h-7 rounded-full px-2 text-[10px]" onClick={()=>searchSellerFromCard(item)}><Store className="mr-1 h-3 w-3"/>{item.seller??`Vendedor ${item.seller_id}`}</Button>}{item.condition&&<Badge variant="secondary" className="text-[10px]">{conditionLabel(item.condition)}</Badge>}{item.status&&<Badge variant="secondary" className="text-[10px]">{listingStatusLabel(item.status)}</Badge>}</div>}
              {item.available_quantity!=null&&<div className="rounded-xl bg-muted/50 p-3 text-xs"><b>Estoque:</b> {item.available_quantity}</div>}
              <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2"><span className="font-mono text-[10px] text-muted-foreground">{item.id}</span><Button size="icon" variant="ghost" className="h-7 w-7" onClick={async()=>{await navigator.clipboard.writeText(item.id);toast.success("Código copiado")}} aria-label="Copiar código MLB"><Clipboard className="h-3.5 w-3.5"/></Button></div>
              {duplicated && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[.06] p-3"><p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>Duplicação criada no painel</p><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{duplicated.title}</p><Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => navigate({ to: "/editor/$id", params: { id: duplicated.id } })}><Edit className="mr-2 h-3.5 w-3.5"/>Abrir cópia para editar</Button></div>}
              <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" disabled={!item.permalink} asChild={!!item.permalink}>{item.permalink ? <a href={item.permalink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5"/>Ver anúncio</a> : <><ExternalLink className="h-3.5 w-3.5"/>Ver anúncio</>}</Button><Button size="sm" className="bg-yellow-400 text-black hover:bg-yellow-300" disabled={createOne.isPending} onClick={() => setPreview({ item, action: "copy" })}><Files className="h-3.5 w-3.5"/>Duplicar anúncio</Button></div>
              <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="ghost" onClick={() => openDetails.mutate(item)}><Eye className="h-3.5 w-3.5"/>Ver detalhes</Button><Button size="sm" variant="ghost" disabled={editOne.isPending} onClick={() => editOne.mutate(item)}><Edit className="h-3.5 w-3.5"/>Editar antes</Button></div>
            </div>
          </CardContent></Card>;
        })}</div>
      </>}

      {!!selectedIds.length && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-2xl backdrop-blur-xl"><div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{selectedIds.length} anúncio(s) selecionado(s)</p><p className="text-xs text-muted-foreground">Copie ou analise vários anúncios de uma vez.</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Button size="sm" className="bg-yellow-400 text-black hover:bg-yellow-300" onClick={() => startBulk("copy", selectedItems)}><Files className="h-3.5 w-3.5"/>Copiar selecionados</Button><Button size="sm" variant="secondary" onClick={() => startBulk("optimize", selectedItems)}><Sparkles className="h-3.5 w-3.5"/>Otimizar com IA</Button><Button size="sm" variant="outline" onClick={copyCodes}><Clipboard className="h-3.5 w-3.5"/>Códigos</Button><Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5"/>Exportar</Button></div></div></div>}

      <Dialog open={!!details} onOpenChange={(open) => { if(!open){setDetails(null);setDetailsReason(null);} }}><DialogContent className="max-w-2xl">{details&&<><DialogHeader><DialogTitle>Detalhes do anúncio</DialogTitle><DialogDescription>Informações retornadas pelo Mercado Livre para esta oferta.</DialogDescription></DialogHeader>{openDetails.isPending?<div className="space-y-4"><Skeleton className="h-48 w-full rounded-2xl"/><Skeleton className="h-28 w-full rounded-2xl"/></div>:<><div className="grid gap-5 sm:grid-cols-[190px_1fr]">{getProductImage(details)?<img src={getProductImage(details)??undefined} alt={details.title} className="aspect-square w-full rounded-xl border bg-white object-contain p-3"/>:<div className="flex aspect-square items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">Sem imagem</div>}<div className="space-y-3"><p className="font-semibold leading-5">{details.title}</p><p className="text-2xl font-extrabold">{details.price_cents == null ? "Preço não disponível" : formatBRL(details.price_cents)}</p><div className="flex flex-wrap gap-1.5">{details.seller&&<Badge variant="outline">{details.seller}</Badge>}{details.source_kind === "catalog_offer"&&<Badge variant="secondary">Oferta de catálogo</Badge>}{details.condition&&<Badge variant="secondary">{conditionLabel(details.condition)}</Badge>}{details.verified_item&&details.sold_quantity!=null&&<Badge className="bg-yellow-400 text-black">{details.sold_quantity} vendas</Badge>}</div><p className="text-xs text-muted-foreground">ID {details.id}{details.available_quantity!=null?` · Estoque ${details.available_quantity}`:""}</p></div></div><div className="rounded-2xl border bg-muted/20 p-4"><p className="mb-2 text-sm font-bold">Descrição do anúncio</p>{details.description?<p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{details.description}</p>:<p className="text-sm text-muted-foreground">{detailsReason??"Este anúncio não possui descrição disponível."}</p>}</div></>}<DialogFooter>{details.permalink&&<Button variant="outline" asChild><a href={details.permalink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4"/>Ver anúncio</a></Button>}<Button disabled={openDetails.isPending} onClick={() => { setDetails(null); setPreview({ item: details, action: "copy" }); }} className="bg-yellow-400 text-black hover:bg-yellow-300"><Files className="h-4 w-4"/>Duplicar anúncio</Button></DialogFooter></>}</DialogContent></Dialog>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}><DialogContent className="max-w-xl">{preview&&<><DialogHeader><DialogTitle>Confirmar duplicação do anúncio</DialogTitle><DialogDescription>O sistema cria um novo rascunho editável no painel. Se algum dado essencial ainda estiver ausente, tentamos carregá-lo novamente antes de criar a cópia e mostramos o motivo se não for possível.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-[160px_1fr]">{getProductImage(preview.item)?<img src={getProductImage(preview.item)??undefined} alt={preview.item.title} className="aspect-square w-full rounded-xl border bg-white object-contain p-2"/>:<div className="flex aspect-square items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">Sem imagem</div>}<div className="space-y-2"><p className="font-semibold leading-5">{preview.item.title}</p><p className="text-2xl font-extrabold">{preview.item.price_cents == null ? "Preço será confirmado ao duplicar" : formatBRL(preview.item.price_cents)}</p><div className="flex flex-wrap gap-1.5">{preview.item.seller&&<Badge variant="outline">{preview.item.seller}</Badge>}{preview.item.source_kind === "catalog_offer"&&<Badge variant="secondary">Oferta de catálogo</Badge>}{preview.item.verified_item&&preview.item.sold_quantity!=null&&<Badge className="bg-yellow-400 text-black">{preview.item.sold_quantity} vendas</Badge>}</div><p className="text-xs text-muted-foreground">{preview.item.available_quantity!=null?`Estoque retornado: ${preview.item.available_quantity}`:"Estoque não informado; o novo rascunho começará com 1 unidade para edição."} · ID {preview.item.id}</p></div></div><DialogFooter><Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button><Button disabled={createOne.isPending} onClick={() => createOne.mutate(preview)} className="bg-yellow-400 text-black hover:bg-yellow-300">{createOne.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<Files className="h-4 w-4"/>}{createOne.isPending?"Criando duplicação...":"Duplicar anúncio"}</Button></DialogFooter></>}</DialogContent></Dialog>
      <BulkJobDialog jobId={jobId} onOpenChange={(open) => !open && setJobId(null)} onFinished={() => { void queryClient.invalidateQueries({ queryKey: ["listings"] }); void queryClient.invalidateQueries({ queryKey: ["ad-quota"] }); }}/>
    </AppShell>
  );
}
