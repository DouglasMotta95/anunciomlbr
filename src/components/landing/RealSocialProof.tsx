import { ArrowRight, BarChart3, Copy, Lightbulb, Search, Sparkles } from "lucide-react";

const flow = [
  { title: "Encontre", text: "Busque referências e contexto de mercado.", icon: Search },
  { title: "Prepare", text: "Transforme referência em rascunho e revise com IA.", icon: Copy },
  { title: "Acompanhe", text: "Veja anúncio, operação e desempenho no mesmo painel.", icon: BarChart3 },
  { title: "Aja", text: "Transforme sinais disponíveis em uma próxima ação clara.", icon: Lightbulb },
] as const;

export function RealSocialProof() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/[.1] via-card to-secondary/[.05] p-5 shadow-[var(--shadow-panel)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/12 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[.78fr_1.22fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.2em] text-primary"><Sparkles className="h-3.5 w-3.5" /> DO DADO À AÇÃO</div>
            <h2 className="mt-4 max-w-xl text-balance text-2xl font-black tracking-tight sm:text-4xl">O valor não está em ter mais telas. Está em conectar o próximo passo.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">O ANÚNCIO ML aproxima pesquisa, criação, acompanhamento e decisão para reduzir o trabalho de juntar informações espalhadas.</p>
          </div>

          <div className="relative grid gap-3 sm:grid-cols-2">
            {flow.map(({ title, text, icon: Icon }, index) => (
              <article key={title} className="group relative rounded-2xl border border-border/70 bg-background/80 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110"><Icon className="h-5 w-5" /></span>
                  <span className="font-display text-3xl font-black text-foreground/[.06]">0{index + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-black">{title}</h3>
                <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{text}</p>
                {index < flow.length - 1 && <ArrowRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-primary/40 lg:block" />}
              </article>
            ))}
          </div>
        </div>

        <div className="relative mt-7 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[.06] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-primary">A IDEIA CENTRAL</p><p className="mt-1 font-black">Encontrar o problema e levar você para a ação correspondente.</p></div>
          <p className="max-w-lg text-xs leading-5 text-muted-foreground sm:text-right">Sem prometer resultado automático e sem esconder quando uma visualização é apenas demonstrativa.</p>
        </div>
      </div>
    </section>
  );
}
