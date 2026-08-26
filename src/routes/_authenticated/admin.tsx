import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { checkIsAdmin } from "@/lib/roles.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  CheckCircle2,
  Copy,
  KeyRound,
  ListChecks,
  Loader2,
  Percent,
  RefreshCcw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Users,
  Webhook,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePeriods, usePlans } from "@/hooks/usePlans";
import {
  adminCreateCoupon,
  adminGetListingsMetrics,
  adminGetMetrics,
  adminGetWebhooksStatus,
  adminLicenseAction,
  adminListActivity,
  adminListClients,
  adminListCoupons,
  adminListFreeTrials,
  adminListInactiveClients,
  adminListPayments,
  adminListSubscriptions,
  adminToggleCoupon,
  adminUpdatePeriodDiscount,
  adminUpdatePlan,
} from "@/lib/admin.functions";
import { getIntegrationsStatus } from "@/lib/integrations.functions";
import { formatBRL, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { generateLicenses } from "@/lib/licenses.functions";
import { supabase } from "@/integrations/supabase/client";
import type { BillingPeriod } from "@/lib/pricing";

const title = "Painel administrativo — ANÚNCIO ML";
const description = "Gestão de licenças, planos, clientes e receita da plataforma ANÚNCIO ML.";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  // Guard de servidor: sem role admin no banco, nada administrativo é renderizado.
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard", replace: true });
    } catch (error) {
      if (isRedirect(error)) throw error;
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: AdminPage,
});

type Origin = "mercado_pago" | "pix_manual" | "courtesy" | "promo" | "partner" | "admin";

