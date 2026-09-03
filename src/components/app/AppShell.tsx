import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  Boxes,
  Brain,
  Gift,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessageCircleQuestion,
  PackagePlus,
  Plug,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useLicense } from "@/hooks/useLicense";
import { supabase } from "@/integrations/supabase/client";
import { daysUntil } from "@/lib/format";
import { getAdQuota } from "@/lib/quota.functions";
import { cn } from "@/lib/utils";

const SUPPORT_URL =
  "https://wa.me/5535991429262?text=Ol%C3%A1%21%20Preciso%20de%20ajuda%20com%20o%20AN%C3%9ANCIO%20ML.";

const NAV_GROUPS = [
  {
    label: "Operação",
    items: [
      { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
      { to: "/buscar", label: "Buscar e copiar", icon: Search },
      { to: "/mercado", label: "Pesquisa de mercado", icon: BarChart3 },
      { to: "/anuncios", label: "Meus anúncios", icon: Tag },
      { to: "/saude-anuncios", label: "Saúde dos anúncios", icon: HeartPulse },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/crescimento", label: "Crescimento", icon: Target },
      { to: "/vendas", label: "Vendas", icon: ShoppingBag },
      { to: "/perguntas", label: "Perguntas", icon: MessageCircleQuestion },
      { to: "/estoque", label: "Estoque e margem", icon: Boxes },
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { to: "/resultados", label: "Resultados", icon: TrendingUp },
      { to: "/notificacoes", label: "Alertas", icon: Bell },
      { to: "/indicacoes", label: "Indicações", icon: Gift },
    ],
  },
  {
    label: "Plano",
    items: [
      { to: "/assinatura", label: "Assinatura", icon: WalletCards },
      { to: "/licenca", label: "Plano e licença", icon: BadgeCheck },
      { to: "/creditos", label: "Anúncios extras", icon: PackagePlus },
      { to: "/creditos-ia", label: "Créditos de IA", icon: Brain },
    ],
  },
  {
    label: "Conta",
    items: [
      { to: "/integracoes", label: "Integrações", icon: Plug },
      { to: "/conta", label: "Configurações", icon: Settings },
      { to: SUPPORT_URL, label: "Suporte", icon: MessageCircle, external: true },
    ],
  },
] as const;

const MOBILE_NAV = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/buscar", label: "Buscar", icon: Search },
  { to: "/anuncios", label: "Anúncios", icon: Tag },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active =
              !("external" in item) &&
              (pathname === item.to || pathname.startsWith(`${item.to}/`));
            const className = cn(
              "group flex select-none touch-manipulation items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
              active && "bg-primary/10 font-semibold text-foreground",
            );
            const content = (
              <>
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors group-hover:text-foreground",
                    active && "bg-primary text-primary-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate">{item.label}</span>
              </>
            );

            return "external" in item ? (
              <a key={item.to} href={item.to} target="_blank" rel="noreferrer" onClick={onNavigate} className={className}>{content}</a>
            ) : (
              <Link key={item.to} to={item.to} onClick={onNavigate} className={className}>{content}</Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function PlanCard() {
  const { data: license } = useLicense();
  const quotaFn = useServerFn(getAdQuota);
  const { data: quota, isLoading } = useQuery({
    queryKey: ["ad-quota"],
    queryFn: () => quotaFn(),
    staleTime: 30000,
  });
  const days = daysUntil(license?.expires_at);
  const remaining = Math.max(0, Number(quota?.remaining ?? 0));
  const total = Math.max(0, Number(quota?.quota ?? 0));
  const usage = total > 0 ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 0;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      {license?.plan ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Plano atual</span>
            <Badge variant="secondary" className="rounded-md">{license.plan.name}</Badge>
          </div>
          <p className="mt-3 text-sm font-semibold">{isLoading ? "Carregando…" : `${remaining} de ${total} anúncios disponíveis`}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${usage}%` }} /></div>
          {days !== null && days >= 0 && <p className="mt-2 text-xs text-muted-foreground">{days} dia(s) restantes</p>}
          <Button asChild size="sm" variant="outline" className="mt-3 w-full rounded-lg"><Link to="/assinatura"><WalletCards className="mr-1.5 h-3.5 w-3.5" />Gerenciar plano</Link></Button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">Teste grátis</span><Badge variant="outline" className="rounded-md">Grátis</Badge></div>
          <p className="mt-3 text-sm font-semibold">{isLoading ? "Carregando…" : `${remaining} de ${total || 10} anúncios disponíveis`}</p>
          <p className="mt-1 text-xs text-muted-foreground">Criações e cópias usam essa franquia.</p>
          <Button asChild size="sm" className="mt-3 w-full rounded-lg"><Link to="/assinatura"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Ver planos</Link></Button>
        </>
      )}
    </div>
  );
}

export function AppShell({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const { data: aiBalance } = useQuery({
    queryKey: ["ai-credit-balance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const db = supabase as any;
      const { data, error } = await db.rpc("ai_credit_status", { p_user_id: user.id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? { used: Number(row.used ?? 0), total: Number(row.credit_limit ?? 0), remaining: Number(row.remaining ?? 0) } : null;
    },
    staleTime: 15000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const ping = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    };
    void ping();
    const timer = window.setInterval(ping, 120000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto flex min-h-screen max-w-[1600px] bg-background">
        <aside className="sticky top-0 hidden h-screen w-[276px] shrink-0 flex-col border-r border-border/70 bg-background px-4 py-5 lg:flex">
          <div className="px-2 py-1"><Logo /></div>
          <div className="mt-7 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]"><NavLinks /></div>
          <div className="mt-5 space-y-3 border-t border-border/70 pt-4">
            <PlanCard />
            <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-lg"><Link to="/creditos-ia"><Brain className="mr-2 h-4 w-4 text-primary" />IA: {aiBalance ? `${aiBalance.remaining} créditos` : "carregando…"}</Link></Button>
            <div className="px-2 py-1"><p className="truncate text-xs text-muted-foreground">{user?.email}</p></div>
            <Button variant="ghost" size="sm" className="w-full justify-start rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-muted/20">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur-xl">
            <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild><Button variant="outline" size="icon" className="shrink-0 rounded-lg lg:hidden"><Menu className="h-4 w-4" /></Button></SheetTrigger>
                  <SheetContent side="left" className="w-[310px] overflow-y-auto bg-background p-4">
                    <div className="px-2 py-1"><Logo /></div>
                    <div className="mt-7"><NavLinks onNavigate={() => setOpen(false)} /></div>
                    <div className="mt-6 space-y-3 border-t border-border/70 pt-4">
                      <PlanCard />
                      <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-lg"><Link to="/creditos-ia" onClick={() => setOpen(false)}><Brain className="mr-2 h-4 w-4 text-primary" />IA: {aiBalance ? `${aiBalance.remaining} créditos` : "carregando…"}</Link></Button>
                      <Button variant="ghost" size="sm" className="w-full justify-start rounded-lg" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="min-w-0">
                  <h1 className="truncate font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
                  {description && <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground sm:text-sm">{description}</p>}
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <Button asChild variant="outline" size="sm" className="rounded-lg"><Link to="/creditos-ia"><Brain className="mr-1.5 h-3.5 w-3.5 text-primary" />IA: {aiBalance ? aiBalance.remaining : "…"}</Link></Button>
                {actions}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1280px] p-4 pb-28 sm:p-6 lg:p-8 lg:pb-10">{children}</div>
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-4 overflow-hidden rounded-xl border border-border/70 bg-background/96 p-1 shadow-lg backdrop-blur-xl lg:hidden">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return <Link key={item.to} to={item.to} className={cn("flex min-h-14 select-none touch-manipulation flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors", active && "bg-primary/10 font-semibold text-primary")}><Icon className="h-[18px] w-[18px]" />{item.label}</Link>;
        })}
      </nav>
    </div>
  );
}