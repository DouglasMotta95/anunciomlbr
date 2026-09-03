import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, ExternalLink, Loader2, Search, ShoppingCart, Store, Tags } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatNumber } from "@/lib/format";
import { searchMercadoLivrePublicAds } from "@/lib/ml-public-search.functions";
import { getProductImage } from "@/lib/product-image";

export const Route = createFileRoute("/_authenticated/mercado")({
  head: () => ({ meta: [{ title: "Pesquisa de mercado — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: MarketResearchPage,
});

type MarketItem = {
  id: string;
  title: string;
  price_cents: number | null;
  sold_quantity: number | null;
  available_quantity: number | null;
  seller: string | null;
  seller_id: string | null;
  permalink: string | null;
  thumbnail: string | null;
  images?: unknown[];
  verified_item?: boolean;
  status?: string | null;
};

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const current = sorted[middle];
  if (current === undefined) return null;
  if (sorted.length % 2) return current;
  const previous = sorted[middle - 1];
  return previous === undefined ? current : Math.round((previous + current) / 2);
}

function MarketResearchPage() {
  const searchFn = useServerFn(searchMercadoLivrePublicAds);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MarketItem[]>([]);
  const [searched, setSearched] = useState(false);

  const search = useMutation({
    mutationFn: (term: string) => searchFn({ data: { query: term, limit: 50 } }),
    onSuccess: (result) => {
      setSearched(true);
      setItems((result.items ?? []) as MarketItem[]);
      if (!result.ok) toast.error(result.reason || "Não foi possível concluir a pesquisa.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível pesquisar agora."),
  });

  const stats = useMemo(() => {
    const confirmed = items.filter((item) => item.verified_item === true && item.permalink && item.status === "active");
    const prices = confirmed.map((item) => item.price_cents).filter((value): value is number => typeof value === "number" && value > 0);
    const sellers = new Set(confirmed.map((item) => item.seller_id ?? item.seller).filter(Boolean));
    const soldKnown = confirmed.filter((item) => typeof item.sold_quantity === "number");
    const sold = soldKnown.reduce((sum, item) => sum + Math.max(0, item.sold_quantity ?? 0), 0);
    const average = prices.length ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : null;
    return {
      confirmed: confirmed.length,
      sellers: sellers.size,
      average,
      median: median(prices),
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
      sold,
      soldKnown: soldKnown.length,
    };
  }, [items]);

  return (
    <AppShell title="Pesquisa de mercado" description="Compare anúncios reais e confirmados do Mercado Livre antes de decidir o que copiar, vender ou otimizar.">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const term = query.trim(); if (term.length >= 2) search.mutate(term); }}>
            <div className="relative flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: furadeira, iPhone 16, geladeira frost free" className="h-11 pl-10"/></div>
            <Button type="submit" className="h-11" disabled={search.isPending || query.trim().length < 2}>{search.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <BarChart3 className="h-4 w-4"/>}{search.isPending ? "Analisando..." : "Analisar mercado"}</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">Os indicadores abaixo usam somente anúncios que passaram pela confirmação de procedência do ANÚNCIO ML.</p>
        </CardContent>
      </Card>

      {search.isPending && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4}).map((_,index)=><Skeleton key={index} className="h-28 rounded-lg"/>)}</div>}

      {!search.isPending && searched && !items.length && <Card className="mt-4"><CardContent className="py-10 text-center"><Tags className="mx-auto h-7 w-7 text-muted-foreground"/><p className="mt-3 font-semibold">Nenhum anúncio confirmado encontrado</p><p className="mt-1 text-sm text-muted-foreground">Tente uma descrição mais específica ou outro produto.</p></CardContent></Card>}

      {!!items.length && <>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Anúncios confirmados" value={formatNumber(stats.confirmed)} hint="ativos nesta amostra" icon={Tags}/>
          <Metric label="Preço médio" value={stats.average == null ? "—" : formatBRL(stats.average)} hint={stats.median == null ? "mediana indisponível" : `mediana ${formatBRL(stats.median)}`} icon={BarChart3}/>
          <Metric label="Faixa de preço" value={stats.min == null ? "—" : formatBRL(stats.min)} hint={stats.max == null ? "máximo indisponível" : `até ${formatBRL(stats.max)}`} icon={ShoppingCart}/>
          <Metric label="Vendedores" value={formatNumber(stats.sellers)} hint={stats.soldKnown ? `${formatNumber(stats.sold)} vendas acumuladas em ${stats.soldKnown} anúncio(s) com dado disponível` : "vendas não disponíveis nesta amostra"} icon={Store}/>
        </div>

        <Card className="mt-4">
          <CardHeader className="border-b border-border/70"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Resultados analisados</CardTitle><Badge variant="outline">{items.length} encontrados</Badge></div></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/70">
              {items.slice(0, 20).map((item) => {
                const image = getProductImage(item as any);
                return <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:items-center">
                  {image ? <img src={image} alt={item.title} className="h-14 w-14 rounded-md border bg-white object-contain p-1"/> : <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-[9px] text-muted-foreground">Sem imagem</div>}
                  <div className="min-w-0"><p className="line-clamp-1 text-sm font-semibold">{item.title}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{item.price_cents == null ? "Preço indisponível" : formatBRL(item.price_cents)}</span>{item.seller && <span>{item.seller}</span>}{item.sold_quantity != null && <span>{formatNumber(item.sold_quantity)} vendas</span>}</div></div>
                  {item.permalink && <Button size="sm" variant="outline" asChild><a href={item.permalink} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5"/>Ver anúncio</a></Button>}
                </div>;
              })}
            </div>
          </CardContent>
        </Card>
      </>}
    </AppShell>
  );
}

function Metric({label,value,hint,icon:Icon}:{label:string;value:string;hint:string;icon:any}){
  return <Card><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{hint}</p></div><div className="rounded-lg bg-primary/10 p-2"><Icon className="h-4 w-4 text-primary"/></div></div></CardContent></Card>;
}
