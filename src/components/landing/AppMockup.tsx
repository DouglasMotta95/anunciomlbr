import { Bot, LayoutGrid, Package, Search, Sparkles, TrendingUp, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface/70 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-bold leading-tight">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Mockup fiel à estrutura atual do painel do ANÚNCIO ML.
 * Não usa nomes de clientes, vendas fictícias ou números apresentados como resultados reais.
 */
export function AppMockup({ className }: { className?: string }) {
  return (
    <div className={cn("glass-panel overflow-hidden rounded-3xl p-2 sm:p-3", className)}>
      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-2 text-[10px] text-muted-foreground">
          ANÚNCIO ML · demonstração da interface
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-2 rounded-2xl bg-background/70 p-2 sm:gap-3 sm:p-3">
        <aside className="flex w-11 flex-col items-center gap-3 rounded-xl bg-sidebar py-3 sm:w-14">
          {[LayoutGrid, Search, Zap, Bot, TrendingUp, Package].map((Icon, i) => (
            <span
              key={i}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground",
                i === 0 && "bg-primary/15 text-primary",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          ))}
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-sm font-bold">Painel do vendedor</p>
              <p className="text-[10px] text-muted-foreground">Visão demonstrativa do produto</p>
            </div>
            <Badge className="border-success/40 bg-success/15 text-success" variant="outline">
              <span className="inline-block size-1.5 rounded-full bg-emerald-400" /> Mercado Livre conectado
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Anúncios criados" value="—" hint="dados da conta" />
            <MiniStat label="Anúncios ativos" value="—" hint="sincronizados" />
            <MiniStat label="Otimizados por IA" value="—" hint="quando utilizado" />
            <MiniStat label="Valor em catálogo" value="—" hint="calculado no painel" />
          </div>

          <div className="grid gap-2 sm:grid-cols-[1.35fr_1fr]">
            <div className="rounded-xl border border-border/70 bg-surface/70 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Atalhos rápidos</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  [Search, "Buscar anúncios"],
                  [Zap, "Copiar em massa"],
                  [Sparkles, "ANÚNCIO AI"],
                  [TrendingUp, "Relatórios"],
                ].map(([Icon, label]) => {
                  const ItemIcon = Icon as typeof Search;
                  return (
                    <div key={String(label)} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 p-2">
                      <ItemIcon className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-semibold">{String(label)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/70 bg-surface/70 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> ANÚNCIO AI
              </div>
              <p className="text-[10px] text-muted-foreground">Otimização sob demanda</p>
              <Progress value={68} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">Título, descrição e análise</p>
            </div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-border/70 bg-surface/70 p-2">
            {[
              { t: "Anúncio sincronizado do Mercado Livre", s: "Ativo" },
              { t: "Cópia criada para edição", s: "Rascunho" },
              { t: "Anúncio revisado antes da publicação", s: "Pronto" },
            ].map((row) => (
              <div key={row.t} className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Package className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold">{row.t}</span>
                  <span className="block text-[9px] text-muted-foreground">Exemplo da estrutura exibida no painel</span>
                </span>
                <span className="hidden rounded-md bg-accent px-1.5 py-0.5 text-[9px] text-muted-foreground sm:inline">
                  {row.s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
