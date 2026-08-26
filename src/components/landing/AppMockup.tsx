import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { Bot, LayoutGrid, Package, Search, Sparkles, TrendingUp, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { demoImages } from "@/components/landing/demo-media";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const chart = [
  { d: "Seg", v: 18 },
  { d: "Ter", v: 26 },
  { d: "Qua", v: 22 },
  { d: "Qui", v: 34 },
  { d: "Sex", v: 45 },
  { d: "Sáb", v: 38 },
  { d: "Dom", v: 52 },
];

const bars = [
  { d: "A", v: 12 },
  { d: "B", v: 22 },
  { d: "C", v: 16 },
  { d: "D", v: 28 },
  { d: "E", v: 20 },
  { d: "F", v: 31 },
];

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface/70 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-bold leading-tight">{value}</p>
      {hint && <p className="text-[10px] text-success">{hint}</p>}
    </div>
  );
}

/**
 * Mockup ilustrativo da interface do ANÚNCIO ML usado na landing page.
 * Os números são apenas demonstrativos — não representam dados reais.
 */
export function AppMockup({ className }: { className?: string }) {
  return (
    <div className={cn("glass-panel overflow-hidden rounded-3xl p-2 sm:p-3", className)}>
      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="ml-2 text-[10px] text-muted-foreground">
          app.anuncioml.com/dashboard · demonstração
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
              <p className="font-display text-sm font-bold">Bom dia, Douglas</p>
              <p className="text-[10px] text-muted-foreground">Dados demonstrativos</p>
            </div>
            <Badge className="border-success/40 bg-success/15 text-success" variant="outline">
              <span className="inline-block size-1.5 rounded-full bg-emerald-400" /> Mercado Livre conectado
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Vendas 7d" value="128" hint="+18%" />
            <MiniStat label="Faturamento" value="R$ 24.9k" hint="+11%" />
            <MiniStat label="Anúncios" value="342" />
            <MiniStat label="Oportunidades" value="17" hint="novas" />
          </div>

          <div className="grid gap-2 sm:grid-cols-[1.6fr_1fr]">
            <div className="rounded-xl border border-border/70 bg-surface/70 p-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Faturamento
              </p>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="mockGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.7} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="d" hide />
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      fill="url(#mockGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/70 bg-surface/70 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> ANÚNCIO AI
              </div>
              <p className="text-[10px] text-muted-foreground">Otimizando 25 anúncios</p>
              <Progress value={87} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">87% concluído</p>
              <div className="h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bars}>
                    <Bar dataKey="v" fill="var(--color-secondary)" radius={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-border/70 bg-surface/70 p-2">
            {[
              {
                t: "Fone Bluetooth TWS Pro 5.3",
                p: "R$ 129,90",
                s: "Ativo",
                img: demoImages.fone,
                sales: "1,2 mil vendidos",
                margin: "margem 32%",
              },
              {
                t: "Suporte Articulado Monitor",
                p: "R$ 89,00",
                s: "Otimizado",
                img: demoImages.suporte,
                sales: "870 vendidos",
                margin: "margem 31%",
              },
              {
                t: "Mini Projetor Full HD",
                p: "R$ 549,90",
                s: "Rascunho",
                img: demoImages.projetor,
                sales: "410 vendidos",
                margin: "margem 28%",
              },
            ].map((row) => (
              <div key={row.t} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                <img
                  src={row.img}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-9 w-9 shrink-0 rounded-md border border-border/60 object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold">{row.t}</span>
                  <span className="block truncate text-[9px] text-muted-foreground">
                    {row.sales} · {row.margin}
                  </span>
                </span>
                <span className="text-[11px] font-semibold text-primary">{row.p}</span>
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
