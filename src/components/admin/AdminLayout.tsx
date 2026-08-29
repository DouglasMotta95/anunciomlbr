import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeDollarSign, BarChart3, Bot, CheckCircle2, Coins, CreditCard, FileText, HeartPulse, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Package, Radar, RefreshCcw, ScrollText, Settings, Store, Ticket, TriangleAlert, UserMinus, Users, XCircle } from "lucide-react";
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
  {
    title: "Visão geral",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, section: "dashboard" },
      { label: "Saúde da plataforma", icon: HeartPulse, section: "saude" },
    ],
  },
  {
    title: "Gestão de clientes",
    items: [
      { label: "Clientes", icon: Users, section: "clientes" },
      { label: "Créditos de clientes", icon: Coins, section: "creditos" },
      { label: "Licenças", icon: KeyRound, section: "licencas" },
      { label: "Assinaturas", icon: BadgeDollarSign, section: "assinaturas" },
      { label: "Clientes inativos", icon: UserMinus, section: "inativos" },
      { label: "Testes grátis", icon: Ticket, section: "testes" },
    ],
  },
  {
    title: "Financeiro e comercial",
    items: [
      { label: "Pagamentos", icon: CreditCard, section: "pagamentos" },
      { label: "Planos e pacotes", icon: Package, section: "planos" },
      { label: "Revendedores", icon: Store, section: "revendedores" },
      { label: "Assistente comercial", icon: Bot, section: "assistente" },
    ],
  },
  {
    title: "Operação",
    items: [
      { label: "Anúncios e IA", icon: FileText, section: "anuncios" },
      { label: "Analytics", icon: BarChart3, section: "analytics" },
      { label: "Sessões e alertas", icon: Radar, section: "sessoes" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Integrações", icon: Store, section: "integracoes" },
      { label: "Logs e atividade", icon: ScrollText, section: "logs" },
      { label: "Configurações", icon: Settings, section: "configuracoes" },
      { label: "Suporte", icon: LifeBuoy, section: "suporte" },
    ],
  },
];

const ALL_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

function HealthCenter() {
  const getHealth = useServerFn(adminGetSystemHealth);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: () => getHealth(),
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Verificando serviços...</div>;
  const stateIcon = (state: string) => state === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : state === "warning" ? <TriangleAlert className="h-4 w-4 text-amber-500" /> : <XCircle className="h-4 w-4 text-destructive" />;
  const stateLabel = (state: string) => state === "ok" ? "Operacional" : state === "warning" ? "Atenção" : "Falha";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Saúde da plataforma</h2>
          <p className="text-sm text-muted-foreground">Status técnico e pendências que exigem atenção administrativa.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCcw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />Atualizar
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(data?.services ?? []).map((service) => (
          <Card key={service.key} className="rounded-2xl">
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div><p className="font-semibold">{service.label}</p><p className="mt-1 text-xs text-muted-foreground">{service.detail}</p></div>
              <Badge variant="outline" className="gap-1.5">{stateIcon(service.state)}{stateLabel(service.state)}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Atenção necessária</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {(data?.attention ?? []).map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-2">{item.severity === "warning" ? <TriangleAlert className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}<span className="text-sm">{item.label}</span></div>
              <strong className="text-sm">{item.count}</strong>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Última verificação: {data?.checkedAt ? new Date(data.checkedAt).toLocaleString("pt-BR") : "agora"}. O painel nunca exibe tokens, secrets ou senhas.</p>
    </div>
  );
}

export function AdminLayout({ activeSection, onSectionChange, children }: { activeSection: string; onSectionChange: (section: string) => void; children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: hasAdminAccess, isLoading: checkingAdminAccess } = useIsAdmin();
  const current = ALL_ITEMS.find((item) => item.section === activeSection);
  const currentGroup = ADMIN_NAV_GROUPS.find((group) => group.items.some((item) => item.section === activeSection));

  useEffect(() => {
    if (!checkingAdminAccess && hasAdminAccess !== true) navigate({ to: "/dashboard", replace: true });
  }, [checkingAdminAccess, hasAdminAccess, navigate]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  };

  const chooseSection = (section: string) => {
    if (section === "revendedores") { navigate({ to: "/admin-revendedores" }); return; }
    if (section === "assistente") { navigate({ to: "/admin-comercial" as any }); return; }
    if (section === "creditos") { navigate({ to: "/admin-creditos" as any }); return; }
    if (pathname !== "/admin") { navigate({ to: "/admin" }); return; }
    onSectionChange(section);
  };

  if (checkingAdminAccess || hasAdminAccess !== true) return null;

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col border-r bg-background lg:flex">
          <div className="border-b px-5 py-5">
            <Logo to="/admin" />
            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">Admin</p>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Operação</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Central de gestão do ANÚNCIO ML.</p>
            </div>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {ADMIN_NAV_GROUPS.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">{group.title}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.section;
                  return (
                    <button
                      key={item.section}
                      type="button"
                      onClick={() => chooseSection(item.section)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="border-t p-3">
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />Sair do painel
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-4 backdrop-blur-xl sm:px-6">
            <div className="mx-auto max-w-[1260px]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Administração</span>
                    <span>›</span>
                    <span className="font-medium text-foreground">{currentGroup?.title ?? "Painel"}</span>
                  </div>
                  <h1 className="truncate font-display text-xl font-extrabold tracking-tight sm:text-2xl">{current?.label ?? "Painel administrativo"}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => chooseSection("clientes")}><Users className="mr-2 h-4 w-4" />Clientes</Button>
                  <Button size="sm" variant="outline" onClick={() => chooseSection("creditos")}><Coins className="mr-2 h-4 w-4" />Créditos</Button>
                  <Button size="sm" onClick={() => chooseSection("licencas")}><KeyRound className="mr-2 h-4 w-4" />Licenças</Button>
                  <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair do painel administrativo"><LogOut className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="mt-3 lg:hidden">
                <Select value={activeSection} onValueChange={chooseSection}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione a seção" /></SelectTrigger>
                  <SelectContent>{ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => <SelectItem key={item.section} value={item.section}>{group.title} · {item.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          </header>

          <div data-admin-content className="mx-auto max-w-[1260px] p-4 pb-10 sm:p-6">
            {activeSection === "saude" ? <HealthCenter /> : children}
          </div>
        </main>
      </div>
    </div>
  );
}
