import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PlusCircle, Sparkles, Tag, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useListings } from "@/hooks/useLicense";
import { supabase } from "@/integrations/supabase/client";
import { optimizeListing, type AiOptimization } from "@/lib/ai.functions";
import { formatBRL, formatDate } from "@/lib/format";

const title = "Meus anúncios — ANÚNCIO ML";
const description =
  "Edite títulos, descrições, preços e otimize seus anúncios com o ANÚNCIO AI antes de publicar.";

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

type Draft = {
  id?: string;
  title: string;
  description: string;
  price: string;
  category: string;
  stock: string;
};

const EMPTY: Draft = { title: "", description: "", price: "", category: "", stock: "1" };

function ListingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: listings = [], isLoading } = useListings();
  const optimize = useServerFn(optimizeListing);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [ai, setAi] = useState<AiOptimization | null>(null);

  const openEditor = (listing?: (typeof listings)[number]) => {
    setAi(null);
    setDraft(
      listing
        ? {
            id: listing.id,
            title: listing.title,
            description: listing.description ?? "",
            price: listing.price_cents ? String(listing.price_cents / 100) : "",
            category: listing.category ?? "",
            stock: String(listing.stock ?? 1),
          }
        : EMPTY,
    );
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (payload: Draft & { ai_score?: number | null }) => {
      const row = {
        user_id: user!.id,
        title: payload.title,
        description: payload.description || null,
        price_cents: payload.price ? Math.round(Number(payload.price.replace(",", ".")) * 100) : null,
        category: payload.category || null,
        stock: Number(payload.stock) || 1,
        ...(payload.ai_score !== undefined ? { ai_score: payload.ai_score } : {}),
      };
      if (payload.id) {
        const { error } = await supabase.from("listings").update(row).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("listings").insert({ ...row, status: "draft" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Anúncio salvo");
      setOpen(false);
    },
    onError: () => toast.error("Não foi possível salvar o anúncio."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Anúncio excluído");
    },
  });

  const runAi = useMutation({
    mutationFn: () =>
      optimize({
        data: {
          title: draft.title,
          description: draft.description,
          category: draft.category,
          price_cents: draft.price
            ? Math.round(Number(draft.price.replace(",", ".")) * 100)
            : null,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.info("IA indisponível", { description: result.reason });
        return;
      }
      setAi(result.result);
      toast.success("Sugestões geradas", { description: "Revise antes de aplicar." });
    },
    onError: () => toast.error("A IA não conseguiu responder agora."),
  });

  const applyAi = () => {
    if (!ai) return;
    setDraft((prev) => ({ ...prev, title: ai.title, description: ai.description }));
    toast.success("Sugestões aplicadas ao formulário");
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
          <Button size="sm" onClick={() => openEditor()}>
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Novo anúncio
          </Button>
        </>
      }
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Tag className="h-8 w-8 text-muted-foreground" />
            <p className="font-display text-lg font-bold">Nenhum anúncio ainda</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Busque produtos no Mercado Livre e copie a estrutura em massa, ou crie um anúncio do
              zero e otimize com a IA.
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/buscar">Buscar e copiar</Link>
              </Button>
              <Button variant="outline" onClick={() => openEditor()}>
                Criar do zero
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {listings.map((listing) => (
            <Card key={listing.id}>
              <CardContent className="flex flex-wrap items-center gap-4 pt-6">
                <div className="min-w-[240px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{listing.title}</span>
                    <Badge variant={listing.status === "active" ? "default" : "outline"}>
                      {listing.status === "draft" ? "rascunho" : listing.status}
                    </Badge>
                    {listing.ai_score ? (
                      <Badge variant="secondary">score {listing.ai_score}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatBRL(listing.price_cents)} · estoque {listing.stock} · criado em{" "}
                    {formatDate(listing.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditor(listing)}>
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Editar
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
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar anúncio" : "Novo anúncio"}</DialogTitle>
            <DialogDescription>
              A IA sugere melhorias de título, descrição e palavras-chave. Nada é aplicado sem sua
              confirmação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={draft.title}
                maxLength={60}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">{draft.title.length}/60 caracteres</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  value={draft.price}
                  onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Estoque</Label>
                <Input
                  id="stock"
                  value={draft.stock}
                  onChange={(event) => setDraft({ ...draft, stock: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={7}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> ANÚNCIO AI
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={draft.title.trim().length < 3 || runAi.isPending}
                  onClick={() => runAi.mutate()}
                >
                  {runAi.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Analisar e otimizar
                </Button>
              </div>

              {ai && (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex gap-3">
                    <Badge variant="outline">antes {ai.score_before}</Badge>
                    <Badge>depois {ai.score_after}</Badge>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Título sugerido
                    </p>
                    <p className="mt-1">{ai.title}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Descrição sugerida
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{ai.description}</p>
                  </div>
                  {ai.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {ai.keywords.map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="text-[10px]">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {ai.improvements?.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                      {ai.improvements.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  <Button size="sm" variant="secondary" onClick={applyAi}>
                    Aplicar sugestões
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={draft.title.trim().length < 3 || save.isPending}
                onClick={() =>
                  save.mutate({ ...draft, ai_score: ai ? ai.score_after : undefined })
                }
              >
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar anúncio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
