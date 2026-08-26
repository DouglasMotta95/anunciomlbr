import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth, useIsAdmin, useProfile } from "@/hooks/useAuth";
import { useLicense } from "@/hooks/useLicense";
import { supabase } from "@/integrations/supabase/client";
import { daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Operação",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/buscar", label: "Buscar e copiar", icon: Search },
      { to: "/anuncios", label: "Meus anúncios", icon: Tag },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/vendas", label: "Vendas", icon: ShoppingBag },
      { to: "/estoque", label: "Estoque e margem", icon: Boxes },
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    label: "Configurações",
    items: [
      { to: "/integracoes", label: "Mercado Livre", icon: Plug },
      { to: "/licenca", label: "Plano e licença", icon: BadgeCheck },
      { to: "/conta", label: "Conta", icon: Settings },
    ],
  },
] as const;

/** Atalhos fixos na base em telas pequenas. */
const MOBILE_NAV = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/buscar", label: "Buscar", icon: Search },
  { to: "/anuncios", label: "Anúncios", icon: Tag },
  { to: "/vendas", label: "Vendas", icon: ShoppingBag },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: isAdmin } = useIsAdmin();

  return (
    <nav className="flex flex-col gap-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-primary/10 text-foreground ring-1 ring-primary/30",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
      {isAdmin && (
        <Link
          to="/admin"
          onClick={onNavigate}
          className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ShieldCheck className="h-4 w-4" />
          Painel administrativo
        </Link>
      )}
    </nav>
  );
}

function PlanCard() {
  const { data: license } = useLicense();
  const { data: profile } = useProfile();
  const remainingDays = daysUntil(license?.expires_at);

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      {license?.plan ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Plano</span>
            <Badge variant="secondary">{license.plan.name}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {remainingDays !== null && remainingDays >= 0
              ? `${remainingDays} dia(s) restantes`
              : "Licença sem validade definida"}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Teste grátis</span>
            <Badge variant="outline">Free</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {(profile?.free_listings_limit ?? 10) - (profile?.free_listings_used ?? 0)} de{" "}
            {profile?.free_listings_limit ?? 10} anúncios gratuitos disponíveis
          </p>
          <Button asChild size="sm" className="mt-3 w-full">
            <Link to="/licenca">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Ativar plano
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col justify-between border-r border-border p-5 lg:flex">
          <div className="space-y-6">
            <Logo />
            <NavLinks />
          </div>
          <div className="space-y-3">
            <PlanCard />
            <div className="truncate px-1 text-xs text-muted-foreground">{user?.email}</div>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/80 px-5 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-5">
                  <div className="space-y-6">
                    <Logo />
                    <NavLinks onNavigate={() => setOpen(false)} />
                    <PlanCard />
                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
                      <LogOut className="mr-2 h-4 w-4" /> Sair
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight">{title}</h1>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
              </div>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>
          <div className="p-4 pb-24 sm:p-5 lg:pb-5">{children}</div>
        </main>
      </div>

      {/* Navegação inferior em mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground",
                active && "text-primary",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
