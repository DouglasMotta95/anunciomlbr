import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  Edit,
  Loader2,
  Search,
  SearchX,
  Sparkles,
  Files,
  Download,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { startBulkJob } from "@/lib/bulk.functions";
import { formatBRL } from "@/lib/format";
import { getMercadoLivreItem, searchMercadoLivre, type MlItem } from "@/lib/ml.functions";
import { getProductImage } from "@/lib/product-image";
import { listingStatusLabel } from "@/lib/status-labels";

const title = "Buscar e copiar anúncios — ANÚNCIO ML";
const description =
  "Pesquise produtos no Mercado Livre, copie a estrutura dos anúncios em massa e edite antes de publicar.";

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

type Mode = "keyword" | "id" | "link" | "produto" | "vendedor";

const MODE_OPTIONS: { value: Mode; label: string; placeholder: string }[] = [
  { value: "keyword", label: "Palavra-chave", placeholder: "Ex.: fone bluetooth, air fryer" },
  { value: "produto", label: "Produto", placeholder: "Ex.: iPhone 15 128GB" },
  { value: "id", label: "ID do anúncio", placeholder: "Ex.: MLB1234567890" },
  { value: "link", label: "Link do anúncio", placeholder: "Cole o link do anúncio no Mercado Livre" },
  { value: "vendedor", label: "Vendedor", placeholder: "Nome do vendedor" },
];

function extractMlbId(input: string): string | null {
  const match = input.toUpperCase().match(/MLB-?\d+/);
  return match ? match[0].replace("-", "") : null;
}

function conditionLabel(condition: string | null): string | null {
  if (!condition) return null;
  const map: Record<string, string> = {
    new: "Novo",
    used: "Usado",
    refurbished: "Recondicionado",
  };
  return map[condition] ?? condition;
}

function getItemImages(item: MlItem): string[] {
  const images = (item.images ?? []).filter(
    (image): image is string => typeof image === "string" && image.length > 0,
  );
  if (images.length > 0) return Array.from(new Set(images));
  return item.thumbnail ? [item.thumbnail] : [];
}

function draftPayload(item: MlItem, userId: string) {
  return {
    user_id: userId,
    title: item.title.slice(0, 60),
    price_cents: item.price_cents,
    category: item.category,
    condition: item.condition,
    status: "draft" as const,
    source_ml_id: item.id,
    source_permalink: item.permalink,
    images: getItemImages(item) as never,
    attributes: (item.attributes ?? []) as never,
    stock: item.available_quantity ?? 1,
  };
}

