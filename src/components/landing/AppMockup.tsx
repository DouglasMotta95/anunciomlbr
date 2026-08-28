import {
  Bot,
  CheckCircle2,
  LayoutGrid,
  Package,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-3 shadow-sm">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-extrabold leading-tight tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[9px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Demonstração visual da estrutura do painel.
 * Todos os números abaixo são explicitamente ilustrativos e nunca são apresentados como resultado real de clientes.
 */
export function AppMockup({ className }: { className?: string }) {
  return (
    <div className={cn("glass-panel overflow-hidden rounded-[28px] p-2 shadow-2xl sm:p-3", className)}>
      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-2 text-[10px] text-muted-foreground">ANÚNCIO ML · demonstração ilustrativa</span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-2 rounded-2xl border border-border/50 bg-background/80 p-2 sm:gap-3 sm:p-3">
        <aside className="flex w-11 flex-col items-center gap-3 rounded-xl border border-border/40 bg-sidebar py-3 sm:w-14">
          {[LayoutGrid, Search, Zap, Bot, TrendingUp, Package].map((Icon, i) => (
            <span
              key={i}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition",
                i === 0 && "bg-primary/15 text-primary shadow-sm",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          ))}
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface/40 px-2 py-1.5">
            <div>
              <p className="font-display text-sm font-extrabold">Painel do vendedor</p>
              <p className="text-[9px] text-muted-foreground">Visão geral da operação em um só lugar</p>
            </div>
            <Badge className="gap-1 border-success/40 bg-success/10 text-success" variant="outline">
              <span className="inline-block size-1.5 rounded-full bg-emerald-400" /> ML conectado
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Anúncios criados" value="128" hint="exemplo ilustrativo" />
            <MiniStat label="Anúncios ativos" value="94" hint="exemplo ilustrativo" />
            <MiniStat label="Otimizados por IA" value="37" hint="exemplo ilustrativo" />
            <MiniStat label="Valor em catálogo" value="R$ 18,4 mil" hint="exemplo ilustrativo" />
          </div>

          <div className="grid gap-2 sm:grid-cols-[1.35fr_1fr]">
            <div className="rounded-2xl border border-border/70 bg-surface/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ações rápidas</p>
                  <p className="mt-0.5 text-[10px] font-medium">Da busca à publicação sem trocar de sistema</p>
                </div>
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  [Search, "Buscar no ML"],
                  [Zap, "Criar cópias"],
                  [Sparkles, "Otimizar com IA"],
                  [TrendingUp, "Ver desempenho"],
                ].map(([Icon, label]) => {
                  const ItemIcon = Icon as typeof Search;
                  return (
                    <div key={String(label)} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 p-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <ItemIcon className="h-3.5 w-3.5 text-primary" />
                      </span>
                      <span className="text-[10px] font-semibold leading-tight">{String(label)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-primary/25 bg-primary/[0.05] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> ANÚNCIO AI
                </div>
                <span className="text-[9px] text-muted-foreground">37 / 100</span>
              </div>
              <p className="text-[10px] font-medium">Créditos de IA no ciclo</p>
              <Progress value={37} className="h-1.5" />
              <div className="space-y-1 pt-1 text-[9px] text-muted-foreground">
                <p className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> Títulos com limite do ML</p>
                <p className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> Descrição e análise do anúncio</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/60 p-2.5">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Anúncios recentes</p>
                <p className="text-[9px] text-muted-foreground">Exemplo da organização exibida no painel</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">3 itens</span>
            </div>
            {[
              { t: "Fone Bluetooth TWS 5.3", s: "Ativo", meta: "MLB · sincronizado" },
              { t: "Suporte Articulado para Monitor", s: "Rascunho", meta: "cópia pronta para editar" },
              { t: "Mini Projetor Portátil", s: "Otimizado", meta: "revisado pela ANÚNCIO AI" },
            ].map((row) => (
              <div key={row.t} className="flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-background/50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold">{row.t}</span>
                  <span className="block truncate text-[9px] text-muted-foreground">{row.meta}</span>
                </span>
                <span className="hidden rounded-md border border-border/60 bg-background/70 px-1.5 py-0.5 text-[9px] font-semibold sm:inline">{row.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
