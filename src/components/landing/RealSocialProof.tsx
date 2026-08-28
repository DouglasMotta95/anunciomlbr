import {
  BarChart3,
  Bot,
  Copy,
  PackageCheck,
  Search,
  Store,
} from "lucide-react";

const sellerPanels = [
  {
    title: "Buscar anúncios vencedores",
    description: "Pesquise por termo, ID, link ou vendedor e encontre referências para trabalhar mais rápido.",
    icon: Search,
  },
  {
    title: "Copiar anúncios em massa",
    description: "Selecione vários anúncios e transforme referências em novos rascunhos dentro da sua operação.",
    icon: Copy,
  },
  {
    title: "Otimizar com IA",
    description: "Melhore títulos, descrições e estrutura do anúncio sem precisar refazer tudo manualmente.",
    icon: Bot,
  },
  {
    title: "Publicar no Mercado Livre",
    description: "Prepare o anúncio no ANÚNCIO ML e envie para a sua conta conectada do Mercado Livre.",
    icon: PackageCheck,
  },
  {
    title: "Central do vendedor",
    description: "Acompanhe anúncios, estoque, perguntas, vendas, saúde da operação e oportunidades em um só lugar.",
    icon: BarChart3,
  },
  {
    title: "Conta ML conectada",
    description: "Use sua própria conta do Mercado Livre para sincronizar e administrar a operação dentro da plataforma.",
    icon: Store,
  },
];

export function RealSocialProof() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/[.12] via-card to-secondary/[.07] p-5 shadow-[var(--shadow-panel)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_currentColor]" />
              CENTRAL DO VENDEDOR
            </div>
            <h2 className="mt-3 max-w-2xl text-2xl font-extrabold tracking-tight sm:text-4xl">
              Tudo que você precisa para operar seus anúncios em um só painel.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Em vez de números soltos, aqui você vê o que o ANÚNCIO ML realmente entrega no dia a dia de quem vende no Mercado Livre.
          </p>
        </div>

        <div className="relative mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sellerPanels.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="group rounded-2xl border border-border/70 bg-background/75 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-primary/15 bg-primary/10 p-2.5 transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
