import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  Check,
  Copy,
  Gauge,
  Layers3,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const flow = [
  { number: "01", title: "Encontre", text: "Busque referências por palavra-chave, ID, link ou vendedor.", icon: Search },
  { number: "02", title: "Traga para o painel", text: "Transforme a referência em uma base editável para sua operação.", icon: Copy },
  { number: "03", title: "Melhore com IA", text: "Revise título, descrição, atributos e apresentação com inteligência artificial.", icon: Wand2 },
  { number: "04", title: "Publique e acompanhe", text: "Envie para sua conta conectada e continue gerenciando pelo ANÚNCIO ML.", icon: PackageCheck },
];

const before = [
  "Abrir várias abas para pesquisar referências",
  "Copiar informações e organizar tudo manualmente",
  "Reescrever título e descrição do zero",
  "Alternar entre ferramentas para concluir o anúncio",
];

const after = [
  "Pesquisa e referências dentro do mesmo fluxo",
  "Cópias editáveis e ações em lote",
  "IA integrada para acelerar a otimização",
  "Publicação e gestão próximas da operação",
];

const reasons = [
  { title: "Feito para Mercado Livre", text: "A experiência é pensada para a rotina de quem trabalha anúncios no marketplace, não para um fluxo genérico.", icon: Target },
  { title: "IA onde faz sentido", text: "Use inteligência artificial para acelerar tarefas de conteúdo sem tirar de você o controle da edição.", icon: Bot },
  { title: "Escala operacional", text: "Recursos em lote ajudam quando a operação cresce e editar anúncio por anúncio começa a consumir tempo demais.", icon: Layers3 },
  { title: "Visão centralizada", text: "Menos troca de telas para pesquisar, preparar, revisar e acompanhar o que está acontecendo na operação.", icon: Gauge },
  { title: "Conexão protegida", text: "A integração com a conta Mercado Livre usa o fluxo de autorização da própria plataforma.", icon: ShieldCheck },
  { title: "Comece pequeno", text: "Teste o fluxo com 10 anúncios antes de decidir como quer avançar dentro da plataforma.", icon: Zap },
];

export function SalesShowcase() {
  return (
    <>
      <section id="demo" className="border-y border-border/60 bg-surface/20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> DO PRIMEIRO CLIQUE À PUBLICAÇÃO
            </span>
            <h2 className="mt-4 text-balance text-3xl font-black tracking-tight sm:text-5xl">Um fluxo pensado para tirar trabalho repetitivo do caminho.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty leading-7 text-muted-foreground">Você encontra uma referência, traz para sua operação, melhora o anúncio e prepara a publicação sem reconstruir todo o processo a cada produto.</p>
          </div>

          <div className="relative mt-12 grid gap-4 lg:grid-cols-4">
            <div className="pointer-events-none absolute left-[12%] right-[12%] top-10 hidden h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent lg:block" />
            {flow.map((item) => (
              <article key={item.number} className="relative rounded-3xl border border-border/70 bg-background/80 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><item.icon className="h-5 w-5" /></span>
                  <span className="text-4xl font-black text-foreground/[.06]">{item.number}</span>
                </div>
                <h3 className="mt-5 text-lg font-black">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Button asChild size="lg" className="gap-2 font-bold shadow-glow">
              <Link to="/auth" search={{ mode: "signup" }}>Quero testar com 10 anúncios <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[var(--shadow-panel)] lg:grid-cols-2">
            <div className="border-b border-border/70 p-6 sm:p-9 lg:border-b-0 lg:border-r">
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-muted-foreground">SEM UMA CENTRAL</p>
              <h2 className="mt-3 text-2xl font-black sm:text-3xl">A operação vai ficando espalhada.</h2>
              <div className="mt-7 space-y-3">
                {before.map((item) => <div key={item} className="flex gap-3 rounded-2xl border border-border/60 bg-surface/30 p-4 text-sm text-muted-foreground"><span className="font-black text-destructive/70">×</span><span>{item}</span></div>)}
              </div>
            </div>
            <div className="relative overflow-hidden bg-primary/[.06] p-6 sm:p-9">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
              <p className="relative text-xs font-extrabold uppercase tracking-[.18em] text-primary">COM ANÚNCIO ML</p>
              <h2 className="relative mt-3 text-2xl font-black sm:text-3xl">O trabalho entra em um fluxo único.</h2>
              <div className="relative mt-7 space-y-3">
                {after.map((item) => <div key={item} className="flex gap-3 rounded-2xl border border-primary/20 bg-background/70 p-4 text-sm font-semibold"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"><Check className="h-3 w-3" /></span><span>{item}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-surface/20 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">POR QUE USAR</p>
            <h2 className="mt-3 text-balance text-3xl font-black sm:text-4xl">Não é só criar um anúncio. É ganhar uma forma melhor de operar.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">O ANÚNCIO ML foi estruturado para juntar ferramentas que normalmente ficam separadas e transformar isso em uma rotina mais simples para o vendedor.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reasons.map((item) => (
              <article key={item.title} className="group rounded-3xl border border-border/70 bg-background/75 p-6 transition hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-110"><item.icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-lg font-black">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
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
                <p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">TESTE O FLUXO</p>
                <h2 className="mt-3 max-w-3xl text-balance text-3xl font-black sm:text-4xl">Veja na sua própria operação se o ANÚNCIO ML economiza o trabalho que hoje você faz na mão.</h2>
                <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">Comece com 10 anúncios para conhecer o painel e experimentar o processo antes de escolher um plano.</p>
              </div>
              <Button asChild size="lg" className="relative gap-2 px-7 font-bold shadow-glow">
                <Link to="/auth" search={{ mode: "signup" }}>Começar agora <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
