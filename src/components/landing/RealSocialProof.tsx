import {
  BarChart3,
  Bot,
  Boxes,
  CircleDollarSign,
  Copy,
  Image,
  Layers3,
  MessageCircleQuestion,
  PackageCheck,
  Search,
  Sparkles,
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
    description: "Melhore títulos, descrições, atributos e estrutura do anúncio sem precisar refazer tudo manualmente.",
    icon: Bot,
  },
  {
    title: "Criar imagens com IA",
    description: "Gere imagens para seus produtos dentro da plataforma e deixe a apresentação do anúncio mais profissional.",
    icon: Image,
  },
  {
    title: "Publicar no Mercado Livre",
    description: "Prepare o anúncio no ANÚNCIO ML e envie para a sua conta conectada do Mercado Livre.",
    icon: PackageCheck,
  },
  {
    title: "Gerenciar anúncios",
    description: "Organize anúncios ativos, pausados e rascunhos sem perder tempo alternando entre várias telas.",
    icon: Boxes,
  },
  {
    title: "Central do vendedor",
    description: "Acompanhe anúncios, estoque, vendas, saúde da operação e oportunidades em um só lugar.",
    icon: BarChart3,
  },
  {
    title: "Perguntas da operação",
    description: "Centralize o acompanhamento das perguntas dos seus anúncios e mantenha o atendimento organizado.",
    icon: MessageCircleQuestion,
  },
  {
    title: "Conta ML conectada",
    description: "Use sua própria conta do Mercado Livre para sincronizar e administrar a operação dentro da plataforma.",
    icon: Store,
  },
  {
    title: "Trabalho em lote",
    description: "Execute ações em vários anúncios para reduzir tarefas repetitivas e ganhar velocidade no dia a dia.",
    icon: Layers3,
  },
  {
    title: "Créditos de IA sob controle",
    description: "Acompanhe o uso dos recursos de inteligência artificial e saiba quanto ainda tem disponível no plano.",
    icon: Sparkles,
  },
  {
    title: "Visão comercial da operação",
    description: "Tenha uma visão mais clara da sua operação para decidir onde otimizar, publicar e concentrar esforço.",
    icon: CircleDollarSign,
  },
];

const outcomes = [
  "Menos copiar e colar manualmente",
  "Mais velocidade para criar e revisar anúncios",
  "Operação concentrada em um único painel",
  "IA integrada ao fluxo do vendedor",
];

export function RealSocialProof() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-gradient-to-br from-primary/[.12] via-card to-secondary/[.07] p-5 shadow-[var(--shadow-panel)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-secondary/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.2em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_currentColor]" />
              CENTRAL DO VENDEDOR
            </div>
            <h2 className="mt-3 max-w-3xl text-2xl font-extrabold tracking-tight sm:text-4xl">
              Uma central feita para quem quer vender mais sem transformar a operação em trabalho manual.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Da pesquisa de referências à publicação e gestão dos anúncios: veja tudo o que você pode concentrar dentro do ANÚNCIO ML.
          </p>
        </div>

        <div className="relative mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

        <div className="relative mt-8 rounded-3xl border border-primary/20 bg-primary/[.07] p-5 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">NA PRÁTICA</p>
              <h3 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">Mais tempo para vender. Menos tempo repetindo tarefa.</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                O objetivo é simples: reduzir etapas operacionais e deixar busca, criação, IA, publicação e acompanhamento mais próximos no mesmo fluxo.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {outcomes.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-sm font-semibold">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
