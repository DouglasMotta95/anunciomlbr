import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Loader2, ShieldAlert, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin } from "@/hooks/useAuth";
import { usePlans } from "@/hooks/usePlans";
import { supabase } from "@/integrations/supabase/client";
import { generateLicenses } from "@/lib/licenses.functions";
import { formatBRL, formatDate } from "@/lib/format";
import type { BillingPeriod } from "@/lib/pricing";

const title = "Painel administrativo — ANÚNCIO ML";
const description = "Gestão de licenças, planos, usuários e pagamentos da plataforma ANÚNCIO ML.";

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
  const queryClient = useQueryClient();
  const { data: plans = [] } = usePlans();
  const generate = useServerFn(generateLicenses);

  const [planId, setPlanId] = useState("");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [origin, setOrigin] = useState<Origin>("pix_manual");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<string[]>([]);

  const { data: licenses = [] } = useQuery({
    queryKey: ["admin-licenses"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*, plans(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const [users, active, listings, payments] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("licenses").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("listings").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount_cents").eq("status", "approved"),
      ]);
      const revenue = (payments.data ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
      return {
        users: users.count ?? 0,
        activeLicenses: active.count ?? 0,
        listings: listings.count ?? 0,
        revenue,
      };
    },
  });

  const createLicenses = useMutation({
    mutationFn: () =>
      generate({
        data: {
          plan_id: planId,
          period,
          origin,
          quantity: Number(quantity) || 1,
          note: note || null,
        },
      }),
    onSuccess: (result) => {
      setCreated(result.licenses.map((license) => license.code));
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      toast.success(`${result.created} licença(s) gerada(s)`);
    },
    onError: () => toast.error("Não foi possível gerar as licenças."),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" | "cancelled" }) => {
      const { error } = await supabase.from("licenses").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-licenses"] });
      toast.success("Licença atualizada");
    },
    onError: () => toast.error("Sem permissão ou falha ao atualizar."),
  });

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
    <AppShell
      title="Painel administrativo"
      description="Licenças, planos, usuários e receita aprovada."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Usuários" value={String(stats?.users ?? 0)} />
        <StatCard label="Licenças ativas" value={String(stats?.activeLicenses ?? 0)} />
        <StatCard label="Anúncios criados" value={String(stats?.listings ?? 0)} />
        <StatCard label="Receita aprovada" value={formatBRL(stats?.revenue ?? 0)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" /> Gerar licenças
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
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Período</Label>
                <Select value={period} onValueChange={(value) => setPeriod(value as BillingPeriod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={origin} onValueChange={(value) => setOrigin(value as Origin)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={!planId || createLicenses.isPending}
              onClick={() => createLicenses.mutate()}
            >
              {createLicenses.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar
            </Button>

            {created.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Chaves geradas
                </p>
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
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Últimas licenças
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
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
                {licenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell className="font-mono text-xs">{license.code}</TableCell>
                    <TableCell className="text-xs">{license.plans?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={license.status === "active" ? "default" : "outline"}>
                        {license.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(license.expires_at)}</TableCell>
                    <TableCell className="text-right">
                      {license.status === "suspended" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus.mutate({ id: license.id, status: "active" })}
                        >
                          Reativar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus.mutate({ id: license.id, status: "suspended" })}
                        >
                          Suspender
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
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
