import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bot,
  CreditCard,
  FileText,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Package,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { type ReactNode } from "react";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { label: "Visão geral", icon: LayoutDashboard, section: "dashboard" },
  { label: "Clientes", icon: Users, section: "clientes" },
  { label: "Usuários", icon: ShieldCheck, section: "clientes" },
  { label: "Assinaturas", icon: BadgeDollarSign, section: "assinaturas" },
  { label: "Pagamentos", icon: CreditCard, section: "pagamentos" },
  { label: "Planos", icon: Package, section: "planos" },
  { label: "Pacotes", icon: Package, section: "planos" },
  { label: "Licenças", icon: KeyRound, section: "licencas" },
  { label: "Mercado Livre", icon: Store, section: "integracoes" },
  { label: "Anúncios", icon: FileText, section: "anuncios" },
  { label: "Publicações", icon: BarChart3, section: "anuncios" },
  { label: "Uso de IA", icon: Bot, section: "anuncios" },
  { label: "Atividade", icon: Activity, section: "logs" },
  { label: "Logs", icon: ScrollText, section: "logs" },
  { label: "Suporte", icon: LifeBuoy, section: "suporte" },
  { label: "Configurações", icon: Settings, section: "configuracoes" },
] as const;

export function AdminLayout({
  activeSection,
  onSectionChange,
  children,
}: {
  activeSection: string;
  onSectionChange: (section: string) => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1480px]">
        <aside className="sticky top-0 hidden h-screen w-[286px] shrink-0 flex-col justify-between border-r border-border bg-card/30 p-5 lg:flex">
          <div className="space-y-6">
            <Logo to="/admin" />
            <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary">
              Admin Dashboard
            </div>
            <nav className="space-y-1">
              {ADMIN_NAV.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.section;
                return (
                  <button
                    key={`${item.section}-${item.label}`}
                    type="button"
                    onClick={() => onSectionChange(item.section)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      active && "bg-primary/10 text-foreground ring-1 ring-primary/25",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active && "text-primary")} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="space-y-3">
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link to="/dashboard">
                <Plug className="mr-2 h-4 w-4" /> Área do cliente
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-5 py-4 backdrop-blur-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">ANÚNCIO ML</p>
              <h1 className="font-display text-xl font-bold tracking-tight">Painel administrativo</h1>
              <p className="text-sm text-muted-foreground">Gestão SaaS, permissões, receita, licenças e operação global.</p>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <Button asChild variant="outline" size="sm">
                <Link to={pathname === "/admin" ? "/dashboard" : "/admin"}>{pathname === "/admin" ? "Cliente" : "Admin"}</Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <div className="p-4 pb-10 sm:p-5">{children}</div>
        </main>
      </div>
    </div>
  );
}