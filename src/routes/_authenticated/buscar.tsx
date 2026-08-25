import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, Search, SearchX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumber } from "@/lib/format";
import { searchMercadoLivre, type MlItem } from "@/lib/ml.functions";

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

function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useServerFn(searchMercadoLivre);

  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MlItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = useMutation({
    mutationFn: (term: string) => search({ data: { query: term, limit: 24 } }),
    onSuccess: (result) => {
      setSearched(true);
      setItems(result.items);
      setSelected({});
      setNotice(result.ok ? null : result.reason);
    },
    onError: () => toast.error("Não foi possível buscar agora."),
  });

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const copySelected = useMutation({
    mutationFn: async () => {
      const rows = items
        .filter((item) => selected[item.id])
        .map((item) => ({
          user_id: user!.id,
          title: item.title,
          price_cents: item.price_cents,
          category: item.category,
          condition: item.condition,
          status: "draft" as const,
          source_ml_id: item.id,
          source_permalink: item.permalink,
          images: item.thumbnail ? [item.thumbnail] : [],
          stock: item.available_quantity ?? 1,
        }));
      if (!rows.length) return 0;

      const { error } = await supabase.from("listings").insert(rows);
      if (error) throw error;

      await supabase.from("activity_events").insert({
        user_id: user!.id,
        kind: "listings_copied",
        message: `${rows.length} anúncio(s) copiado(s) para rascunho`,
        meta: { query },
      });
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success(`${count} anúncio(s) copiado(s) como rascunho`, {
        description: "Revise, otimize com a IA e publique quando quiser.",
      });
      navigate({ to: "/anuncios" });
    },
    onError: () => toast.error("Falha ao copiar os anúncios selecionados."),
  });

  return (
    <AppShell
      title="Buscar e copiar"
      description="Pesquise no Mercado Livre e traga a estrutura dos anúncios para o seu rascunho."
      actions={
        <Button
          size="sm"
          disabled={!selectedIds.length || copySelected.isPending}
          onClick={() => copySelected.mutate()}
        >
          {copySelected.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Copy className="mr-1.5 h-3.5 w-3.5" />
          )}
          Copiar {selectedIds.length || ""} selecionado(s)
        </Button>
      }
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
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: fone bluetooth, air fryer, capinha iPhone 15"
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
            <Skeleton key={index} className="h-40 rounded-2xl" />
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
                setSelected(
                  checked ? Object.fromEntries(items.map((item) => [item.id, true])) : {},
                )
              }
              id="select-all"
            />
            <label htmlFor="select-all" className="text-sm text-muted-foreground">
              Selecionar todos os {items.length} resultados
            </label>
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  {item.thumbnail && (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                    <p className="mt-1 font-display text-base font-bold">
                      {formatBRL(item.price_cents)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.sold_quantity !== null && (
                        <Badge variant="outline" className="text-[10px]">
                          {formatNumber(item.sold_quantity)} vendidos
                        </Badge>
                      )}
                      {item.condition && (
                        <Badge variant="secondary" className="text-[10px]">
                          {item.condition === "new" ? "novo" : item.condition}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