function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useServerFn(searchMercadoLivre);
  const lookupById = useServerFn(getMercadoLivreItem);
  const startJob = useServerFn(startBulkJob);

  const [mode, setMode] = useState<Mode>("keyword");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MlItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const runSearch = useMutation({
    mutationFn: async (term: string) => {
      if (mode === "id" || mode === "link") {
        const id = mode === "id" ? term.toUpperCase() : extractMlbId(term);
        if (!id)
          return {
            ok: false as const,
            configured: true,
            reason: "Não foi possível identificar o ID (MLB...) informado.",
            items: [] as MlItem[],
          };
        return lookupById({ data: { id } });
      }
      return search({ data: { query: term, limit: 24 } });
    },
    onSuccess: (result) => {
      setSearched(true);
      setItems(result.items);
      setSelected({});
      setNotice(result.ok ? null : result.reason);
      if (mode === "vendedor" && result.ok && result.items.length > 0) {
        toast.info("Busca por vendedor", {
          description:
            "Os resultados são retornados pela busca oficial do Mercado Livre. Confira o nome do vendedor exibido em cada anúncio.",
        });
      }
    },
    onError: () => toast.error("Não foi possível buscar agora."),
  });

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedItems = items.filter((item) => selected[item.id]);

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("✓ Código copiado");
  };

  const copyOne = useMutation({
    mutationFn: async (item: MlItem) => {
      if (!user) throw new Error("Sessão expirada.");
      const { data: existing } = await supabase
        .from("listings")
        .select("id")
        .eq("source_ml_id", item.id)
        .maybeSingle();
      if (existing?.id) return { id: existing.id, existed: true };

      const { data, error } = await supabase
        .from("listings")
        .insert(draftPayload(item, user.id))
        .select("id")
        .single();
      if (error) throw error;
      return { id: data.id, existed: false };
    },
    onSuccess: ({ existed }) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success(
        existed
          ? "Esse anúncio já estava copiado nos seus rascunhos"
          : "Anúncio copiado como rascunho com imagens e atributos",
      );
    },
    onError: () => toast.error("Falha ao copiar anúncio."),
  });

  const editOne = useMutation({
    mutationFn: async (item: MlItem) => {
      if (!user) throw new Error("Sessão expirada.");
      const { data: existing } = await supabase
        .from("listings")
        .select("id")
        .eq("source_ml_id", item.id)
        .maybeSingle();
      if (existing?.id) return existing.id;

      const { data, error } = await supabase
        .from("listings")
        .insert(draftPayload(item, user.id))
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      navigate({ to: "/editor/$id", params: { id } });
    },
    onError: () => toast.error("Não foi possível abrir o anúncio para edição."),
  });

  const duplicateOne = useMutation({
    mutationFn: async (item: MlItem) => {
      if (!user) throw new Error("Sessão expirada.");
      const suffix = " (cópia)";
      const base = item.title.slice(0, Math.max(3, 60 - suffix.length));
      const { error } = await supabase.from("listings").insert({
        user_id: user.id,
        title: `${base}${suffix}`,
        price_cents: item.price_cents,
        category: item.category,
        condition: item.condition,
        status: "draft",
        source_permalink: item.permalink,
        images: getItemImages(item) as never,
        attributes: (item.attributes ?? []) as never,
        stock: item.available_quantity ?? 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Anúncio duplicado com imagens e atributos");
    },
    onError: () => toast.error("Falha ao duplicar anúncio."),
  });

  const startBulk = async (kind: "copy" | "optimize", scope: MlItem[]) => {
    if (!scope.length || !user) return;

    let jobItems: { id: string; label: string; source?: Record<string, unknown> }[];
    if (kind === "optimize") {
      const mlIds = scope.map((item) => item.id);
      const { data: existing, error: existingError } = await supabase
        .from("listings")
        .select("id, title, source_ml_id")
        .in("source_ml_id", mlIds);
      if (existingError) {
        toast.error("Não foi possível verificar os anúncios já copiados.");
        return;
      }

      const existingByMlId = new Map(
        (existing ?? [])
          .filter((row) => !!row.source_ml_id)
          .map((row) => [row.source_ml_id as string, { id: row.id, title: row.title }]),
      );
      const missing = scope.filter((item) => !existingByMlId.has(item.id));

      if (missing.length > 0) {
        const { data: inserted, error } = await supabase
          .from("listings")
          .insert(missing.map((item) => draftPayload(item, user.id)))
          .select("id, title, source_ml_id");
        if (error || !inserted) {
          toast.error("Não foi possível preparar os anúncios para otimização.");
          return;
        }
        for (const row of inserted) {
          if (row.source_ml_id) {
            existingByMlId.set(row.source_ml_id, { id: row.id, title: row.title });
          }
        }
      }

      jobItems = scope
        .map((item) => {
          const row = existingByMlId.get(item.id);
          return row ? { id: row.id, label: row.title } : null;
        })
        .filter((item): item is { id: string; label: string } => !!item);

      queryClient.invalidateQueries({ queryKey: ["listings"] });
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
    toast.success(`✓ ${selectedIds.length} códigos copiados`);
  };

  const exportCsv = () => {
    const header = "id,titulo,preco,categoria,vendedor,condicao\n";
    const rows = selectedItems
      .map((item) =>
        [
          item.id,
          item.title.replace(/,/g, " "),
          item.price_cents ?? "",
          item.category ?? "",
          item.seller ?? "",
          conditionLabel(item.condition) ?? "",
        ].join(","),
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

  const activeModeOption = MODE_OPTIONS.find((m) => m.value === mode)!;

  return (
    <AppShell
      title="Buscar e copiar"
      description="Pesquise no Mercado Livre por palavra-chave, ID, link ou vendedor e traga a estrutura dos anúncios."
    >
      <Card>
        <CardContent className="pt-6">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (query.trim().length > 1) runSearch.mutate(query.trim());
            }}
          >
            <Select value={mode} onValueChange={(value) => setMode(value as Mode)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={activeModeOption.placeholder}
              className="min-w-[240px] flex-1"
            />
            <Button type="submit" disabled={runSearch.isPending || query.trim().length < 2}>
              {runSearch.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Buscar
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            A busca usa a API pública oficial do Mercado Livre. Copiamos estrutura, categoria e
            atributos para acelerar o cadastro — o conteúdo final é sempre seu.
          </p>
        </CardContent>
      </Card>

      {notice && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {notice}
        </div>
      )}

      {runSearch.isPending && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44 rounded-2xl" />
          ))}
        </div>
      )}

      {!runSearch.isPending && searched && items.length === 0 && !notice && (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-muted-foreground">
          <SearchX className="h-8 w-8" />
          <p className="text-sm">Nenhum resultado para essa busca.</p>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="mt-5 flex items-center gap-3">
            <Checkbox
              checked={selectedIds.length === items.length}
              onCheckedChange={(checked) =>
                setSelected(checked ? Object.fromEntries(items.map((item) => [item.id, true])) : {})
              }
              id="select-all"
            />
            <label htmlFor="select-all" className="text-sm text-muted-foreground">
              Selecionar todos os {items.length} resultados
            </label>
          </div>

          <div className="mt-3 grid gap-4 pb-24 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="flex gap-3 pt-6">
                  <Checkbox
                    checked={!!selected[item.id]}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => ({ ...prev, [item.id]: !!checked }))
                    }
                    className="mt-1"
                  />
                  {getProductImage(item) ? (
                    <img
                      src={getProductImage(item) ?? undefined}
                      alt={item.title}
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                      Sem imagem
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                    <p className="mt-1 font-display text-base font-bold">
                      {formatBRL(item.price_cents)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {item.category}
                        </Badge>
                      )}
                      {item.seller && (
                        <Badge variant="outline" className="text-[10px]">
                          {item.seller}
                        </Badge>
                      )}
                      {conditionLabel(item.condition) && (
                        <Badge variant="secondary" className="text-[10px]">
                          {conditionLabel(item.condition)}
                        </Badge>
                      )}
                      {item.status && (
                        <Badge variant="secondary" className="text-[10px]">
                          {listingStatusLabel(item.status)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{item.id}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyOne.mutate(item)}>
                        <Copy className="mr-1 h-3 w-3" /> Copiar
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => duplicateOne.mutate(item)}>
                        <Files className="mr-1 h-3 w-3" /> Duplicar
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => startBulk("optimize", [item])}>
                        <Sparkles className="mr-1 h-3 w-3" /> IA
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => copyToClipboard(item.id)}>
                        Copiar código
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={editOne.isPending}
                        onClick={() => editOne.mutate(item)}
                      >
                        <Edit className="mr-1 h-3 w-3" /> Editar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm font-semibold">{selectedIds.length} anúncios selecionados</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => startBulk("copy", selectedItems)}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> COPIAR SELECIONADOS
              </Button>
              <Button size="sm" variant="secondary" onClick={() => startBulk("optimize", selectedItems)}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> OTIMIZAR COM IA
              </Button>
              <Button size="sm" variant="outline" onClick={copyCodes}>
                Copiar códigos
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> EXPORTAR
              </Button>
            </div>
          </div>
        </div>
      )}

      <BulkJobDialog
        jobId={jobId}
        onOpenChange={(open) => !open && setJobId(null)}
        onFinished={() => {
          queryClient.invalidateQueries({ queryKey: ["listings"] });
        }}
      />
    </AppShell>
  );
}
