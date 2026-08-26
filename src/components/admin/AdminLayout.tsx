import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  BarChart3,
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
  Store,
  Ticket,
  UserMinus,
  Users,
} from "lucide-react";
import { type ReactNode } from "react";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Menu do painel administrativo — um item por seção real, agrupado por área.
 * Sem itens duplicados e sem seções inacessíveis.
 */
const ADMIN_NAV_GROUPS = [
  {
    title: "Operação",
    items: [
      { label: "Visão geral", icon: LayoutDashboard, section: "dashboard" },
      { label: "Analytics", icon: BarChart3, section: "analytics" },
      { label: "Anúncios e IA", icon: FileText, section: "anuncios" },
    ],
  },
  {
    title: "Clientes",
    items: [
      { label: "Clientes", icon: Users, section: "clientes" },
      { label: "Inativos", icon: UserMinus, section: "inativos" },
      { label: "Testes grátis", icon: Ticket, section: "testes" },
    ],
  },
  {
    title: "Receita",
    items: [
      { label: "Pagamentos", icon: CreditCard, section: "pagamentos" },
      { label: "Assinaturas", icon: BadgeDollarSign, section: "assinaturas" },
      { label: "Planos e pacotes", icon: Package, section: "planos" },
      { label: "Licenças", icon: KeyRound, section: "licencas" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Integrações", icon: Store, section: "integracoes" },
      { label: "Logs e atividade", icon: ScrollText, section: "logs" },
      { label: "Suporte", icon: LifeBuoy, section: "suporte" },
      { label: "Configurações", icon: Settings, section: "configuracoes" },
    ],
  },
] as const;

const ALL_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

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
  const current = ALL_ITEMS.find((item) => item.section === activeSection);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1480px]">
        <aside className="sticky top-0 hidden h-screen w-[286px] shrink-0 flex-col justify-between overflow-y-auto border-r border-border bg-card/30 p-5 lg:flex">
          <div className="space-y-6">
            <Logo to="/admin" />
            <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary">
              Admin Dashboard
            </div>
            <nav className="space-y-5">
              {ADMIN_NAV_GROUPS.map((group) => (
                <div key={group.title} className="space-y-1">
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.title}
                  </p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.section;
                    return (
                      <button
                        key={item.section}
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
                </div>
              ))}
            </nav>
          </div>
          <div className="space-y-3 pt-6">
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
          <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-5 py-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  ANÚNCIO ML
                </p>
                <h1 className="font-display text-xl font-bold tracking-tight">
                  {current?.label ?? "Painel administrativo"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Gestão SaaS, permissões, receita, licenças e operação global.
                </p>
              </div>
              <div className="flex items-center gap-2 lg:hidden">
                <Button asChild variant="outline" size="sm">
                  <Link to={pathname === "/admin" ? "/dashboard" : "/admin"}>
                    {pathname === "/admin" ? "Cliente" : "Admin"}
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 lg:hidden">
              <Select value={activeSection} onValueChange={onSectionChange}>
                <SelectTrigger aria-label="Seção do painel">
                  <SelectValue placeholder="Selecione a seção" />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_NAV_GROUPS.flatMap((group) =>
                    group.items.map((item) => (
                      <SelectItem key={item.section} value={item.section}>
                        {group.title} · {item.label}
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>
            </div>
          </header>
          <div className="p-4 pb-10 sm:p-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
