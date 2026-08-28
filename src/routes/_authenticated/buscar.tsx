import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Clipboard,
  Copy,
  Download,
  Edit,
  Files,
  Hash,
  Link2,
  Loader2,
  PackageSearch,
  Search,
  SearchX,
  Sparkles,
  Store,
  Tags,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { BulkJobDialog } from "@/components/app/BulkJobDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/lib/ml-search-fixed.functions";
import type { MlItem } from "@/lib/ml.functions";
import { getProductImage } from "@/lib/product-image";
import { listingStatusLabel } from "@/lib/status-labels";

const title = "Buscar e clonar anúncios — ANÚNCIO ML";
const description =
  "Encontre anúncios do Mercado Livre por palavra-chave, produto, ID, link ou vendedor e clone a estrutura em um novo rascunho.";

export const Route = createFileRoute("/_authenticated/buscar")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SearchPage,
});

type Mode = "keyword" | "produto" | "id" | "link" | "vendedor";

const MODE_OPTIONS = [
  { value: "keyword" as const, label: "Palavra-chave", short: "Anúncios relacionados", placeholder: "Ex.: fone bluetooth, air fryer", icon: Tags },
  { value: "produto" as const, label: "Produto", short: "Produto de catálogo", placeholder: "Ex.: iPhone 15 128GB", icon: PackageSearch },
  { value: "id" as const, label: "ID do anúncio", short: "Busca exata por MLB", placeholder: "Ex.: MLB1234567890", icon: Hash },
  { value: "link" as const, label: "Link", short: "Cole a URL do anúncio", placeholder: "https://produto.mercadolivre.com.br/...", icon: Link2 },
  { value: "vendedor" as const, label: "Vendedor", short: "Nickname ou ID", placeholder: "Ex.: LOJAOFICIAL ou 123456789", icon: Store },
] satisfies Array<{ value: Mode; label: string; short: string; placeholder: string; icon: typeof Search }>;

function conditionLabel(condition: string | null): string | null {
  if (!condition) return null;
  const map: Record<string, string> = { new: "Novo", used: "Usado", refurbished: "Recondicionado" };
  return map[condition] ?? condition;
}

function getItemImages(item: MlItem): string[] {
  const images = (item.images ?? []).filter(
    (image): image is string => typeof image === "string" && image.length > 0,
  );
  if (images.length > 0) return Array.from(new Set(images));
  return item.thumbnail ? [item.thumbnail] : [];
}

