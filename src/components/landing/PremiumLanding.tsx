import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  PackageSearch,
  Play,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";

import { AppMockup } from "@/components/landing/AppMockup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const flow = [
  { icon: PackageSearch, label: "Buscar", hint: "referências reais" },
  { icon: Copy, label: "Copiar", hint: "rascunho editável" },
  { icon: Wand2, label: "Otimizar", hint: "IA com contexto" },
  { icon: Rocket, label: "Publicar", hint: "fluxo integrado" },
];

export function PremiumHero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/.12),transparent_34%),radial-gradient(circle_at_85%_15%,hsl(var(--warning)/.09),transparent_28%)]" />
      <div className="pointer-events-none absolute left-[8%] top-24 h-40 w-40 rounded-full bg-primary/10 blur-3xl motion-safe:animate-pulse" />
      <div className="pointer-events-none absolute right-[8%] top-40 h-52 w-52 rounded-full bg-secondary/10 blur-3xl motion-safe:animate-pulse" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:py-20">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            <Zap className="mr-1.5 h-3.5 w-3.5" /> CENTRAL PARA VENDEDORES DO MERCADO LIVRE
          </Badge>
          <h1 className="mt-5 text-balance text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
            Seu Mercado Livre, <span className="text-gradient">mais rápido e inteligente.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Da pesquisa à publicação, organize a operação em um painel visual feito para quem vende de verdade.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {flow.map((item, index) => (
              <div
                key={item.label}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background/55 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-surface/70 hover:shadow-lg"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105">
                  <item.icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-extrabold">{item.label}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{item.hint}</p>
                {index < flow.length - 1 && <ArrowRight className="absolute right-2 top-2 hidden h-3.5 w-3.5 text-muted-foreground/40 sm:block" />}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2 font-bold shadow-glow transition-transform duration-200 hover:-translate-y-0.5">
              <Link to="/auth" search={{ mode: "signup" }}>
                Testar com 10 anúncios <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 transition-transform duration-200 hover:-translate-y-0.5">
              <a href="#demo-interativa"><Play className="h-4 w-4" /> Ver demo interativa</a>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Quer comparar antes? <a href="#planos" className="font-semibold text-foreground underline-offset-4 hover:underline">Ver planos e recursos</a></p>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> OAuth oficial</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> IA sob demanda</span>
            <span className="inline-flex items-center gap-1.5"><ShoppingBag className="h-4 w-4 text-primary" /> Sem cartão no teste</span>
          </div>
        </div>

        <div className="relative motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-700 lg:delay-150">
          <div className="absolute -inset-8 rounded-[40px] bg-primary/5 blur-3xl" />
          <div className="float-soft relative">
            <AppMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProductTrustBar() {
  const items = [
    { icon: ShieldCheck, text: "Conexão OAuth com Mercado Livre" },
    { icon: PackageSearch, text: "10 anúncios para testar o fluxo" },
    { icon: Sparkles, text: "IA executada no backend" },
    { icon: BarChart3, text: "Painel com dados da conta conectada" },
  ];
  return (
    <section className="border-b border-border/60 bg-surface/30 py-5">
      <div className="mx-auto grid max-w-6xl gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.text}
            className="group flex items-center gap-2.5 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 text-xs font-medium text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background/70 hover:text-foreground"
            style={{ transitionDelay: `${index * 20}ms` }}
          >
            <item.icon className="h-4 w-4 shrink-0 text-primary transition-transform duration-300 group-hover:scale-110" />
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const capabilities = [
  {
    icon: PackageSearch,
    title: "Encontre o que importa",
    text: "Pesquise por palavra-chave, produto, ID, link ou vendedor com confirmação antes de entrar na sua tela.",
  },
  {
    icon: Copy,
    title: "Transforme em rascunho",
    text: "Leve a estrutura para o painel e trabalhe em cima dela sem bagunçar o anúncio original.",
  },
  {
    icon: Wand2,
    title: "Melhore com contexto",
    text: "Use IA sobre dados disponíveis do anúncio, sem depender de sugestões soltas e desconectadas.",
  },
  {
    icon: BarChart3,
    title: "Acompanhe a operação",
    text: "Centralize anúncios, vendas, estoque, oportunidades e uso do plano em uma visão única.",
  },
];

export function PremiumCapabilities() {
  return (
    <section id="como-funciona" className="border-b border-border/60 bg-surface/20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">FLUXO DE TRABALHO</Badge>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-4xl">Menos troca de tela. Mais ação.</h2>
          <p className="mt-3 text-pretty leading-7 text-muted-foreground">
            O ANÚNCIO ML organiza o caminho do vendedor em etapas simples, visuais e conectadas.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {capabilities.map((item, index) => (
            <Card key={item.title} className="group overflow-hidden border-border/60 bg-background/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
              <CardContent className="relative p-6">
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-105">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-4xl font-black text-foreground/5 transition-colors group-hover:text-primary/10">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-extrabold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
