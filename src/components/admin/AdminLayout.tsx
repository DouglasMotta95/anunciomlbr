import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeDollarSign, BarChart3, CheckCircle2, CreditCard, FileText, HeartPulse, KeyRound,
  LayoutDashboard, LifeBuoy, LogOut, Package, Plug, Radar, RefreshCcw, ScrollText,
  Settings, Store, Ticket, TriangleAlert, UserMinus, Users, XCircle,
} from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useAuth";
import { adminGetSystemHealth } from "@/lib/admin-health.functions";
import { cn } from "@/lib/utils";

type NavItem = { label: string; icon: typeof Users; section: string };
type NavGroup = { title: string; items: NavItem[] };
const ADMIN_NAV_GROUPS: NavGroup[] = [
  { title: "Operação", items: [
    { label: "Visão geral", icon: LayoutDashboard, section: "dashboard" },
    { label: "Saúde da plataforma", icon: HeartPulse, section: "saude" },
    { label: "Analytics", icon: BarChart3, section: "analytics" },
    { label: "Anúncios e IA", icon: FileText, section: "anuncios" },
    { label: "Sessões e alertas", icon: Radar, section: "sessoes" },
  ]},
  { title: "Clientes", items: [
    { label: "Clientes", icon: Users, section: "clientes" },
    { label: "Inativos", icon: UserMinus, section: "inativos" },
    { label: "Testes grátis", icon: Ticket, section: "testes" },
    { label: "Revendedores", icon: Store, section: "revendedores" },
  ]},
  { title: "Receita", items: [
    { label: "Pagamentos", icon: CreditCard, section: "pagamentos" },
    { label: "Assinaturas", icon: BadgeDollarSign, section: "assinaturas" },
    { label: "Planos e pacotes", icon: Package, section: "planos" },
    { label: "Licenças", icon: KeyRound, section: "licencas" },
  ]},
  { title: "Sistema", items: [
    { label: "Integrações", icon: Store, section: "integracoes" },
    { label: "Logs e atividade", icon: ScrollText, section: "logs" },
    { label: "Suporte", icon: LifeBuoy, section: "suporte" },
    { label: "Configurações", icon: Settings, section: "configuracoes" },
  ]},
];
const ALL_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

function HealthCenter() {
  const getHealth = useServerFn(adminGetSystemHealth);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: () => getHealth(),
    refetchInterval: 60_000,
  });
  if (isLoading) return <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">Verificando serviços...</div>;
  const stateIcon = (state: string) => state === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-500"/> : state === "warning" ? <TriangleAlert className="h-4 w-4 text-amber-500"/> : <XCircle className="h-4 w-4 text-destructive"/>;
  const stateLabel = (state: string) => state === "ok" ? "Operacional" : state === "warning" ? "Atenção" : "Falha";
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-extrabold tracking-tight">Saúde da plataforma</h2><p className="text-sm text-muted-foreground">Status técnico e pendências que exigem atenção administrativa.</p></div><Button variant="outline" size="sm" onClick={()=>refetch()} disabled={isFetching}><RefreshCcw className={cn("mr-2 h-4 w-4",isFetching&&"animate-spin")}/>Atualizar</Button></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(data?.services??[]).map((service)=><Card key={service.key}><CardContent className="flex items-start justify-between gap-3 pt-6"><div><p className="font-semibold">{service.label}</p><p className="mt-1 text-xs text-muted-foreground">{service.detail}</p></div><Badge variant="outline" className="gap-1.5">{stateIcon(service.state)}{stateLabel(service.state)}</Badge></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="text-base">Atenção necessária</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{(data?.attention??[]).map((item)=><div key={item.label} className="flex items-center justify-between rounded-lg border border-border p-3"><div className="flex items-center gap-2">{item.severity==="warning"?<TriangleAlert className="h-4 w-4 text-amber-500"/>:<CheckCircle2 className="h-4 w-4 text-emerald-500"/>}<span className="text-sm">{item.label}</span></div><strong className="text-sm">{item.count}</strong></div>)}</CardContent></Card>
    <p className="text-xs text-muted-foreground">Última verificação: {data?.checkedAt ? new Date(data.checkedAt).toLocaleString("pt-BR") : "agora"}. O painel nunca exibe tokens, secrets ou senhas.</p>
  </div>;
}

export function AdminLayout({ activeSection, onSectionChange, children }: { activeSection: string; onSectionChange: (section: string) => void; children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: hasAdminAccess, isLoading: checkingAdminAccess } = useIsAdmin();
  const current = ALL_ITEMS.find((item) => item.section === activeSection);
  useEffect(() => { if (!checkingAdminAccess && hasAdminAccess !== true) navigate({ to: "/dashboard", replace: true }); }, [checkingAdminAccess, hasAdminAccess, navigate]);
  const signOut = async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); };
  const chooseSection = (section: string) => { if (section === "revendedores") { navigate({ to: "/admin-revendedores" }); return; } if (pathname === "/admin-revendedores") { navigate({ to: "/admin" }); return; } onSectionChange(section); };
  if (checkingAdminAccess || hasAdminAccess !== true) return null;
  return <div className="min-h-screen bg-background"><div className="mx-auto flex max-w-[1480px]">
    <aside className="sticky top-0 hidden h-screen w-[286px] shrink-0 flex-col justify-between overflow-y-auto border-r border-border bg-card/30 p-5 lg:flex">
      <div className="space-y-6"><Logo to="/admin"/><div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary">Central administrativa</div><nav className="space-y-5">{ADMIN_NAV_GROUPS.map((group)=><div key={group.title} className="space-y-1"><p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group.title}</p>{group.items.map((item)=>{const Icon=item.icon;const active=activeSection===item.section;return <button key={item.section} type="button" onClick={()=>chooseSection(item.section)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",active&&"bg-primary/10 text-foreground ring-1 ring-primary/25")}><Icon className={cn("h-4 w-4",active&&"text-primary")}/>{item.label}</button>})}</div>)}</nav></div>
      <div className="space-y-3 pt-6"><Button asChild variant="outline" size="sm" className="w-full justify-start"><Link to="/dashboard"><Plug className="mr-2 h-4 w-4"/> Área do cliente</Link></Button><Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}><LogOut className="mr-2 h-4 w-4"/> Sair</Button></div>
    </aside>
    <main className="min-w-0 flex-1"><header className="sticky top-0 z-20 border-b border-border bg-background/90 px-5 py-4 backdrop-blur-xl"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">ANÚNCIO ML</p><h1 className="font-display text-xl font-bold tracking-tight">{current?.label??"Painel administrativo"}</h1><p className="text-sm text-muted-foreground">Controle de clientes, receita, licenças, revendedores, integrações e saúde operacional.</p></div><div className="flex items-center gap-2 lg:hidden"><Button asChild variant="outline" size="sm"><Link to={pathname==="/admin"?"/dashboard":"/admin"}>{pathname==="/admin"?"Cliente":"Admin"}</Link></Button><Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair"><LogOut className="h-4 w-4"/></Button></div></div><div className="mt-3 lg:hidden"><Select value={activeSection} onValueChange={chooseSection}><SelectTrigger aria-label="Seção do painel"><SelectValue placeholder="Selecione a seção"/></SelectTrigger><SelectContent>{ADMIN_NAV_GROUPS.flatMap((group)=>group.items.map((item)=><SelectItem key={item.section} value={item.section}>{group.title} · {item.label}</SelectItem>))}</SelectContent></Select></div></header><div className="p-4 pb-10 sm:p-5">{activeSection==="saude"?<HealthCenter/>:children}</div></main>
  </div></div>;
}