function AdminPage() {
  const [activeSection, setActiveSection] = useState("dashboard");

  return (
    <AdminLayout activeSection={activeSection} onSectionChange={setActiveSection}>
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsContent value="dashboard" className="mt-0">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="clientes" className="mt-0">
          <ClientsTab />
        </TabsContent>
        <TabsContent value="inativos" className="mt-0">
          <InactiveTab />
        </TabsContent>
        <TabsContent value="licencas" className="mt-0">
          <LicensesTab />
        </TabsContent>
        <TabsContent value="pagamentos" className="mt-0">
          <PaymentsTab />
        </TabsContent>
        <TabsContent value="assinaturas" className="mt-0">
          <SubscriptionsTab />
        </TabsContent>
        <TabsContent value="anuncios" className="mt-0">
          <ListingsTab />
        </TabsContent>
        <TabsContent value="testes" className="mt-0">
          <FreeTrialsTab />
        </TabsContent>
        <TabsContent value="integracoes" className="mt-0">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-0">
          <LogsTab />
        </TabsContent>
        <TabsContent value="planos" className="mt-0">
          <PlansTab />
        </TabsContent>
        <TabsContent value="configuracoes" className="mt-0">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="suporte" className="mt-0">
          <SupportTab />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="mt-2 font-display text-2xl font-extrabold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function DashboardTab() {
  const getMetrics = useServerFn(adminGetMetrics);
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => getMetrics(),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Usuários" value={formatNumber(metrics?.users)} />
        <StatCard label="Clientes pagantes" value={formatNumber(metrics?.payingUsers)} />
        <StatCard label="Licenças ativas" value={formatNumber(metrics?.licensesActive)} />
        <StatCard label="Licenças expiradas" value={formatNumber(metrics?.licensesExpired)} />
        <StatCard label="Testes gratuitos usados" value={formatNumber(metrics?.freeTrialUsers)} />
        <StatCard label="Cancelamentos" value={formatNumber(metrics?.licensesCancelled)} />
        <StatCard label="Receita aprovada" value={formatBRL(metrics?.revenueTotalCents)} />
        <StatCard label="MRR (mês atual)" value={formatBRL(metrics?.mrrCents)} />
        <StatCard label="Anúncios processados" value={formatNumber(metrics?.listingsTotal)} />
        <StatCard label="Pagamentos recusados" value={formatNumber(metrics?.failedPayments)} />
        <StatCard label="Novos usuários (7d)" value={formatNumber(metrics?.newUsers7d)} />
        <StatCard label="Clientes ativos" value={formatNumber(metrics?.activeClients)} />
        <StatCard label="Clientes inativos" value={formatNumber(metrics?.inactiveClients)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receita aprovada — últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {metrics?.revenueByMonth && metrics.revenueByMonth.some((m) => m.amount_cents > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => formatBRL(v)} width={80} />
                <RTooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="amount_cents" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Ainda não há receita aprovada registrada.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const CLIENT_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "ativos", label: "Ativos" },
  { value: "inativos", label: "Inativos" },
  { value: "expirados", label: "Expirados" },
  { value: "teste", label: "Teste" },
  { value: "pagantes", label: "Pagantes" },
] as const;

function ClientsTab() {
  const listClients = useServerFn(adminListClients);
  const [filter, setFilter] = useState<(typeof CLIENT_FILTERS)[number]["value"]>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-clients", filter, search, page],
    queryFn: () => listClients({ data: { filter, search: search || undefined, page, pageSize } }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" /> Clientes
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-56"
          />
          <Select value={filter} onValueChange={(v) => { setFilter(v as typeof filter); setPage(0); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLIENT_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (data?.clients ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Licença</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Último acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{c.full_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-xs">{c.plan ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.status === "ativo" ? "default" : c.status === "teste" ? "secondary" : "outline"
                        }
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.license_code ?? "—"}</TableCell>
                    <TableCell className="text-xs">{formatDate(c.created_at)}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(c.last_seen_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatNumber(data?.total)} cliente(s)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(data?.clients.length ?? 0) < pageSize}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InactiveTab() {
  const listInactive = useServerFn(adminListInactiveClients);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-inactive"],
    queryFn: () => listInactive(),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  const groups = [
    { key: "trialNaoConvertido", label: "Teste não convertido", items: data?.trialNaoConvertido ?? [] },
    { key: "licencaExpirada", label: "Licença expirada", items: data?.licencaExpirada ?? [] },
    { key: "assinaturaCancelada", label: "Assinatura cancelada", items: data?.assinaturaCancelada ?? [] },
    { key: "pagamentoFalho", label: "Pagamento falho", items: data?.pagamentoFalho ?? [] },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((g) => (
        <Card key={g.key}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              {g.label}
              <Badge variant="outline">{g.items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {g.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro.</p>
            ) : (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {g.items.slice(0, 8).map((item: any) => (
                  <li key={item.id} className="truncate">
                    {item.email ?? item.code ?? item.id}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LicensesTab() {
  const queryClient = useQueryClient();
  const { data: plans = [] } = usePlans();
  const generate = useServerFn(generateLicenses);
  const licenseAction = useServerFn(adminLicenseAction);

  const [planId, setPlanId] = useState("");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [origin, setOrigin] = useState<Origin>("pix_manual");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<string[]>([]);

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["admin-licenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*, plans(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createLicenses = useMutation({
    mutationFn: () =>
      generate({
        data: { plan_id: planId, period, origin, quantity: Number(quantity) || 1, note: note || null },
      }),
    onSuccess: (result) => {
      setCreated(result.licenses.map((l) => l.code));
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      toast.success(`${result.created} licença(s) gerada(s)`);
    },
    onError: () => toast.error("Não foi possível gerar as licenças."),
  });

  const action = useMutation({
    mutationFn: (vars: { id: string; action: "activate" | "suspend" | "cancel" | "renew" }) =>
      licenseAction({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      toast.success("Licença atualizada");
    },
    onError: () => toast.error("Sem permissão ou falha ao atualizar."),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" /> Gerar licenças (em lote)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as BillingPeriod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">3 meses</SelectItem>
                  <SelectItem value="semiannual">6 meses</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={origin} onValueChange={(v) => setOrigin(v as Origin)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix_manual">Pix manual</SelectItem>
                <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                <SelectItem value="courtesy">Cortesia</SelectItem>
                <SelectItem value="promo">Promoção</SelectItem>
                <SelectItem value="partner">Parceiro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button className="w-full" disabled={!planId || createLicenses.isPending} onClick={() => createLicenses.mutate()}>
            {createLicenses.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar
          </Button>

          {created.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Chaves geradas</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(created.join("\n"));
                    toast.success("Todas as chaves copiadas");
                  }}
                >
                  Copiar todas
                </Button>
              </div>
              <div className="space-y-1 font-mono text-xs">
                {created.map((code) => (
                  <div key={code} className="flex items-center justify-between gap-2">
                    <span>{code}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        void navigator.clipboard.writeText(code);
                        toast.success("Chave copiada");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Licenças (histórico)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chave</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((license: any) => (
                  <TableRow key={license.id}>
                    <TableCell className="font-mono text-xs">{license.code}</TableCell>
                    <TableCell className="text-xs">{license.plans?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={license.status === "active" ? "default" : "outline"}>{license.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(license.expires_at)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Copiar código"
                        onClick={() => { void navigator.clipboard.writeText(license.code); toast.success("Código copiado"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {license.status !== "active" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Ativar"
                          onClick={() => action.mutate({ id: license.id, action: "activate" })}>
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {license.status === "active" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Suspender"
                          onClick={() => action.mutate({ id: license.id, action: "suspend" })}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Renovar"
                        onClick={() => action.mutate({ id: license.id, action: "renew" })}>
                        <RefreshCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Cancelar"
                        onClick={() => action.mutate({ id: license.id, action: "cancel" })}>
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlansTab() {
  const queryClient = useQueryClient();
  const { data: plans = [], isLoading } = usePlans();
  const { data: periods = [] } = usePeriods();
  const updatePlan = useServerFn(adminUpdatePlan);
  const updateDiscount = useServerFn(adminUpdatePeriodDiscount);

  const [edits, setEdits] = useState<Record<string, { price: string }>>({});
  const [discountEdits, setDiscountEdits] = useState<Record<string, string>>({});

  const savePlan = useMutation({
    mutationFn: (planId: string) =>
      updatePlan({
        data: { id: planId, price_monthly_cents: Math.round(Number(edits[planId]?.price ?? "0") * 100) },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plano atualizado");
    },
    onError: () => toast.error("Falha ao atualizar plano."),
  });

  const saveDiscount = useMutation({
    mutationFn: (period: BillingPeriod) =>
      updateDiscount({ data: { period, discount_percent: Number(discountEdits[period] ?? "0") } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["period-discounts"] });
      toast.success("Desconto atualizado");
    },
    onError: () => toast.error("Falha ao atualizar desconto."),
  });

  if (isLoading) {
    return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle className="text-base">{plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Preço mensal (R$)</Label>
                <Input
                  defaultValue={(plan.price_monthly_cents / 100).toFixed(2)}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [plan.id]: { price: e.target.value } }))}
                />
              </div>
              <Button size="sm" className="w-full" disabled={savePlan.isPending} onClick={() => savePlan.mutate(plan.id)}>
                {savePlan.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Salvar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descontos por período</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {periods.map((p) => (
            <div key={p.period} className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-sm font-medium">{p.label}</p>
              <div className="flex items-center gap-2">
                <Input
                  className="w-20"
                  defaultValue={String(p.discount_percent)}
                  onChange={(e) => setDiscountEdits((prev) => ({ ...prev, [p.period]: e.target.value }))}
                />
                <span className="text-xs text-muted-foreground">%</span>
                <Button size="sm" variant="outline" onClick={() => saveDiscount.mutate(p.period)}>
                  Salvar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

const PAYMENT_STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "approved", label: "Aprovado" },
  { value: "pending", label: "Pendente" },
  { value: "rejected", label: "Recusado" },
  { value: "cancelled", label: "Cancelado" },
] as const;

function paymentStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "approved") return "default";
  if (status === "pending") return "secondary";
  if (status === "rejected") return "destructive";
  return "outline";
}

function PaymentsTab() {
  const listPayments = useServerFn(adminListPayments);
  const [status, setStatus] = useState<(typeof PAYMENT_STATUS_FILTERS)[number]["value"]>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments", status, page],
    queryFn: () => listPayments({ data: { status, page, pageSize } }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Pagamentos</CardTitle>
        <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (data?.payments ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento encontrado.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Referência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{formatDateTime(p.created_at)}</TableCell>
                    <TableCell className="text-xs">{p.email ?? "—"}</TableCell>
                    <TableCell className="text-xs">{p.plan ?? "—"}</TableCell>
                    <TableCell className="text-xs">{p.period ?? "—"}</TableCell>
                    <TableCell className="text-xs">{formatBRL(p.amount_cents)}</TableCell>
                    <TableCell>
                      <Badge variant={paymentStatusVariant(p.status)}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.provider_ref ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatNumber(data?.total)} pagamento(s)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={(data?.payments.length ?? 0) < pageSize} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const SUBSCRIPTION_STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativa" },
  { value: "available", label: "Disponível" },
  { value: "expired", label: "Expirada" },
  { value: "suspended", label: "Suspensa" },
  { value: "cancelled", label: "Cancelada" },
] as const;

function SubscriptionsTab() {
  const listSubscriptions = useServerFn(adminListSubscriptions);
  const [status, setStatus] = useState<(typeof SUBSCRIPTION_STATUS_FILTERS)[number]["value"]>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions", status, page],
    queryFn: () => listSubscriptions({ data: { status, page, pageSize } }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Assinaturas</CardTitle>
        <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUBSCRIPTION_STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (data?.subscriptions ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma assinatura encontrada.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ativação</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Dias restantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.subscriptions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.email ?? "—"}</TableCell>
                    <TableCell className="text-xs">{s.plan ?? "—"}</TableCell>
                    <TableCell className="text-xs">{s.period}</TableCell>
                    <TableCell><Badge variant={s.status === "active" ? "default" : "outline"}>{s.status}</Badge></TableCell>
                    <TableCell className="text-xs">{formatDate(s.created_at)}</TableCell>
                    <TableCell className="text-xs">{formatDate(s.expires_at)}</TableCell>
                    <TableCell className="text-xs">
                      {s.daysRemaining === null ? "—" : s.daysRemaining < 0 ? "Vencida" : `${s.daysRemaining} dia(s)`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatNumber(data?.total)} assinatura(s)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={(data?.subscriptions.length ?? 0) < pageSize} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ListingsTab() {
  const getListingsMetrics = useServerFn(adminGetListingsMetrics);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-listings-metrics"],
    queryFn: () => getListingsMetrics(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de anúncios" value={formatNumber(data?.total)} />
        <StatCard label="Ativos" value={formatNumber(data?.active)} />
        <StatCard label="Pausados" value={formatNumber(data?.paused)} />
        <StatCard label="Encerrados" value={formatNumber(data?.closed)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" /> Jobs em lote recentes
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(data?.jobs ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum job registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-xs">{j.kind}</TableCell>
                    <TableCell className="text-xs">{j.email ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{j.status}</Badge></TableCell>
                    <TableCell className="w-44">
                      <div className="flex items-center gap-2">
                        <Progress value={j.total ? (j.processed / j.total) * 100 : 0} className="h-2" />
                        <span className="text-xs text-muted-foreground">{j.processed}/{j.total}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{formatNumber(j.failed)}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(j.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FreeTrialsTab() {
  const listFreeTrials = useServerFn(adminListFreeTrials);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-free-trials"],
    queryFn: () => listFreeTrials(),
  });

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const trials = data?.trials ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Testes gratuitos</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {trials.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário em teste.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Uso</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trials.map((t) => (
                <TableRow key={t.id} className={t.exhausted && !t.converted ? "bg-destructive/5" : undefined}>
                  <TableCell className="text-xs">
                    <div>{t.full_name ?? "—"}</div>
                    <div className="text-muted-foreground">{t.email}</div>
                  </TableCell>
                  <TableCell className="w-48">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={t.free_listings_limit ? Math.min((t.free_listings_used / t.free_listings_limit) * 100, 100) : 0}
                        className="h-2"
                      />
                      <span className="text-xs text-muted-foreground">
                        {t.free_listings_used}/{t.free_listings_limit}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{formatDate(t.created_at)}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(t.last_seen_at)}</TableCell>
                  <TableCell>
                    {t.converted ? (
                      <Badge variant="default">Convertido</Badge>
                    ) : t.exhausted ? (
                      <Badge variant="destructive">Esgotado sem conversão</Badge>
                    ) : (
                      <Badge variant="secondary">Em teste</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationCard({
  title,
  connected,
  pendingLabel,
  detail,
}: {
  title: string;
  connected: boolean;
  pendingLabel: string;
  detail?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          {title}
          {connected ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Badge variant={connected ? "default" : "outline"}>{connected ? "Conectado" : pendingLabel}</Badge>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function IntegrationsTab() {
  const getIntegrations = useServerFn(getIntegrationsStatus);
  const getWebhooks = useServerFn(adminGetWebhooksStatus);

  const { data: integrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: ["admin-integrations"],
    queryFn: () => getIntegrations(),
  });
  const { data: webhooks, isLoading: loadingWebhooks } = useQuery({
    queryKey: ["admin-webhooks"],
    queryFn: () => getWebhooks(),
  });

  if (loadingIntegrations || loadingWebhooks) {
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <IntegrationCard
        title="Mercado Livre"
        connected={!!integrations?.mercadoLivre.connected}
        pendingLabel="Configuração pendente"
        detail={integrations?.mercadoLivre.nickname ? `Conta: ${integrations.mercadoLivre.nickname}` : "Nenhuma conta conectada"}
      />
      <IntegrationCard
        title="Mercado Pago"
        connected={!!integrations?.mercadoPago.hasMercadoPagoToken}
        pendingLabel="Configuração pendente"
        detail={integrations?.mercadoPago.hasMercadoPagoToken ? "Token configurado" : "Token de acesso não configurado"}
      />
      <IntegrationCard
        title="ANÚNCIO AI"
        connected={!!integrations?.anuncioAi.aiConfigured}
        pendingLabel="Configuração pendente"
        detail={integrations?.anuncioAi.aiConfigured ? "Chave de IA configurada" : "Chave de IA não configurada"}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4 text-primary" /> Webhooks ML (24h)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-2xl font-extrabold">{formatNumber(webhooks?.processedLast24h)}</p>
          <p className="text-xs text-muted-foreground">
            processadas de {formatNumber(webhooks?.receivedLast24h)} recebidas nas últimas 24h
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LogsTab() {
  const listActivity = useServerFn(adminListActivity);
  const [kind, setKind] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-logs", kind],
    queryFn: () => listActivity({ data: { kind: kind || undefined } }),
  });

  const kinds = Array.from(new Set((data?.events ?? []).map((e) => e.kind)));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4 text-primary" /> Logs de atividade
        </CardTitle>
        <Select value={kind || "all"} onValueChange={(v) => setKind(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {kinds.map((k) => (
              <SelectItem key={k} value={k}>{k}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : (data?.events ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento registrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Badge variant="outline">{e.kind}</Badge></TableCell>
                  <TableCell className="text-xs">{e.message}</TableCell>
                  <TableCell className="text-xs">{e.email ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(e.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CouponsCard() {
  const queryClient = useQueryClient();
  const listCoupons = useServerFn(adminListCoupons);
  const createCoupon = useServerFn(adminCreateCoupon);
  const toggleCoupon = useServerFn(adminToggleCoupon);

  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [maxUses, setMaxUses] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => listCoupons(),
  });

  const create = useMutation({
    mutationFn: () =>
      createCoupon({
        data: {
          code,
          discount_percent: Number(discount) || 0,
          max_uses: maxUses ? Number(maxUses) : null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      setCode("");
      setMaxUses("");
      toast.success("Cupom criado");
    },
    onError: () => toast.error("Falha ao criar cupom. Verifique o código."),
  });

  const toggle = useMutation({
    mutationFn: (vars: { code: string; active: boolean }) => toggleCoupon({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Cupom atualizado");
    },
    onError: () => toast.error("Falha ao atualizar cupom."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ticket className="h-4 w-4 text-primary" /> Cupons de desconto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-2">
            <Label>Código</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PROMO10" />
          </div>
          <div className="space-y-2">
            <Label>Desconto (%)</Label>
            <Input value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Máx. usos (opcional)</Label>
            <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Ilimitado" />
          </div>
          <div className="flex items-end">
            <Button className="w-full" disabled={!code || create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar cupom
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (data?.coupons ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cupom cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.coupons.map((c: any) => (
                  <TableRow key={c.code}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="text-xs">{c.discount_percent}%</TableCell>
                    <TableCell className="text-xs">{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""}</TableCell>
                    <TableCell className="text-xs">{c.expires_at ? formatDate(c.expires_at) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.active ? "default" : "outline"}>{c.active ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ code: c.code, active: !c.active })}
                      >
                        {c.active ? "Desativar" : "Ativar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsTab() {
  const { data: periods = [], isLoading } = usePeriods();
  const queryClient = useQueryClient();
  const updateDiscount = useServerFn(adminUpdatePeriodDiscount);
  const [discountEdits, setDiscountEdits] = useState<Record<string, string>>({});

  const saveDiscount = useMutation({
    mutationFn: (period: BillingPeriod) =>
      updateDiscount({ data: { period, discount_percent: Number(discountEdits[period] ?? "0") } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["period-discounts"] });
      toast.success("Desconto atualizado");
    },
    onError: () => toast.error("Falha ao atualizar desconto."),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4 text-primary" /> Descontos por período
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : (
            periods.map((p) => (
              <div key={p.period} className="space-y-2 rounded-xl border border-border p-3">
                <p className="text-sm font-medium">{p.label}</p>
                <div className="flex items-center gap-2">
                  <Input
                    className="w-20"
                    defaultValue={String(p.discount_percent)}
                    onChange={(e) => setDiscountEdits((prev) => ({ ...prev, [p.period]: e.target.value }))}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  <Button size="sm" variant="outline" onClick={() => saveDiscount.mutate(p.period)}>
                    Salvar
                  </Button>
                </div>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-4">
            Esta configuração também pode ser editada na aba "Planos e preços".
          </p>
        </CardContent>
      </Card>

      <CouponsCard />
    </div>
  );
}
