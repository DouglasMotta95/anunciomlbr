import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Calculator, Eye, Gift, Radar, Sparkles, Target, Trash2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatBRL, formatNumber } from "@/lib/format";
import {
  addCompetitorWatch,
  calculateSmartPrice,
  getReferralSummary,
  getSellerGrowthOverview,
  listCompetitorWatch,
  removeCompetitorWatch,
} from "@/lib/seller-growth.functions";

export const Route = createFileRoute("/_authenticated/crescimento")({
  head: () => ({ meta: [{ title: "Central de crescimento — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: GrowthPage,
});

function GrowthPage() {
  const overviewFn = useServerFn(getSellerGrowthOverview);
  const referralFn = useServerFn(getReferralSummary);
  const radarFn = useServerFn(listCompetitorWatch);
  const addRadarFn = useServerFn(addCompetitorWatch);
  const removeRadarFn = useServerFn(removeCompetitorWatch);
  const calcFn = useServerFn(calculateSmartPrice);
  const qc = useQueryClient();

  const { data: overview, isLoading } = useQuery({ queryKey: ["seller-growth"], queryFn: () => overviewFn() });
  const { data: referral } = useQuery({ queryKey: ["referral-summary"], queryFn: () => referralFn() });
  const { data: radar = [] } = useQuery({ queryKey: ["competitor-watch"], queryFn: () => radarFn() });

  const [mlb, setMlb] = useState("");
  const [cost, setCost] = useState("100");
  const [fees, setFees] = useState("16");
  const [margin, setMargin] = useState("20");
  const [priceResult, setPriceResult] = useState<null | { suggested_price_cents: number; estimated_fees_cents: number; estimated_profit_cents: number; estimated_margin_percent: number }>(null);

  const addRadar = useMutation({ mutationFn: () => addRadarFn({ data: { ml_item_id: mlb.trim().toUpperCase() } }), onSuccess: () => { setMlb(""); qc.invalidateQueries({ queryKey: ["competitor-watch"] }); toast.success("Anúncio adicionado ao radar"); }, onError: () => toast.error("Use um ID válido, como MLB123456789") });
  const removeRadar = useMutation({ mutationFn: (id: string) => removeRadarFn({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["competitor-watch"] }) });
  const calculate = useMutation({ mutationFn: () => calcFn({ data: { cost_cents: Math.round(Number(cost.replace(",", ".")) * 100), fees_percent: Number(fees.replace(",", ".")), fixed_fees_cents: 0, target_margin_percent: Number(margin.replace(",", ".")) } }), onSuccess: setPriceResult, onError: () => toast.error("Confira os valores da precificação") });

  return (
    <AppShell title="Central de crescimento" description="Prioridades, margem, concorrência e indicações para vender melhor no Mercado Livre.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Saúde da operação" value={isLoading ? "…" : `${overview?.score ?? 0}/100`} icon={Activity} />
        <Metric label="Vendas 30 dias" value={formatNumber(overview?.sales.orders ?? 0)} icon={TrendingUp} />
        <Metric label="Faturamento 30 dias" value={formatBRL(overview?.sales.revenue_cents ?? 0)} icon={Target} />
        <Metric label="Anúncios disponíveis" value={formatNumber(overview?.quota.remaining ?? 0)} icon={Sparkles} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> O que fazer hoje</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(overview?.opportunities ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma pendência importante encontrada agora.</p> : overview?.opportunities.map((item) => (
              <div key={item.key} className="flex flex-col gap-3 rounded-2xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><div className="flex items-center gap-2"><Badge variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "secondary" : "outline"}>{item.count}</Badge><p className="font-semibold">{item.title}</p></div><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></div>
                <Button asChild size="sm" variant="outline"><Link to={item.action_to as "/anuncios"}>Corrigir agora</Link></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Resumo comercial</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div><div className="flex justify-between"><span className="text-muted-foreground">Score</span><strong>{overview?.score ?? 0}%</strong></div><Progress className="mt-2" value={overview?.score ?? 0} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Catálogo ativo</span><strong>{overview?.catalog.active ?? 0}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Valor em catálogo</span><strong>{formatBRL(overview?.catalog.value_cents ?? 0)}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ticket médio</span><strong>{formatBRL(overview?.sales.ticket_cents ?? 0)}</strong></div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-primary" /> Precificação inteligente</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3"><div><Label>Custo (R$)</Label><Input value={cost} onChange={(e) => setCost(e.target.value)} /></div><div><Label>Taxas (%)</Label><Input value={fees} onChange={(e) => setFees(e.target.value)} /></div><div><Label>Margem (%)</Label><Input value={margin} onChange={(e) => setMargin(e.target.value)} /></div></div>
            <Button onClick={() => calculate.mutate()} disabled={calculate.isPending} className="w-full">Calcular preço sugerido</Button>
            {priceResult && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Preço sugerido</p><p className="mt-1 font-display text-2xl font-bold">{formatBRL(priceResult.suggested_price_cents)}</p><p className="mt-2 text-sm text-muted-foreground">Taxas estimadas {formatBRL(priceResult.estimated_fees_cents)} · lucro {formatBRL(priceResult.estimated_profit_cents)} · margem {priceResult.estimated_margin_percent}%</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gift className="h-4 w-4 text-primary" /> Programa de indicação</CardTitle></CardHeader>
          <CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Compartilhe seu código. Quando a indicação converter, a recompensa pode ser liberada em anúncios extras.</p><div className="rounded-2xl border p-4"><p className="text-xs text-muted-foreground">Seu código</p><div className="mt-1 flex items-center justify-between gap-2"><span className="font-mono text-lg font-bold">{referral?.code ?? "…"}</span><Button size="sm" variant="outline" onClick={() => referral?.code && navigator.clipboard.writeText(referral.code)}>Copiar</Button></div></div><div className="grid grid-cols-3 gap-2 text-center"><Mini label="Indicações" value={referral?.total ?? 0} /><Mini label="Convertidas" value={referral?.converted ?? 0} /><Mini label="Bônus" value={referral?.rewarded_ads ?? 0} /></div></CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Radar className="h-4 w-4 text-primary" /> Radar de concorrentes</CardTitle></CardHeader>
        <CardContent className="space-y-4"><div className="flex gap-2"><Input value={mlb} onChange={(e) => setMlb(e.target.value)} placeholder="MLB123456789" /><Button onClick={() => addRadar.mutate()} disabled={!mlb.trim() || addRadar.isPending}><Eye className="mr-2 h-4 w-4" />Acompanhar</Button></div>{radar.length === 0 ? <p className="text-sm text-muted-foreground">Adicione anúncios que você quer acompanhar. O histórico fica preparado para as rotinas de monitoramento.</p> : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{radar.map((item: any) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3"><div className="min-w-0"><p className="font-mono text-sm font-semibold">{item.ml_item_id}</p><p className="truncate text-xs text-muted-foreground">{item.title ?? "Aguardando primeira leitura"}</p></div><Button size="icon" variant="ghost" onClick={() => removeRadar.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}</CardContent>
      </Card>
    </AppShell>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) { return <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></div></CardContent></Card>; }
function Mini({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-muted/50 p-3"><p className="font-display text-lg font-bold">{value}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p></div>; }
