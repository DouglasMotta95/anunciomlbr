import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, Bot, CircleDollarSign, PackageSearch, Radar, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({ meta: [{ title: "Automações — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: AutomationPage,
});

const rules = [
  { icon: PackageSearch, title: "Estoque crítico", condition: "SE estoque ficar abaixo do limite", action: "ENTÃO criar alerta e oportunidade", status: "Disponível", to: "/estoque" as const },
  { icon: Radar, title: "Mudança de concorrente", condition: "SE preço, estoque ou status monitorado mudar", action: "ENTÃO registrar no radar para revisão", status: "Disponível", to: "/crescimento" as const },
  { icon: CircleDollarSign, title: "Proteção de margem", condition: "SE margem estimada ficar abaixo de 15%", action: "ENTÃO destacar como prioridade alta", status: "Disponível", to: "/oportunidades" as const },
  { icon: Bot, title: "Repricing com proteção", condition: "SE concorrente reduzir o preço", action: "ENTÃO recalcular respeitando mínimo e margem", status: "Em preparação", to: "/crescimento" as const },
];

function AutomationPage(){
  return <AppShell title="Automações" description="Regras para transformar sinais da operação em ações, sempre com limites e rastreabilidade.">
    <div className="grid gap-3 md:grid-cols-3"><Metric label="Motor de regras" value="Ativo" icon={Zap}/><Metric label="Proteção" value="Margem primeiro" icon={ShieldCheck}/><Metric label="Alertas" value="Centralizados" icon={BellRing}/></div>
    <Card className="mt-4"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Regras inteligentes</CardTitle><p className="mt-1 text-xs text-muted-foreground">O sistema não executa alterações externas que ainda não tenham integração segura. Recursos em preparação ficam identificados.</p></div><Badge variant="outline">ANÚNCIO ML</Badge></div></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2">{rules.map((rule)=><div key={rule.title} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><rule.icon className="h-4 w-4"/></div><div><p className="font-semibold">{rule.title}</p><p className="mt-2 text-xs font-medium">{rule.condition}</p><p className="mt-1 text-xs text-muted-foreground">{rule.action}</p></div></div><Badge variant={rule.status === "Disponível" ? "secondary" : "outline"}>{rule.status}</Badge></div><Button asChild size="sm" variant="outline" className="mt-4"><Link to={rule.to}>Abrir ferramenta</Link></Button></div>)}</CardContent></Card>
    <Card className="mt-4 border-primary/20"><CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 text-primary"/><div><p className="font-semibold">Próxima evolução: construtor SE → ENTÃO</p><p className="mt-1 max-w-2xl text-sm text-muted-foreground">A arquitetura visual já separa sinais, proteção de margem e ações. Escritas automáticas no Mercado Livre só serão liberadas depois dos controles de mínimo, máximo, auditoria e confirmação.</p></div></div><Button asChild variant="outline"><Link to="/oportunidades">Ver oportunidades</Link></Button></CardContent></Card>
  </AppShell>
}
function Metric({label,value,icon:Icon}:{label:string;value:string;icon:typeof Zap}){return <Card><CardContent className="flex items-center justify-between gap-3 pt-6"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div><Icon className="h-5 w-5 text-primary"/></CardContent></Card>}
