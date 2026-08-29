import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Megaphone, Search, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { checkIsAdmin } from "@/lib/roles.functions";
import {
  adminGrantCreditPackage,
  adminListCreditPackages,
  adminSearchCreditClients,
} from "@/lib/admin-credit-grants.functions";

const title = "Créditos dos clientes — ANÚNCIO ML";

export const Route = createFileRoute("/_authenticated/admin-creditos")({
  head: () => ({ meta: [{ title }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/dashboard", replace: true });
    } catch (error) {
      if (isRedirect(error)) throw error;
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: AdminCreditsPage,
});

function AdminCreditsPage() {
  const searchClients = useServerFn(adminSearchCreditClients);
  const listPackages = useServerFn(adminListCreditPackages);
  const grantPackage = useServerFn(adminGrantCreditPackage);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [aiPackageId, setAiPackageId] = useState("");
  const [adsPackageId, setAdsPackageId] = useState("");
  const [note, setNote] = useState("");

  const { data: packagesData, isLoading: loadingPackages } = useQuery({
    queryKey: ["admin-credit-packages"],
    queryFn: () => listPackages(),
  });

  const { data: clientsData, isFetching: searchingClients } = useQuery({
    queryKey: ["admin-credit-clients", submittedSearch],
    queryFn: () => searchClients({ data: { search: submittedSearch } }),
    enabled: submittedSearch.length > 0,
  });

  const packages = packagesData?.packages ?? [];
  const aiPackages = useMemo(() => packages.filter((pack) => pack.kind === "ai_package"), [packages]);
  const adPackages = useMemo(() => packages.filter((pack) => pack.kind === "ad_package"), [packages]);
  const selectedClient = (clientsData?.clients ?? []).find((client) => client.id === clientId);

  const grant = useMutation({
    mutationFn: ({ packageId }: { packageId: string }) =>
      grantPackage({ data: { user_id: clientId, package_id: packageId, note: note || undefined } }),
    onSuccess: (result) => {
      toast.success(
        result.kind === "ai"
          ? `${result.amount} créditos de IA adicionados`
          : `${result.amount} anúncios extras adicionados`,
      );
      setNote("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível adicionar os créditos."),
  });

  return (
    <AdminLayout activeSection="creditos" onSectionChange={() => undefined}>
      <div className="space-y-5">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Créditos por cliente</h2>
          <p className="text-sm text-muted-foreground">Adicione créditos de IA ou anúncios extras diretamente a uma conta existente, sem alterar o plano principal.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">1. Localizar cliente</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const value = search.trim(); if (value) { setSubmittedSearch(value); setClientId(""); } }}>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou e-mail do cliente" />
              <Button type="submit" disabled={!search.trim() || searchingClients}>{searchingClients ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Buscar</Button>
            </form>
            {(clientsData?.clients ?? []).length > 0 && (
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientsData?.clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.full_name ?? "Sem nome"} · {client.email ?? client.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedClient && <div className="rounded-xl border bg-muted/20 p-3 text-sm"><b>Selecionado:</b> {selectedClient.full_name ?? "Sem nome"} · {selectedClient.email ?? selectedClient.id}</div>}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" />Créditos de IA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Cria uma recarga de IA separada da licença principal do cliente.</p>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Select value={aiPackageId} onValueChange={setAiPackageId} disabled={loadingPackages}>
                  <SelectTrigger><SelectValue placeholder="Escolha um pacote" /></SelectTrigger>
                  <SelectContent>{aiPackages.map((pack) => <SelectItem key={pack.id} value={pack.id}>{pack.name} · {pack.ai_credits ?? 0} créditos</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!clientId || !aiPackageId || grant.isPending} onClick={() => grant.mutate({ packageId: aiPackageId })}>
                {grant.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Adicionar créditos de IA
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4 text-primary" />Anúncios extras</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Adiciona somente novas criações/duplicações de anúncios, sem mexer no saldo de IA.</p>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Select value={adsPackageId} onValueChange={setAdsPackageId} disabled={loadingPackages}>
                  <SelectTrigger><SelectValue placeholder="Escolha um pacote" /></SelectTrigger>
                  <SelectContent>{adPackages.map((pack) => <SelectItem key={pack.id} value={pack.id}>{pack.name} · {pack.ad_quota ?? 0} anúncios</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!clientId || !adsPackageId || grant.isPending} onClick={() => grant.mutate({ packageId: adsPackageId })}>
                {grant.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Adicionar anúncios extras
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Observação administrativa</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: cortesia, ajuste de suporte, compensação..." maxLength={240} />
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">Validade conforme o pacote</Badge><span>Toda concessão fica registrada no histórico de atividade.</span></div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
