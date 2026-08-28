import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Bot,
  Calculator,
  Check,
  Copy,
  Eye,
  Gift,
  Loader2,
  Radar,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
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
import { askSellerCopilot } from "@/lib/seller-copilot.functions";
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

type CopilotResult = {
  headline: string;
  summary: string;
  priorities?: Array<{ title: string; reason: string; action: string; impact: "alto" | "medio" | "baixo" }>;
  warning?: string | null;
};

function parseNumber(value: string) {
  return Number(value.trim().replace(/\./g, "").replace(",", "."));
}

function GrowthPage() {
  const overviewFn = useServerFn(getSellerGrowthOverview);
  const referralFn = useServerFn(getReferralSummary);
  const radarFn = useServerFn(listCompetitorWatch);
  const addRadarFn = useServerFn(addCompetitorWatch);
  const removeRadarFn = useServerFn(removeCompetitorWatch);
  const calcFn = useServerFn(calculateSmartPrice);
  const copilotFn = useServerFn(askSellerCopilot);
  const qc = useQueryClient();

  const { data: overview, isLoading } = useQuery({ queryKey: ["seller-growth"], queryFn: () => overviewFn() });
  const { data: referral } = useQuery({ queryKey: ["referral-summary"], queryFn: () => referralFn() });
  const { data: radar = [], isLoading: radarLoading } = useQuery({ queryKey: ["competitor-watch"], queryFn: () => radarFn() });

  const [mlb, setMlb] = useState("");
  const [cost, setCost] = useState("100");
  const [fees, setFees] = useState("16");
  const [margin, setMargin] = useState("20");
  const [question, setQuestion] = useState("O que eu devo fazer hoje para melhorar minhas vendas?");
  const [priceResult, setPriceResult] = useState<{ suggested_price_cents: number } | null>(null);
  const [copilotResult, setCopilotResult] = useState<CopilotResult | null>(null);

  const addRadar = useMutation({
    mutationFn: () => addRadarFn({ data: { ml_item_id: mlb.trim().toUpperCase() } }),
    onSuccess: () => {
      setMlb("");
      void qc.invalidateQueries({ queryKey: ["competitor-watch"] });
      toast.success("Anúncio adicionado ao radar");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Use um ID válido, como MLB123456789"),
  });

  const removeRadar = useMutation({
    mutationFn: (id: string) => removeRadarFn({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["competitor-watch"] });
      toast.success("Anúncio removido do radar");
    },
    onError: () => toast.error("Não foi possível remover este anúncio do radar."),
  });

  const calculate = useMutation({
    mutationFn: async () => {
      const costValue = parseNumber(cost);
      const feesValue = parseNumber(fees);
      const marginValue = parseNumber(margin);
      if (!Number.isFinite(costValue) || costValue < 0) throw new Error("Informe um custo válido.");
      if (!Number.isFinite(feesValue) || feesValue < 0 || feesValue >= 100) throw new Error("As taxas devem ficar entre 0% e 99,99%.");
      if (!Number.isFinite(marginValue) || marginValue < 0 || marginValue >= 100) throw new Error("A margem deve ficar entre 0% e 99,99%.");
      return calcFn({
        data: {
          cost_cents: Math.round(costValue * 100),
          fees_percent: feesValue,
          fixed_fees_cents: 0,
          target_margin_percent: marginValue,
        },
      });
    },
    onSuccess: (result) => setPriceResult(result),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Confira os valores da precificação."),
  });

  const copilot = useMutation({
    mutationFn: () => copilotFn({ data: { question } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      setCopilotResult(result.result);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível consultar o copiloto agora."),
  });

  const copyReferral = async () => {
    if (!referral?.code) return;
    try {
      await navigator.clipboard.writeText(referral.code);
      toast.success("Código de indicação copiado");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  };

  return (
    <AppShell title="Central de crescimento" description="Prioridades, margem, concorrência, indicações e IA para vender melhor no Mercado Livre.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Saúde da operação" value={isLoading ? "…" : `${overview?.score ?? 0}/100`} icon={Activity} />
        <Metric label="Pedidos · 30 dias" value={formatNumber(overview?.sales.orders ?? 0)} icon={TrendingUp} />
        <Metric label="Faturamento · 30 dias" value={formatBRL(overview?.sales.revenue_cents ?? 0)} icon={Target} />
        <Metric label="Unidades vendidas" value={formatNumber(overview?.sales.units ?? 0)} icon={Sparkles} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" />O que fazer hoje</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!(overview?.opportunities ?? []).length ? (
              <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                Nenhuma pendência importante encontrada agora. Continue acompanhando vendas, estoque e qualidade dos anúncios.
              </div>
            ) : overview?.opportunities.map((item) => (
              <div key={item.key} className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "secondary" : "outline"}>{item.count}</Badge>
                    <p className="font-semibold">{item.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Button asChild size="sm" variant="outline"><Link to={item.action_to as "/anuncios"}>Corrigir agora</Link></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Resumo comercial</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div><div className="flex justify-between"><span className="text-muted-foreground">Score</span><strong>{overview?.score ?? 0}%</strong></div><Progress className="mt-2" value={overview?.score ?? 0} /></div>
            <Line label="Catálogo ativo" value={formatNumber(overview?.catalog.active ?? 0)} />
            <Line label="Unidades vendidas · 30 dias" value={formatNumber(overview?.sales.units ?? 0)} />
            <Line label="Ticket médio" value={formatBRL(overview?.sales.ticket_cents ?? 0)} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 border-primary/20 bg-primary/[.02]">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" />Copiloto do vendedor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} />
            <Button onClick={() => copilot.mutate()} disabled={copilot.isPending || question.trim().length < 3}>
              {copilot.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Analisar meu negócio
            </Button>
          </div>

          {copilotResult && (
            <div className="rounded-2xl border bg-card p-4">
              <p className="font-display text-lg font-bold">{copilotResult.headline}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{copilotResult.summary}</p>
              {copilotResult.warning && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{copilotResult.warning}</span>
                </div>
              )}
              {!!copilotResult.priorities?.length && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {copilotResult.priorities.map((priority, index) => (
                    <div key={`${priority.title}-${index}`} className="rounded-xl border bg-muted/20 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{priority.title}</p>
                        <Badge variant={priority.impact === "alto" ? "destructive" : priority.impact === "medio" ? "secondary" : "outline"}>{priority.impact}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{priority.reason}</p>
                      <p className="mt-2 flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{priority.action}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-primary" />Precificação inteligente</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Custo (R$)</Label><Input inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} /></div>
              <div><Label>Taxas (%)</Label><Input inputMode="decimal" value={fees} onChange={(event) => setFees(event.target.value)} /></div>
              <div><Label>Margem (%)</Label><Input inputMode="decimal" value={margin} onChange={(event) => setMargin(event.target.value)} /></div>
            </div>
            <Button onClick={() => calculate.mutate()} disabled={calculate.isPending} className="w-full">
              {calculate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Calcular preço sugerido
            </Button>
            {priceResult && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs text-muted-foreground">Preço sugerido</p><p className="font-display text-2xl font-bold">{formatBRL(priceResult.suggested_price_cents)}</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gift className="h-4 w-4 text-primary" />Programa de indicação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Indique novos vendedores e receba anúncios extras quando a indicação converter.</p>
            <div className="rounded-2xl border p-4">
              <p className="text-xs text-muted-foreground">Seu código</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <strong className="min-w-0 truncate font-mono text-lg">{referral?.code ?? "…"}</strong>
                <Button size="sm" variant="outline" disabled={!referral?.code} onClick={() => void copyReferral()}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Radar className="h-4 w-4 text-primary" />Radar de concorrentes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={mlb} onChange={(event) => setMlb(event.target.value)} placeholder="MLB123456789" />
            <Button disabled={addRadar.isPending || mlb.trim().length < 5} onClick={() => addRadar.mutate()}>
              {addRadar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}Acompanhar
            </Button>
          </div>
          {radarLoading ? (
            <p className="text-sm text-muted-foreground">Carregando acompanhamento…</p>
          ) : radar.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Nenhum concorrente acompanhado ainda.</div>
          ) : radar.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <span className="font-mono text-sm">{item.ml_item_id}</span>
              <Button aria-label={`Remover ${item.ml_item_id} do radar`} size="icon" variant="ghost" disabled={removeRadar.isPending} onClick={() => removeRadar.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) {
  return <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></div></CardContent></Card>;
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><strong className="text-right">{value}</strong></div>;
}
