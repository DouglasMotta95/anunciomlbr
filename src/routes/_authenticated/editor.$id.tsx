import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { AiPanel } from "@/components/app/AiPanel";
import { AnalysisCard, DescriptionStudio, TitleStudio } from "@/components/app/AiStudio";
import { PublishButton } from "@/components/app/PublishButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getProductImage } from "@/lib/product-image";

export const Route = createFileRoute("/_authenticated/editor/$id")({
  head: () => ({
    meta: [
      { title: "Editor de anúncio — ANÚNCIO ML" },
      { name: "description", content: "Edite título, descrição, preço e estoque com apoio do ANÚNCIO AI." },
      { property: "og:title", content: "Editor de anúncio — ANÚNCIO ML" },
      { property: "og:description", content: "Edite e otimize seus anúncios com IA antes de publicar." },
    ],
  }),
  component: EditorPage,
});

type Form = {
  title: string;
  description: string;
  price: string;
  stock: string;
  sku: string;
  category: string;
};

const EMPTY: Form = { title: "", description: "", price: "", stock: "1", sku: "", category: "" };

function EditorPage() {
  const { id } = Route.useParams();
  const isNew = id === "novo";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<Form>(EMPTY);
  const [score, setScore] = useState<number | null>(null);

  const listing = useQuery({
    queryKey: ["listing", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const productImage = getProductImage(listing.data?.images);

  useEffect(() => {
    const row = listing.data;
    if (!row) return;
    setForm({
      title: row.title ?? "",
      description: row.description ?? "",
      price: row.price_cents != null ? (row.price_cents / 100).toFixed(2) : "",
      stock: String(row.stock ?? 0),
      sku: row.sku ?? "",
      category: row.category ?? "",
    });
    setScore(row.ai_score ?? null);
  }, [listing.data]);

  function parsedValues() {
    const price = form.price ? Math.round(Number(form.price.replace(",", ".")) * 100) : null;
    const stock = Number(form.stock);
    if (form.title.trim().length < 3) throw new Error("Informe um título válido.");
    if (form.title.trim().length > 60) throw new Error("O título deve ter no máximo 60 caracteres.");
    if (price !== null && (!Number.isFinite(price) || price <= 0)) throw new Error("Informe um preço válido maior que zero.");
    if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) throw new Error("Informe um estoque válido.");
    return { price, stock };
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      const { price, stock } = parsedValues();
      const patch = {
        title: form.title.trim(),
        description: form.description || null,
        price_cents: price,
        stock,
        sku: form.sku || null,
        category: form.category || null,
        ai_score: score,
      };
      if (isNew) {
        const { data, error } = await supabase
          .from("listings")
          .insert({ ...patch, user_id: user.id, status: "draft" })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
      const { error } = await supabase.from("listings").update(patch).eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (savedId) => {
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Anúncio salvo");
      if (isNew) navigate({ to: "/editor/$id", params: { id: savedId } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      if (!listing.data) throw new Error("Carregue o anúncio antes de duplicar.");
      const { price, stock } = parsedValues();
      const original = listing.data;
      const copyTitle = `${form.title.trim()} (cópia)`;
      const title = copyTitle.length <= 60 ? copyTitle : form.title.trim().slice(0, 60);

      const { data, error } = await supabase
        .from("listings")
        .insert({
          user_id: user.id,
          status: "draft",
          title,
          description: form.description || null,
          price_cents: price,
          stock,
          sku: form.sku || null,
          category: form.category || null,
          condition: original.condition ?? null,
          images: original.images ?? [],
          attributes: original.attributes ?? [],
          cost_cents: original.cost_cents ?? null,
          fees_cents: original.fees_cents ?? null,
          ai_score: score,
          source_permalink: original.source_permalink ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: async (newId) => {
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Cópia criada com imagens e atributos");
      navigate({ to: "/editor/$id", params: { id: newId } });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível duplicar."),
  });

  const set = (key: keyof Form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <AppShell title={isNew ? "Novo anúncio" : "Editar anúncio"} description="Edite, otimize com IA e salve como rascunho.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/anuncios" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        {!isNew && (
          <Button variant="outline" size="sm" onClick={() => duplicate.mutate()} disabled={duplicate.isPending || listing.isLoading}>
            <Copy className="mr-2 h-4 w-4" /> Duplicar
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!isNew && <PublishButton listingId={id} disabled={save.isPending} />}
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {listing.isLoading && !isNew ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando anúncio...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conteúdo do anúncio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Título</Label>
                <Input id="title" value={form.title} onChange={(e) => set("title")(e.target.value)} maxLength={60} />
                <p className="text-xs text-muted-foreground">{form.title.length}/60 caracteres</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  rows={10}
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input id="price" value={form.price} onChange={(e) => set("price")(e.target.value)} inputMode="decimal" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stock">Estoque</Label>
                  <Input id="stock" value={form.stock} onChange={(e) => set("stock")(e.target.value)} inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" value={form.sku} onChange={(e) => set("sku")(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category">Categoria</Label>
                  <Input id="category" value={form.category} onChange={(e) => set("category")(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pré-visualização</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {productImage ? (
                  <img
                    src={productImage}
                    alt={form.title || "Imagem do produto"}
                    className="aspect-square w-full rounded-md bg-muted object-contain"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                    Sem imagem do produto
                  </div>
                )}
                <p className="text-sm font-semibold leading-snug">{form.title || "Título do anúncio"}</p>
                <p className="text-2xl font-bold">
                  {form.price ? `R$ ${form.price}` : "R$ --"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{form.stock || 0} em estoque</Badge>
                  {form.category && <Badge variant="outline">{form.category}</Badge>}
                  {score != null && <Badge variant="outline">score {score}</Badge>}
                </div>
                <p className="whitespace-pre-line text-xs text-muted-foreground">
                  {form.description ? form.description.slice(0, 400) : "A descrição aparece aqui."}
                </p>
              </CardContent>
            </Card>

            <TitleStudio
              ctx={{ title: form.title, description: form.description, category: form.category }}
              onPick={(picked) => setForm((prev) => ({ ...prev, title: picked.slice(0, 60) }))}
            />

            <DescriptionStudio
              ctx={{ title: form.title, description: form.description, category: form.category }}
              onApply={(text) => setForm((prev) => ({ ...prev, description: text }))}
            />

            <AnalysisCard
              ctx={{
                title: form.title,
                description: form.description,
                category: form.category,
                priceCents: form.price ? Math.round(Number(form.price.replace(",", ".")) * 100) : null,
                imagesCount: Array.isArray(listing.data?.images) ? listing.data.images.length : 0,
              }}
            />

            <AiPanel
              title={form.title || "Anúncio sem título"}
              description={form.description}
              category={form.category}
              priceCents={form.price ? Math.round(Number(form.price.replace(",", ".")) * 100) : null}
              currentScore={score}
              onApply={(result) => {
                setForm((prev) => ({ ...prev, title: result.title.slice(0, 60), description: result.description }));
                setScore(result.score_after);
                toast.success("Sugestões aplicadas", { description: "Revise e salve para confirmar." });
              }}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
