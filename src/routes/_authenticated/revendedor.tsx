import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Loader2, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePlans } from "@/hooks/usePlans";
import { formatBRL, formatDateTime } from "@/lib/format";
import { resellerIssueLicense } from "@/lib/reseller.functions";
import { getResellerDashboard } from "@/lib/seller-growth.functions";
import type { BillingPeriod } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/revendedor")({
  head: () => ({ meta: [{ title: "Painel do revendedor — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: ResellerPage,
});

function ResellerPage() {
  const dashboardFn = useServerFn(getResellerDashboard);
  const issueFn = useServerFn(resellerIssueLicense);
  const { data, isLoading } = useQuery({ queryKey: ["reseller-dashboard"], queryFn: () => dashboardFn() });
  const { data: plans = [] } = usePlans();
  const qc = useQueryClient();
  const [planId, setPlanId] = useState("");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [lastCode, setLastCode] = useState<string | null>(null);

  const issue = useMutation({
    mutationFn: () => issueFn({ data: { plan_id: planId, period } }),
    onSuccess: (result) => { setLastCode(result.license_code); qc.invalidateQueries({ queryKey: ["reseller-dashboard"] }); toast.success("Licença emitida"); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao emitir licença"),
  });

  if (isLoading) return <AppShell title="Painel do revendedor"><p className="text-sm text-muted-foreground">Carregando…</p></AppShell>;
  if (!data?.enabled) return <AppShell title="Painel do revendedor" description="Área exclusiva para parceiros autorizados."><Card><CardContent className="py-10 text-center"><Store className="mx-auto h-8 w-8 text-muted-foreground"/><p className="mt-3 font-semibold">Seu cadastro ainda não está habilitado como revendedor.</p><p className="mt-1 text-sm text-muted-foreground">O acesso é liberado pelo administrador da plataforma.</p></CardContent></Card></AppShell>;

  return <AppShell title="Painel do revendedor" description="Emita licenças com seu saldo pré-pago e acompanhe suas vendas.">
    <div className="grid gap-4 md:grid-cols-3"><Metric label="Saldo disponível" value={formatBRL(data.reseller.wallet_cents)} /><Metric label="Vendas acumuladas" value={formatBRL(data.reseller.total_sales_cents)} /><Metric label="Margem acumulada" value={formatBRL(data.reseller.total_commission_cents)} /></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Card><CardHeader><CardTitle className="text-base">Emitir licença</CardTitle></CardHeader><CardContent className="space-y-3"><div><Label>Plano</Label><Select value={planId} onValueChange={setPlanId}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{plans.map((p)=><SelectItem key={p.id} value={p.id}>{p.name} · {formatBRL(p.price_monthly_cents)}/mês</SelectItem>)}</SelectContent></Select></div><div><Label>Período</Label><Select value={period} onValueChange={(v)=>setPeriod(v as BillingPeriod)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="monthly">Mensal</SelectItem><SelectItem value="quarterly">3 meses</SelectItem><SelectItem value="semiannual">6 meses</SelectItem><SelectItem value="annual">Anual</SelectItem></SelectContent></Select></div><div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">Seu custo usa {Number(data.reseller.discount_percent)}% de desconto sobre o preço comercial. O valor é descontado do saldo no momento da emissão.</div><Button className="w-full" disabled={!planId || issue.isPending} onClick={()=>issue.mutate()}>{issue.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<KeyRound className="mr-2 h-4 w-4"/>Gerar licença</Button>{lastCode && <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Última licença</p><div className="mt-1 flex items-center justify-between gap-2"><code className="font-bold">{lastCode}</code><Button size="icon" variant="ghost" onClick={()=>navigator.clipboard.writeText(lastCode)}><Copy className="h-4 w-4"/></Button></div></div>}</CardContent></Card>
      <Card className="lg:col-span-2"><CardHeader><CardTitle className="text-base">Histórico de vendas</CardTitle></CardHeader><CardContent className="overflow-x-auto">{data.sales.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma licença emitida ainda.</p> : <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Plano</TableHead><TableHead>Preço sugerido</TableHead><TableHead>Seu custo</TableHead><TableHead>Margem</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{data.sales.map((s:any)=><TableRow key={s.id}><TableCell className="text-xs">{formatDateTime(s.created_at)}</TableCell><TableCell>{s.plans?.name ?? "—"}</TableCell><TableCell>{formatBRL(s.sale_price_cents)}</TableCell><TableCell>{formatBRL(s.reseller_cost_cents)}</TableCell><TableCell>{formatBRL(s.commission_cents)}</TableCell><TableCell><Badge variant={s.status === "completed" ? "default" : "outline"}>{s.status === "completed" ? "Concluída" : s.status}</Badge></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
    </div>
  </AppShell>;
}

function Metric({ label, value }: { label:string; value:string }) { return <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></CardContent></Card>; }
