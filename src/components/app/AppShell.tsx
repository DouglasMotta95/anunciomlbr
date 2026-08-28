import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  Boxes,
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
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/buscar", label: "Buscar e copiar", icon: Search },
      { to: "/anuncios", label: "Meus anúncios", icon: Tag },
      { to: "/saude-anuncios", label: "Saúde dos anúncios", icon: HeartPulse },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/crescimento", label: "Central de crescimento", icon: Target },
      { to: "/vendas", label: "Vendas", icon: ShoppingBag },
      { to: "/perguntas", label: "Perguntas e atendimento", icon: MessageCircleQuestion },
      { to: "/estoque", label: "Estoque e margem", icon: Boxes },
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { to: "/resultados", label: "Resultados do mês", icon: TrendingUp },
      { to: "/notificacoes", label: "Alertas e oportunidades", icon: Bell },
      { to: "/indicacoes", label: "Programa de indicação", icon: Gift },
    ],
  },
  {
    label: "Assinatura",
    items: [
      { to: "/assinatura", label: "Central da assinatura", icon: WalletCards },
      { to: "/licenca", label: "Plano e licença", icon: BadgeCheck },
      { to: "/creditos", label: "Comprar anúncios extras", icon: PackagePlus },
    ],
  },
  {
    label: "Configurações",
    items: [
      { to: "/integracoes", label: "Mercado Livre", icon: Plug },
      { to: "/conta", label: "Conta", icon: Settings },
      { to: SUPPORT_URL, label: "Suporte", icon: MessageCircle, external: true },
    ],
  },
] as const;

const MOBILE_NAV = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/crescimento", label: "Crescer", icon: Target },
  { to: "/anuncios", label: "Anúncios", icon: Tag },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">{group.label}</p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = !('external' in item) && (pathname === item.to || pathname.startsWith(`${item.to}/`));
            const className = cn(
              "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/70 hover:text-foreground",
              active && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground",
            );
            const content = (
              <>
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/80 transition-colors group-hover:bg-background", active && "bg-primary-foreground/15 group-hover:bg-primary-foreground/15")}>
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
  const { data: quota, isLoading: quotaLoading } = useQuery({
    queryKey: ["ad-quota"],
    queryFn: () => quotaFn(),
    staleTime: 30_000,
  });
  const remainingDays = daysUntil(license?.expires_at);
  const remaining = Math.max(0, Number(quota?.remaining ?? 0));
  const total = Math.max(0, Number(quota?.quota ?? 0));

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-sm">
      {license?.plan ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Plano atual</span>
            <Badge variant="secondary" className="rounded-full">{license.plan.name}</Badge>
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {quotaLoading ? "Carregando uso…" : `${remaining} de ${total} anúncios disponíveis`}
          </p>
          {remainingDays !== null && remainingDays >= 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{remainingDays} dia(s) restantes no período atual</p>
          )}
          <Button asChild size="sm" variant="outline" className="mt-3 w-full rounded-xl">
            <Link to="/assinatura"><WalletCards className="mr-1.5 h-3.5 w-3.5" />Gerenciar assinatura</Link>
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Teste grátis</span>
            <Badge variant="outline" className="rounded-full">Grátis</Badge>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            {quotaLoading ? "Carregando uso…" : `${remaining} de ${total || 10} anúncios disponíveis`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">A contagem usa a mesma franquia aplicada na criação e duplicação de anúncios.</p>
          <Button asChild size="sm" className="mt-3 w-full rounded-xl">
            <Link to="/assinatura"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Ver meu plano</Link>
          </Button>
        </>
      )}
    </div>
  );
}

export function AppShell({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const ping = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    };
    void ping();
    const timer = window.setInterval(ping, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto flex min-h-screen max-w-[1560px]">
        <aside className="sticky top-0 hidden h-screen w-[286px] shrink-0 flex-col border-r border-border/70 bg-background/95 px-4 py-5 backdrop-blur-xl lg:flex">
          <div className="rounded-2xl border border-border/60 bg-card/70 px-3 py-3 shadow-sm"><Logo /></div>
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1"><NavLinks /></div>
          <div className="mt-5 space-y-3 border-t border-border/60 pt-4">
            <PlanCard />
            <div className="rounded-xl bg-muted/50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Conta</p><p className="mt-1 truncate text-xs font-medium text-foreground">{user?.email}</p></div>
            <Button variant="ghost" size="sm" className="w-full justify-start rounded-xl text-muted-foreground hover:text-foreground" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-xl">
            <div className="flex min-h-[82px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild><Button variant="outline" size="icon" className="shrink-0 rounded-xl lg:hidden"><Menu className="h-4 w-4" /></Button></SheetTrigger>
                  <SheetContent side="left" className="w-[300px] p-4">
                    <div className="rounded-2xl border border-border/60 bg-card/70 px-3 py-3 shadow-sm"><Logo /></div>
                    <div className="mt-6"><NavLinks onNavigate={() => setOpen(false)} /></div>
                    <div className="mt-6 space-y-3 border-t border-border/60 pt-4"><PlanCard /><Button variant="ghost" size="sm" className="w-full justify-start rounded-xl" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sair</Button></div>
                  </SheetContent>
                </Sheet>
                <div className="min-w-0"><p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">ANÚNCIO ML</p><h1 className="truncate font-display text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>{description && <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">{description}</p>}</div>
              </div>
              {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
            </div>
          </header>
          <div className="mx-auto max-w-[1240px] p-4 pb-28 sm:p-6 lg:p-8 lg:pb-8"><div className="rounded-3xl border border-border/60 bg-background/80 p-3 shadow-sm sm:p-5 lg:p-6">{children}</div></div>
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 overflow-hidden rounded-2xl border border-border/70 bg-background/95 p-1 shadow-lg backdrop-blur-xl lg:hidden">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return <Link key={item.to} to={item.to} className={cn("flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[10px] font-semibold text-muted-foreground transition-all duration-200 active:scale-95", active && "bg-primary text-primary-foreground shadow-sm")}><Icon className="h-4 w-4" />{item.label}</Link>;
        })}
      </nav>
    </div>
  );
}
