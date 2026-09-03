import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Layers3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlatformFoundation } from "@/lib/platform-operations.functions";

export const Route = createFileRoute("/_authenticated/operacao-massa")({ component: BulkOperationsPage });

function BulkOperationsPage() {
  const load = useServerFn(getPlatformFoundation);
  const [data, setData] = useState<any>(null);
  useEffect(() => { void load().then(setData); }, [load]);
  return <div className="space-y-6">
    <div><p className="text-sm font-medium text-primary">Operação</p><h1 className="text-3xl font-semibold tracking-tight">Operações em massa</h1><p className="mt-2 max-w-3xl text-muted-foreground">Prepare ações sobre vários anúncios com validação de propriedade, lote auditável e simulação antes de qualquer escrita externa.</p></div>
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="size-5"/>Lotes</CardTitle><CardDescription>Últimas operações registradas.</CardDescription></CardHeader><CardContent className="text-3xl font-semibold">{data?.operations?.length ?? "—"}</CardContent></Card>
      <Card><CardHeader><CardTitle>Limite seguro</CardTitle><CardDescription>Até 200 anúncios por lote.</CardDescription></CardHeader><CardContent className="text-3xl font-semibold">200</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5"/>Modo atual</CardTitle><CardDescription>Ações novas começam sem escrita externa.</CardDescription></CardHeader><CardContent className="font-medium">Simulação protegida</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Fluxo de produção</CardTitle><CardDescription>Selecione anúncios em Meus anúncios e use o lote para revisar pausa, ativação, preço, estoque ou cópia interna. A confirmação externa só deve ser liberada por operação depois dos guardrails específicos.</CardDescription></CardHeader><CardContent><Button asChild><Link to="/anuncios">Selecionar anúncios</Link></Button></CardContent></Card>
  </div>;
}
