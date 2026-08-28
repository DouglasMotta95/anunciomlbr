import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  PackageSearch,
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

const benefits = [
  "Busque anúncios e produtos no Mercado Livre em uma única tela",
  "Crie cópias editáveis sem sujar o título com “cópia” ou “copy”",
  "Use IA para revisar título, descrição, atributos e qualidade do anúncio",
  "Acompanhe anúncios, vendas, estoque e utilização do plano",
];

export function PremiumHero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/.12),transparent_34%),radial-gradient(circle_at_85%_15%,hsl(var(--warning)/.09),transparent_28%)]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:py-24">
        <div>
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            <Zap className="mr-1.5 h-3.5 w-3.5" /> CENTRAL PARA VENDEDORES DO MERCADO LIVRE
          </Badge>
          <h1 className="mt-5 text-balance text-4xl font-black leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl">
            Menos trabalho operacional. <span className="text-gradient">Mais controle sobre seus anúncios.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            O ANÚNCIO ML reúne busca, cópia, edição, otimização com IA e gestão da operação para você trabalhar seus anúncios sem depender de várias ferramentas separadas.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-surface/50 p-3.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm font-medium leading-5 text-foreground/90">{benefit}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2 font-bold shadow-glow">
              <Link to="/auth" search={{ mode: "signup" }}>
                Começar com 10 anúncios <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#demo">Ver o sistema por dentro</a>
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" /> OAuth oficial do Mercado Livre</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> IA aplicada sob demanda</span>
            <span className="inline-flex items-center gap-1.5"><ShoppingBag className="h-4 w-4 text-primary" /> Dados reais no painel autenticado</span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 rounded-[40px] bg-primary/5 blur-3xl" />
          <AppMockup className="relative" />
        </div>
      </div>
    </section>
  );
}

const capabilities = [
  {
    icon: PackageSearch,
    title: "Buscar e trazer anúncios",
    text: "Pesquise por palavra-chave, produto, ID ou link e leve a estrutura do anúncio para dentro do ANÚNCIO ML.",
  },
  {
    icon: Copy,
    title: "Criar cópias de verdade",
    text: "Duplique anúncios já salvos no sistema com imagens e atributos, mantendo o título limpo para edição.",
  },
  {
    icon: Wand2,
    title: "Otimizar com contexto",
    text: "A IA considera título, descrição, categoria, preço e atributos disponíveis antes de sugerir melhorias.",
  },
  {
    icon: BarChart3,
    title: "Acompanhar a operação",
    text: "Veja anúncios ativos, utilização do plano, vendas sincronizadas e desempenho sem números fictícios na área do cliente.",
  },
];

export function PremiumCapabilities() {
  return (
    <section className="border-b border-border/60 bg-surface/20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">O QUE VOCÊ FAZ NA PLATAFORMA</Badge>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-4xl">Um fluxo completo, sem transformar o painel em um labirinto</h2>
          <p className="mt-3 text-pretty leading-7 text-muted-foreground">
            Cada módulo tem uma função clara: encontrar oportunidades, preparar anúncios, melhorar conteúdo e acompanhar o que está acontecendo na conta.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {capabilities.map((item, index) => (
            <Card key={item.title} className="group overflow-hidden border-border/60 bg-background/70 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-4xl font-black text-foreground/5">0{index + 1}</span>
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
