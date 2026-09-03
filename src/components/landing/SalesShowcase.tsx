import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  Check,
  Gauge,
  Layers3,
  ShieldCheck,
  Target,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const before = [
  "Abrir várias abas para pesquisar referências",
  "Copiar informações e organizar tudo manualmente",
  "Reescrever conteúdo e alternar entre ferramentas",
];

const after = [
  "Pesquisa, rascunho e edição no mesmo fluxo",
  "IA integrada para acelerar tarefas de conteúdo",
  "Operação, oportunidades e acompanhamento centralizados",
];

const reasons = [
  { title: "Feito para Mercado Livre", text: "Fluxos pensados para a rotina de quem trabalha anúncios no marketplace.", icon: Target },
  { title: "IA com controle", text: "Acelera tarefas de conteúdo sem tirar de você a revisão e a decisão final.", icon: Bot },
  { title: "Escala operacional", text: "Organiza ações e reduz trabalho repetitivo conforme a operação cresce.", icon: Layers3 },
  { title: "Visão centralizada", text: "Anúncios, vendas, inteligência e prioridades em uma experiência conectada.", icon: Gauge },
  { title: "Conexão protegida", text: "A integração usa o fluxo de autorização do próprio Mercado Livre.", icon: ShieldCheck },
  { title: "Comece pequeno", text: "Teste o fluxo com 10 anúncios antes de decidir como avançar.", icon: Zap },
];

export function SalesShowcase() {
  return (
    <>
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[var(--shadow-panel)] lg:grid-cols-2">
            <div className="border-b border-border/70 p-6 sm:p-9 lg:border-b-0 lg:border-r">
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-muted-foreground">SEM UMA CENTRAL</p>
              <h2 className="mt-3 text-2xl font-black sm:text-3xl">A operação vai ficando espalhada.</h2>
              <div className="mt-7 space-y-3">
                {before.map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-border/60 bg-surface/30 p-4 text-sm text-muted-foreground">
                    <span className="font-black text-destructive/70">×</span><span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative overflow-hidden bg-primary/[.06] p-6 sm:p-9">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
              <p className="relative text-xs font-extrabold uppercase tracking-[.18em] text-primary">COM ANÚNCIO ML</p>
              <h2 className="relative mt-3 text-2xl font-black sm:text-3xl">O trabalho entra em um fluxo único.</h2>
              <div className="relative mt-7 space-y-3">
                {after.map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-primary/20 bg-background/70 p-4 text-sm font-semibold">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"><Check className="h-3 w-3" /></span><span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-surface/20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">POR QUE USAR</p>
              <h2 className="mt-3 text-balance text-3xl font-black sm:text-4xl">Uma central para decidir e agir mais rápido.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">O valor está em conectar as etapas da operação, não em encher a tela de ferramentas soltas.</p>
            </div>
            <Button asChild variant="outline" className="shrink-0"><a href="#recursos">Ver todos os recursos <ArrowRight className="ml-2 h-4 w-4" /></a></Button>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reasons.map((item) => (
              <article key={item.title} className="group rounded-3xl border border-border/70 bg-background/75 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110"><item.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-base font-black">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-7 shadow-[var(--shadow-panel)] sm:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">TESTE O FLUXO REAL</p>
                <h2 className="mt-3 max-w-3xl text-balance text-3xl font-black sm:text-4xl">Use sua própria operação para descobrir quanto trabalho o ANÚNCIO ML pode tirar do caminho.</h2>
                <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">Comece com 10 anúncios, conecte sua conta e avance no seu ritmo.</p>
              </div>
              <Button asChild size="lg" className="relative gap-2 px-7 font-bold shadow-glow">
                <Link to="/auth" search={{ mode: "signup" }}>Começar grátis <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
