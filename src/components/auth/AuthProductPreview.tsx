import { BarChart3, CheckCircle2, PackageSearch, Search, Sparkles, TrendingUp, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const quickActions = [
  { icon: Search, label: "Buscar referências" },
  { icon: PackageSearch, label: "Copiar anúncio" },
  { icon: Sparkles, label: "Otimizar com IA" },
  { icon: TrendingUp, label: "Acompanhar resultado" },
];

export function AuthProductPreview() {
  return (
    <section className="relative hidden min-h-[680px] overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 p-7 shadow-[var(--shadow-panel)] lg:flex lg:flex-col lg:justify-between xl:p-9">
      <div className="pointer-events-none absolute -left-20 top-6 h-64 w-64 rounded-full bg-secondary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            <Zap className="mr-1.5 h-3.5 w-3.5" /> VISÃO DO PRODUTO
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <span className="size-2 rounded-full bg-success shadow-[0_0_0_4px_hsl(var(--success)/.08)]" />
            Fluxo conectado
          </span>
        </div>

        <h2 className="mt-6 max-w-xl text-balance text-3xl font-black leading-tight xl:text-4xl">
          Entre e continue sua operação de onde parou.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground xl:text-base">
          Pesquisa, cópia, otimização, publicação e acompanhamento dentro da mesma central.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          {quickActions.map((item, index) => (
            <div
              key={item.label}
              className="group rounded-2xl border border-border/70 bg-background/65 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:bg-background hover:shadow-lg"
              style={{ transitionDelay: `${index * 25}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <item.icon className="size-4" />
                </span>
                <span className="text-sm font-bold">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-8 overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/75 p-3 shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-border/60 px-2 pb-3 pt-1">
          <span className="size-2.5 rounded-full bg-destructive/70" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
          <span className="ml-2 text-[10px] font-semibold text-muted-foreground">ANÚNCIO ML · demonstração do painel</span>
        </div>

        <div className="grid gap-3 p-2 pt-4 xl:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Busca inteligente</p>
                  <p className="mt-1 text-sm font-extrabold">Resultados reais do Mercado Livre</p>
                </div>
                <PackageSearch className="size-5 text-primary" />
              </div>
              <div className="mt-4 space-y-2">
                {["Referência confirmada", "Preço e status validados", "Pronto para duplicar"].map((text, index) => (
                  <div key={text} className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/70 px-3 py-2.5">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {index === 2 ? <Sparkles className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                    </span>
                    <span className="text-[11px] font-semibold">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/60 bg-card p-4 transition-transform duration-300 hover:-translate-y-1">
                <BarChart3 className="size-4 text-secondary" />
                <p className="mt-3 text-xs font-bold">Vendas e desempenho</p>
                <div className="mt-3 flex h-12 items-end gap-1.5">
                  {[38, 52, 44, 66, 58, 78, 72].map((height, index) => (
                    <span key={index} className="w-full rounded-sm bg-secondary/70" style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/[.06] p-4 transition-transform duration-300 hover:-translate-y-1">
                <Sparkles className="size-4 text-primary" />
                <p className="mt-3 text-xs font-bold">ANÚNCIO AI</p>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Sugestões aplicadas sob sua confirmação.</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-3/4 rounded-full bg-primary" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Operação</p>
            <div className="mt-4 space-y-3">
              {[
                ["Mercado Livre", "Conectado", true],
                ["Busca e cópia", "Pronta", true],
                ["Otimização", "Sob demanda", true],
                ["Publicação", "Com confirmação", true],
              ].map(([label, status, active]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/70 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold">{String(label)}</p>
                    <p className="text-[9px] text-muted-foreground">{String(status)}</p>
                  </div>
                  <span className={active ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-muted"} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-4 text-success" />
        Visual ilustrativo da interface. Dados do cliente só aparecem após conexão e sincronização.
      </div>
    </section>
  );
}