/**
 * Espelha os dados disponíveis no anúncio de origem. A clonagem mantém preço,
 * categoria, condição, imagens, atributos e estoque retornados pela API, mas
 * cria um novo rascunho independente dentro do ANÚNCIO ML.
 */
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

  const [mode, setMode] = useState<Mode>("keyword");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MlItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const runSearch = useMutation({
    mutationFn: async (term: string) => {
      if (mode === "id") return lookupById({ data: { id: term.toUpperCase().replace("-", "") } });
      if (mode === "link") return lookupByLink({ data: { link: term } });
      if (mode === "vendedor") return searchSeller({ data: { query: term, limit: 24 } });
      if (mode === "produto") return searchProduct({ data: { query: term, limit: 24 } });
      return searchKeyword({ data: { query: term, limit: 24 } });
    },
    onSuccess: (result) => {
      setSearched(true);
      setItems(result.items);
      setSelected({});
      setNotice(result.ok ? null : result.reason);
      if (result.ok && result.items.length > 0) toast.success(`${result.items.length} resultado(s) encontrado(s)`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível buscar agora."),
  });

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedItems = items.filter((item) => selected[item.id]);

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  };

  const copyOne = useMutation({
    mutationFn: async (item: MlItem) => {
      const result = await createDraft({ data: mlDraftData(item, true) });
      if (!result.ok) throw new Error(result.reason);
      return { id: result.id, existed: result.existed };
    },
    onSuccess: ({ existed }) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
      toast.success(existed ? "Esse anúncio já estava nos seus rascunhos" : "Anúncio importado para seus rascunhos");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao importar anúncio."),
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

  const duplicateOne = useMutation({
    mutationFn: async (item: MlItem) => {
      const result = await createDraft({ data: mlDraftData(item, false) });
      if (!result.ok) throw new Error(result.reason);
      return result.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
      toast.success("Anúncio clonado como novo rascunho");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao clonar anúncio."),
  });

  const startBulk = async (kind: "copy" | "optimize", scope: MlItem[]) => {
    if (!scope.length) return;
    let jobItems: { id: string; label: string; source?: Record<string, unknown> }[];

    if (kind === "optimize") {
      const mlIds = scope.map((item) => item.id);
      const { data: existing, error: existingError } = await supabase
        .from("listings")
        .select("id, title, source_ml_id")
        .in("source_ml_id", mlIds);
      if (existingError) {
        toast.error("Não foi possível verificar os anúncios já importados.");
        return;
      }

      const existingByMlId = new Map(
        (existing ?? [])
          .filter((row) => !!row.source_ml_id)
          .map((row) => [row.source_ml_id as string, { id: row.id, title: row.title }]),
      );
      const missing = scope.filter((item) => !existingByMlId.has(item.id));

      for (const item of missing) {
        const created = await createDraft({ data: mlDraftData(item, true) });
        if (!created.ok) {
          toast.error(created.reason);
          return;
        }
        existingByMlId.set(item.id, { id: created.id, title: item.title.slice(0, 60) });
      }

      jobItems = scope
        .map((item) => {
          const row = existingByMlId.get(item.id);
          return row ? { id: row.id, label: row.title } : null;
        })
        .filter((item): item is { id: string; label: string } => !!item);
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
    } else {
      jobItems = scope.map((item) => ({
        id: item.id,
        label: item.title,
        source: {
          title: item.title,
          price_cents: item.price_cents,
          category: item.category,
          condition: item.condition,
          permalink: item.permalink,
          thumbnail: item.thumbnail,
          images: getItemImages(item),
          attributes: item.attributes ?? [],
          available_quantity: item.available_quantity,
        },
      }));
    }

    if (jobItems.length === 0) {
      toast.error("Nenhum anúncio válido foi preparado para o processamento.");
      return;
    }
    const result = await startJob({ data: { kind, items: jobItems } });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    setJobId(result.jobId);
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(selectedIds.join("\n"));
    toast.success(`${selectedIds.length} código(s) copiado(s)`);
  };

  const exportCsv = () => {
    const header = "id,titulo,preco,categoria,vendedor,condicao\n";
    const rows = selectedItems
      .map((item) =>
        [item.id, item.title.replace(/,/g, " "), item.price_cents ?? "", item.category ?? "", item.seller ?? "", conditionLabel(item.condition) ?? ""].join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anuncios-selecionados.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const activeModeOption = MODE_OPTIONS.find((option) => option.value === mode)!;
  const ActiveModeIcon = activeModeOption.icon;

  return (
    <AppShell
      title="Buscar e clonar"
      description="Encontre anúncios por diferentes caminhos e transforme qualquer resultado em um novo rascunho espelhado para sua operação."
    >
      <Card className="overflow-hidden border-primary/20">
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = option.value === mode;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={active ? "default" : "outline"}
                  className="h-auto min-h-16 justify-start rounded-2xl px-4 py-3 text-left"
                  onClick={() => {
                    setMode(option.value);
                    setItems([]);
                    setSelected({});
                    setNotice(null);
                    setSearched(false);
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-semibold">{option.label}</span>
                    <span className={`mt-0.5 block text-[11px] font-normal ${active ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{option.short}</span>
                  </span>
                </Button>
              );
            })}
          </div>

          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (query.trim().length > 1) runSearch.mutate(query.trim());
            }}
          >
            <div className="relative flex-1">
              <ActiveModeIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activeModeOption.placeholder} className="h-11 pl-10" />
            </div>
            <Button type="submit" size="lg" className="h-11 rounded-xl px-6" disabled={runSearch.isPending || query.trim().length < 2}>
              {runSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {runSearch.isPending ? "Buscando..." : `Buscar por ${activeModeOption.label.toLowerCase()}`}
            </Button>
          </form>

          <p className="text-xs leading-5 text-muted-foreground">
            {mode === "keyword" && "Procura anúncios relacionados à expressão e complementa com produtos de catálogo quando disponíveis."}
            {mode === "produto" && "Consulta o catálogo de produtos e traz o anúncio ativo associado quando existir."}
            {mode === "id" && "Consulta diretamente o anúncio pelo código MLB informado."}
            {mode === "link" && "Resolve links oficiais e links encurtados para localizar o anúncio."}
            {mode === "vendedor" && "Busca as publicações ativas pelo nickname exato ou ID numérico do vendedor."}
            {" "}Em qualquer resultado você pode importar, editar, otimizar ou clonar como novo rascunho.
          </p>
        </CardContent>
      </Card>

      {notice && <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">{notice}</div>}

      {runSearch.isPending && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-64 rounded-2xl" />)}
        </div>
      )}

      {!runSearch.isPending && searched && items.length === 0 && !notice && (
        <div className="mt-10 flex flex-col items-center gap-2 rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
          <SearchX className="h-9 w-9" />
          <p className="font-semibold text-foreground">Nenhum resultado encontrado</p>
          <p className="max-w-md text-sm">Confira a escrita e tente outro modo de busca. Para vendedor, use o nickname exato ou o ID numérico.</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="mt-5 flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
            <Checkbox checked={selectedIds.length === items.length} onCheckedChange={(checked) => setSelected(checked ? Object.fromEntries(items.map((item) => [item.id, true])) : {})} id="select-all" />
            <label htmlFor="select-all" className="cursor-pointer text-sm font-medium">Selecionar todos <span className="text-muted-foreground">({items.length} resultados)</span></label>
          </div>

          <div className="mt-3 grid gap-4 pb-28 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const image = getProductImage(item);
              return (
                <Card key={item.id} className="group overflow-hidden transition-shadow hover:shadow-lg">
                  <CardContent className="p-0">
                    <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                      <Checkbox checked={!!selected[item.id]} onCheckedChange={(checked) => setSelected((prev) => ({ ...prev, [item.id]: !!checked }))} className="absolute left-3 top-3 z-10 bg-background shadow" />
                      {image ? <img src={image} alt={item.title} loading="lazy" className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem imagem</div>}
                    </div>

                    <div className="space-y-3 p-4">
                      <div><p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5">{item.title}</p><p className="mt-2 font-display text-xl font-extrabold">{formatBRL(item.price_cents)}</p></div>
                      <div className="flex flex-wrap gap-1.5">
                        {item.seller && <Badge variant="outline" className="max-w-full truncate text-[10px]">{item.seller}</Badge>}
                        {conditionLabel(item.condition) && <Badge variant="secondary" className="text-[10px]">{conditionLabel(item.condition)}</Badge>}
                        {item.status && <Badge variant="secondary" className="text-[10px]">{listingStatusLabel(item.status)}</Badge>}
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground">{item.id}</p>

                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" className="rounded-xl" disabled={copyOne.isPending} onClick={() => copyOne.mutate(item)}>
                          {copyOne.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Importar anúncio
                        </Button>
                        <Button size="sm" variant="secondary" className="rounded-xl" disabled={duplicateOne.isPending} onClick={() => duplicateOne.mutate(item)}>
                          {duplicateOne.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Files className="h-3.5 w-3.5" />} Clonar anúncio
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => startBulk("optimize", [item])}><Sparkles className="h-3.5 w-3.5" /> Otimizar IA</Button>
                        <Button size="sm" variant="outline" className="rounded-xl" disabled={editOne.isPending} onClick={() => editOne.mutate(item)}>
                          {editOne.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Edit className="h-3.5 w-3.5" />} Editar
                        </Button>
                      </div>
                      <Button size="sm" variant="ghost" className="w-full rounded-xl text-muted-foreground" onClick={() => copyToClipboard(item.id)}><Clipboard className="h-3.5 w-3.5" /> Copiar código MLB</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-sm font-semibold">{selectedIds.length} anúncio(s) selecionado(s)</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button size="sm" className="rounded-xl" onClick={() => startBulk("copy", selectedItems)}><Files className="h-3.5 w-3.5" /> Clonar selecionados</Button>
              <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => startBulk("optimize", selectedItems)}><Sparkles className="h-3.5 w-3.5" /> Otimizar com IA</Button>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={copyCodes}><Clipboard className="h-3.5 w-3.5" /> Copiar códigos</Button>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Exportar</Button>
            </div>
          </div>
        </div>
      )}

      <BulkJobDialog
        jobId={jobId}
        onOpenChange={(open) => !open && setJobId(null)}
        onFinished={() => {
          queryClient.invalidateQueries({ queryKey: ["listings"] });
          queryClient.invalidateQueries({ queryKey: ["ad-quota"] });
        }}
      />
    </AppShell>
  );
}
