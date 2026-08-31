import { createFileRoute, Link, type LinkComponentProps } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, Bot, Calculator, Check, Copy, Eye, Gift, Loader2, Radar, Sparkles, Target, Trash2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, formatNumber } from "@/lib/format";
import { askSellerCopilot } from "@/lib/seller-copilot.functions";
import { addCompetitorWatch, calculateSmartPrice, getReferralSummary, getSellerGrowthOverview, listCompetitorWatch, removeCompetitorWatch } from "@/lib/seller-growth.functions";

export const Route = createFileRoute("/_authenticated/crescimento")({ head: () => ({ meta: [{ title: "Central de crescimento — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }), component: GrowthPage });

type CopilotResult = { headline: string; summary: string; priorities?: Array<{ title: string; reason: string; action: string; impact: "alto" | "medio" | "baixo" }>; warning?: string | null };
type GrowthTo = NonNullable<LinkComponentProps["to"]>;
const parseNumber = (value: string) => Number(value.trim().replace(/\./g, "").replace(",", "."));

function growthDestination(value: unknown): GrowthTo {
  switch (value) {
    case "/assinatura": return "/assinatura";
    case "/buscar": return "/buscar";
    case "/creditos": return "/creditos";
    case "/creditos-ia": return "/creditos-ia";
    case "/estoque": return "/estoque";
    case "/integracoes": return "/integracoes";
    case "/notificacoes": return "/notificacoes";
    case "/perguntas": return "/perguntas";
    case "/saude-anuncios": return "/saude-anuncios";
    case "/vendas": return "/vendas";
    case "/anuncios":
    default: return "/anuncios";
  }
}

function GrowthPage() {
  const overviewFn = useServerFn(getSellerGrowthOverview), referralFn = useServerFn(getReferralSummary), radarFn = useServerFn(listCompetitorWatch), addRadarFn = useServerFn(addCompetitorWatch), removeRadarFn = useServerFn(removeCompetitorWatch), calcFn = useServerFn(calculateSmartPrice), copilotFn = useServerFn(askSellerCopilot);
  const qc = useQueryClient();
  const overviewQuery = useQuery({ queryKey: ["seller-growth"], queryFn: () => overviewFn() });
  const { data: referral } = useQuery({ queryKey: ["referral-summary"], queryFn: () => referralFn() });
  const { data: radar = [], isLoading: radarLoading } = useQuery({ queryKey: ["competitor-watch"], queryFn: () => radarFn() });
  const overview = overviewQuery.data;
  const [mlb, setMlb] = useState(""), [cost, setCost] = useState("100"), [fees, setFees] = useState("16"), [margin, setMargin] = useState("20"), [question, setQuestion] = useState("O que eu devo fazer hoje para melhorar minha operação?"), [priceResult, setPriceResult] = useState<{ suggested_price_cents: number } | null>(null), [copilotResult, setCopilotResult] = useState<CopilotResult | null>(null);

  const addRadar = useMutation({ mutationFn: () => addRadarFn({ data: { ml_item_id: mlb.trim().toUpperCase() } }), onSuccess: () => { setMlb(""); void qc.invalidateQueries({ queryKey: ["competitor-watch"] }); toast.success("Anúncio adicionado ao radar"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Use um ID válido, como MLB123456789") });
  const removeRadar = useMutation({ mutationFn: (id: string) => removeRadarFn({ data: { id } }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["competitor-watch"] }); toast.success("Anúncio removido do radar"); }, onError: () => toast.error("Não foi possível remover este anúncio do radar.") });
  const calculate = useMutation({ mutationFn: async () => { const c = parseNumber(cost), f = parseNumber(fees), m = parseNumber(margin); if (!Number.isFinite(c) || c <= 0) throw new Error("Informe um custo maior que zero."); if (!Number.isFinite(f) || f < 0 || f > 60) throw new Error("As taxas devem ficar entre 0% e 60%."); if (!Number.isFinite(m) || m < 1 || m > 80) throw new Error("A margem deve ficar entre 1% e 80%."); return calcFn({ data: { cost_cents: Math.round(c * 100), fees_percent: f, fixed_fees_cents: 0, target_margin_percent: m } }); }, onSuccess: setPriceResult, onError: (error) => toast.error(error instanceof Error ? error.message : "Confira os valores da precificação.") });
  const copilot = useMutation({ mutationFn: () => copilotFn({ data: { question } }), onSuccess: (result) => { if (!result.ok) { toast.error(result.reason); return; } setCopilotResult(result.result); toast.success("Análise concluída", { description: "Copiloto incluído no seu acesso — nenhum crédito de IA foi consumido." }); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível consultar o copiloto agora.") });
  const copyReferral = async () => { if (!referral?.code) return; try { await navigator.clipboard.writeText(referral.code); toast.success("Código copiado"); } catch { toast.error("Não foi possível copiar o código."); } };

  if (overviewQuery.isError) return <AppShell title="Central de crescimento" description="Prioridades e ferramentas comerciais baseadas nos dados disponíveis."><Card><CardContent className="py-10 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-destructive"/><p className="mt-3 font-semibold">Não foi possível carregar os dados agora.</p><p className="mt-1 text-sm text-muted-foreground">Nenhuma métrica será estimada como se fosse real.</p><Button className="mt-4" variant="outline" onClick={() => overviewQuery.refetch()}>Tentar novamente</Button></CardContent></Card></AppShell>;

  return <AppShell title="Central de crescimento" description="Prioridades objetivas, margem, concorrência e IA — sem misturar estimativas com resultados reais.">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Saúde da operação" value={overviewQuery.isLoading ? "…" : `${overview?.score ?? 0}/100`} icon={Activity}/><Metric label="Pedidos · 30 dias" value={formatNumber(overview?.sales.orders ?? 0)} icon={TrendingUp}/><Metric label="Faturamento · 30 dias" value={formatBRL(overview?.sales.revenue_cents ?? 0)} icon={Target}/><Metric label="Catálogo ativo" value={formatNumber(overview?.catalog.active ?? 0)} icon={Sparkles}/>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Card><CardHeader><CardTitle className="text-base">Prioridades da operação</CardTitle></CardHeader><CardContent className="space-y-2">{!(overview?.opportunities ?? []).length ? <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Nenhuma pendência importante encontrada com os dados disponíveis.</div> : overview?.opportunities.slice(0,5).map((item) => <div key={item.key} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><Badge variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "secondary" : "outline"}>{item.count}</Badge><p className="font-semibold">{item.title}</p></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p></div><Button asChild size="sm" variant="outline" className="shrink-0"><Link to={growthDestination(item.action_to)}>Corrigir</Link></Button></div>)}</CardContent></Card>
      <Card className="border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary"/>Copiloto do vendedor</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-xs leading-5 text-muted-foreground">A IA usa apenas os dados disponíveis na sua conta. <strong className="text-foreground">Copiloto incluído no seu acesso — não consome créditos de IA.</strong></p><Input value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)}/><Button className="w-full" onClick={() => copilot.mutate()} disabled={copilot.isPending || question.trim().length < 3}>{copilot.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}Analisar com Copiloto</Button>{copilotResult && <div className="rounded-xl border bg-muted/20 p-4"><p className="font-semibold">{copilotResult.headline}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{copilotResult.summary}</p>{copilotResult.warning && <div className="mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs"><AlertTriangle className="h-4 w-4 shrink-0"/>{copilotResult.warning}</div>}<div className="mt-3 space-y-2">{copilotResult.priorities?.slice(0,3).map((p, i) => <div key={`${p.title}-${i}`} className="rounded-lg border bg-background p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{p.title}</p><Badge variant={p.impact === "alto" ? "destructive" : "outline"}>{p.impact}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{p.reason}</p><p className="mt-2 flex gap-2 text-xs"><Check className="h-4 w-4 shrink-0 text-primary"/>{p.action}</p></div>)}</div></div>}</CardContent></Card>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-primary"/>Precificação inteligente</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Field label="Custo (R$)" value={cost} set={setCost}/><Field label="Taxas (%)" value={fees} set={setFees}/><Field label="Margem (%)" value={margin} set={setMargin}/></div><Button className="w-full" onClick={() => calculate.mutate()} disabled={calculate.isPending}>{calculate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Calcular preço sugerido</Button>{priceResult && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs text-muted-foreground">Preço sugerido</p><p className="font-display text-2xl font-bold">{formatBRL(priceResult.suggested_price_cents)}</p></div>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gift className="h-4 w-4 text-primary"/>Programa de indicação</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Indique novos vendedores e receba anúncios extras quando a indicação converter.</p><div className="flex items-center justify-between rounded-xl border p-4"><div><p className="text-xs text-muted-foreground">Seu código</p><strong className="font-mono text-lg">{referral?.code ?? "…"}</strong></div><Button size="sm" variant="outline" disabled={!referral?.code} onClick={() => void copyReferral()}><Copy className="mr-2 h-4 w-4"/>Copiar</Button></div></CardContent></Card>
    </div>

    <Card className="mt-4"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Radar className="h-4 w-4 text-primary"/>Radar de concorrentes</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row"><Input value={mlb} onChange={(e) => setMlb(e.target.value)} placeholder="MLB123456789"/><Button disabled={addRadar.isPending || mlb.trim().length < 5} onClick={() => addRadar.mutate()}>{addRadar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Eye className="mr-2 h-4 w-4"/>}Acompanhar</Button></div>{radarLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : radar.length === 0 ? <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Nenhum concorrente acompanhado ainda.</div> : <div className="grid gap-2 sm:grid-cols-2">{radar.map((row: any) => <div key={row.id} className="flex items-center justify-between rounded-xl border p-3"><div className="min-w-0"><p className="truncate font-mono text-xs">{row.ml_item_id}</p>{row.title && <p className="mt-1 truncate text-sm">{row.title}</p>}</div><Button size="icon" variant="ghost" onClick={() => removeRadar.mutate(row.id)} disabled={removeRadar.isPending}><Trash2 className="h-4 w-4"/></Button></div>)}</div>}</CardContent></Card>
  </AppShell>;
}

function Metric({ label, value, icon: Icon }: any) { return <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></div><div className="rounded-xl bg-primary/10 p-2"><Icon className="h-4 w-4 text-primary"/></div></div></CardContent></Card>; }
function Field({ label, value, set }: { label: string; value: string; set: (v: string) => void }) { return <div><Label>{label}</Label><Input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)}/></div>; }
