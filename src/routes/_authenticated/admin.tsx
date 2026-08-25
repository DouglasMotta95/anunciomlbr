import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  Copy,
  KeyRound,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Users,
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

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin } from "@/hooks/useAuth";
import { usePeriods, usePlans } from "@/hooks/usePlans";
import {
  adminGetMetrics,
  adminLicenseAction,
  adminListClients,
  adminListInactiveClients,
  adminUpdatePeriodDiscount,
  adminUpdatePlan,
} from "@/lib/admin.functions";
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
  component: AdminPage,
});

type Origin = "mercado_pago" | "pix_manual" | "courtesy" | "promo" | "partner" | "admin";

function AdminPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <AppShell title="Painel administrativo">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Painel administrativo">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <p className="font-display text-lg font-bold">Acesso restrito</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Esta área é exclusiva para administradores da plataforma.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Painel administrativo" description="Métricas, clientes, licenças e planos.">
      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="inativos">Clientes inativos</TabsTrigger>
          <TabsTrigger value="licencas">Licenças</TabsTrigger>
          <TabsTrigger value="planos">Planos e preços</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="clientes" className="mt-4">
          <ClientsTab />
        </TabsContent>
        <TabsContent value="inativos" className="mt-4">
          <InactiveTab />
        </TabsContent>
        <TabsContent value="licencas" className="mt-4">
          <LicensesTab />
        </TabsContent>
        <TabsContent value="planos" className="mt-4">
          <PlansTab />
        </TabsContent>
      </Tabs>
    </AppShell>
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
