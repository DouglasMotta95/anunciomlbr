import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Flame,
  Gauge,
  Layers,
  ListChecks,
  Rocket,
  Search,
  Sparkles,
  Store,
  Wand2,
} from "lucide-react";
import { useState } from "react";

import { AppMockup } from "@/components/landing/AppMockup";
import { Logo, SLOGAN } from "@/components/brand";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { usePeriods, usePlans } from "@/hooks/usePlans";
import { formatBRL } from "@/lib/format";
import {
  periodMonthlyCents,
  periodSavingsCents,
  periodTotalCents,
  type BillingPeriod,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

function SectionTitle({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-balance text-3xl font-extrabold sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-pretty text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#demo" className="transition-colors hover:text-foreground">
            Demonstração
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">
            Como funciona
          </a>
          <a href="#ia" className="transition-colors hover:text-foreground">
            IA
          </a>
          <a href="#planos" className="transition-colors hover:text-foreground">
            Planos
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="font-semibold">
            <Link to="/auth" search={{ mode: "signup" }}>
              Começar grátis
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section className="grid-noise relative overflow-hidden border-b border-border/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:py-24">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            🎁 10 ANÚNCIOS GRÁTIS
          </Badge>
          <h1 className="mt-5 text-pretty text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Encontre, copie, otimize e publique seus anúncios em{" "}
            <span className="text-gradient">poucos cliques.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            O ANÚNCIO ML reúne inteligência, automação e gestão para você economizar tempo e
            melhorar sua operação.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="font-semibold shadow-glow">
              <Link to="/auth" search={{ mode: "signup" }}>
                Começar grátis <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#demo">Ver demonstração</a>
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            {SLOGAN} · Integrações oficiais Mercado Livre e Mercado Pago.
          </p>
        </div>

        <div className="animate-in fade-in zoom-in-95 duration-1000">
          <AppMockup />
        </div>
      </div>
    </section>
  );
}

const demoSteps = [
  { label: "47 anúncios encontrados", icon: Search, value: 20 },
  { label: "25 anúncios selecionados", icon: ListChecks, value: 40 },
  { label: "IA analisando", icon: Sparkles, value: 65 },
  { label: "23 anúncios otimizados", icon: Wand2, value: 87 },
  { label: "Processamento concluído", icon: CheckCircle2, value: 100 },
];

export function DemoSection() {
  const [step, setStep] = useState(4);
  const current = demoSteps[step]!;

  return (
    <section id="demo" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Demonstração"
          title="Veja o fluxo completo funcionando"
          subtitle="Simulação visual do processamento em massa. Os números abaixo são apenas demonstrativos."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-2">
            {demoSteps.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setStep(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                  i <= step
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/60 bg-surface/50 opacity-70",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    i <= step ? "bg-primary text-primary-foreground" : "bg-accent",
                  )}
                >
                  <s.icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-semibold">{s.label}</span>
                {i <= step && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>

          <Card className="glass-panel flex flex-col justify-center gap-4 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <current.icon className="h-4 w-4" /> {current.label}
            </div>
            <Progress value={current.value} className="h-2.5" />
            <p className="font-display text-3xl font-extrabold">{current.value}%</p>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {["Aguardando", "Processando", "Concluído", "Erro"].map((state, i) => (
                <div
                  key={state}
                  className={cn(
                    "rounded-lg border border-border/60 bg-surface/60 px-2 py-1.5 text-center",
                    i === 2 && step === 4 && "border-success/40 text-success",
                  )}
                >
                  {state}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Nenhuma operação é marcada como concluída sem confirmação real do backend.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}

const steps = [
  { n: "01", t: "ENCONTRE", d: "Pesquise anúncios, produtos ou palavras-chave.", icon: Search },
  { n: "02", t: "SELECIONE", d: "Selecione um ou vários anúncios.", icon: ListChecks },
  { n: "03", t: "COPIE", d: "Crie uma cópia editável.", icon: Copy },
  { n: "04", t: "OTIMIZE", d: "Use IA para melhorar título, descrição e dados.", icon: Sparkles },
  { n: "05", t: "PUBLIQUE", d: "Prepare e publique via integração oficial.", icon: Rocket },
  { n: "06", t: "GERENCIE", d: "Acompanhe anúncios, vendas, estoque e performance.", icon: Gauge },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow="Como funciona" title="Seis etapas, do achado à venda" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <Card
              key={s.n}
              className="group relative overflow-hidden border-border/60 bg-surface/60 p-5 transition-all hover:-translate-y-1 hover:border-primary/40"
            >
              <span className="absolute right-4 top-3 font-display text-4xl font-extrabold text-foreground/5">
                {s.n}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-sm font-bold tracking-wide">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

const copyResults = [
  { t: "Fone Bluetooth TWS Pro 5.3", p: "R$ 129,90", c: "Eletrônicos", id: "MLB1234567890" },
  { t: "Suporte Articulado para Monitor", p: "R$ 89,00", c: "Informática", id: "MLB2233445566" },
  { t: "Mini Projetor Portátil Full HD", p: "R$ 549,90", c: "Áudio e Vídeo", id: "MLB9988776655" },
];

export function CopySection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Copiar anúncios"
          title="Pesquise, selecione e copie em segundos"
          subtitle="Busque por palavra-chave, produto, ID, link ou vendedor e crie cópias editáveis na sua conta."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card className="border-border/60 bg-surface/60 p-4">
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
              <Search className="h-4 w-4" /> fone bluetooth
            </div>
            <div className="space-y-2">
              {copyResults.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 p-2.5"
                >
                  <Checkbox checked className="pointer-events-none" />
                  <span className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-secondary/50 to-primary/40" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.t}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.c} · {r.id}
                    </p>
                  </div>
                  <span className="hidden text-sm font-bold text-primary sm:block">{r.p}</span>
                  <Button size="sm" variant="secondary" className="h-8 text-xs font-bold">
                    COPIAR
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="border-primary/30 bg-primary/5 p-5">
              <div className="flex items-center gap-2 font-display text-sm font-bold">
                <Layers className="h-4 w-4 text-primary" /> COPIAR EM MASSA
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Selecione 1, vários ou todos os resultados.
              </p>
              <p className="mt-4 font-display text-2xl font-extrabold text-primary">
                47 anúncios selecionados
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["COPIAR SELECIONADOS", "OTIMIZAR COM IA", "EXPORTAR", "COPIAR CÓDIGOS"].map(
                  (b) => (
                    <span
                      key={b}
                      className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-[11px] font-semibold"
                    >
                      {b}
                    </span>
                  ),
                )}
              </div>
              <div className="mt-4 space-y-1.5">
                <Progress value={87} className="h-2" />
                <p className="text-xs text-muted-foreground">87% · fila de processamento</p>
              </div>
            </Card>
            <Card className="border-success/30 bg-success/10 p-4 text-sm font-semibold text-success">
              ✓ 47 códigos copiados
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AiSection() {
  return (
    <section id="ia" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="ANÚNCIO AI"
          title="A IA que dá nota e melhora seus anúncios"
          subtitle="Título, descrição, palavras-chave, atributos e variações — sempre com revisão antes de aplicar."
        />
        <div className="mt-10 grid items-center gap-4 lg:grid-cols-3">
          <Card className="border-border/60 bg-surface/60 p-6 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Antes</p>
            <p className="mt-2 font-display text-5xl font-extrabold text-muted-foreground">68</p>
            <p className="text-xs text-muted-foreground">score /100</p>
          </Card>
          <Card className="glass-panel flex flex-col items-center gap-3 p-6 text-center">
            <Sparkles className="h-6 w-6 animate-pulse text-primary" />
            <p className="font-display text-sm font-bold">IA ANALISANDO</p>
            <Progress value={72} className="h-2" />
            <ul className="space-y-1 text-left text-xs text-muted-foreground">
              <li>✓ Título otimizado</li>
              <li>✓ Descrição melhorada</li>
              <li>✓ Palavras-chave</li>
              <li>✓ Estrutura</li>
              <li>✓ Atributos</li>
            </ul>
            <Button size="sm" className="mt-1 w-full font-semibold">
              Aplicar melhorias
            </Button>
          </Card>
          <Card className="border-primary/40 bg-primary/10 p-6 text-center shadow-glow">
            <p className="text-xs uppercase tracking-wider text-primary">Depois</p>
            <p className="mt-2 font-display text-5xl font-extrabold text-primary">94</p>
            <p className="text-xs text-muted-foreground">score /100</p>
          </Card>
        </div>
      </div>
    </section>
  );
}

const modules = [
  { t: "Dashboard", d: "Vendas, faturamento, lucro, estoque e alertas em um só lugar.", icon: BarChart3 },
  { t: "Vendas", d: "Pedidos, ticket médio e cancelamentos com filtros por período.", icon: Store },
  { t: "Estoque", d: "Estoque atual, baixo, sem estoque e movimentações com alertas.", icon: Boxes },
  { t: "Oportunidades", d: "Anúncios incompletos, margem baixa e performance fraca.", icon: Flame },
];

export function ModulesSection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Painel"
          title="Um SaaS completo depois do login"
          subtitle="Dados reais aparecem quando sua conta do Mercado Livre estiver conectada."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <AppMockup />
          <div className="grid gap-3">
            {modules.map((m) => (
              <Card
                key={m.t}
                className="flex items-start gap-3 border-border/60 bg-surface/60 p-4 transition-colors hover:border-primary/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/20 text-secondary">
                  <m.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-display text-sm font-bold">{m.t}</p>
                  <p className="text-sm text-muted-foreground">{m.d}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PricingSection() {
  const { data: plans, isLoading } = usePlans();
  const { data: periods } = usePeriods();
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const discount = periods?.find((p) => p.period === period) ?? periods?.[0];

  return (
    <section id="planos" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Planos"
          title="Escolha o plano e o período"
          subtitle="Comece com 10 anúncios grátis. Preços e descontos configuráveis pelo administrador."
        />

        <div className="mx-auto mt-8 flex w-fit flex-wrap justify-center gap-1 rounded-xl border border-border/60 bg-surface/60 p-1">
          {(periods ?? []).map((p) => (
            <button
              key={p.period}
              onClick={() => setPeriod(p.period)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors",
                period === p.period
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
              {Number(p.discount_percent) > 0 && (
                <span className="ml-1 text-[10px] opacity-80">-{Number(p.discount_percent)}%</span>
              )}
            </button>
          ))}
        </div>
        {period === "annual" && (
          <p className="mt-3 text-center text-xs font-semibold text-primary">
            ⭐ MELHOR CUSTO-BENEFÍCIO
          </p>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-80 animate-pulse border-border/60 bg-surface/50" />
            ))}
          {!isLoading &&
            discount &&
            (plans ?? []).map((plan) => {
              const total = periodTotalCents(plan, discount);
              const monthly = periodMonthlyCents(plan, discount);
              const savings = periodSavingsCents(plan, discount);
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "flex flex-col border-border/60 bg-surface/60 p-5",
                    plan.highlighted && "border-primary/50 bg-primary/5 shadow-glow",
                  )}
                >
                  {plan.highlighted && (
                    <Badge className="mb-2 w-fit bg-primary text-primary-foreground">
                      Mais popular
                    </Badge>
                  )}
                  <p className="font-display text-sm font-extrabold tracking-wide">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                  <p className="mt-4 font-display text-3xl font-extrabold">
                    {formatBRL(monthly)}
                    <span className="text-sm font-medium text-muted-foreground">/mês</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(total)} por {discount.months} {discount.months > 1 ? "meses" : "mês"}
                  </p>
                  {savings > 0 && (
                    <p className="mt-1 text-xs font-semibold text-success">
                      Economia de {formatBRL(savings)}
                    </p>
                  )}
                  <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2 text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="mt-5 font-semibold"
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    <Link to="/auth" search={{ mode: "signup" }}>
                      Assinar {plan.name}
                    </Link>
                  </Button>
                </Card>
              );
            })}
        </div>
      </div>
    </section>
  );
}

const faq = [
  {
    q: "O ANÚNCIO ML é uma plataforma oficial do Mercado Livre?",
    a: "Não. Somos uma plataforma independente que utiliza apenas as APIs e integrações oficiais disponibilizadas publicamente pelo Mercado Livre e Mercado Pago.",
  },
  {
    q: "Como funciona o teste gratuito?",
    a: "Toda nova conta elegível recebe 10 anúncios gratuitos para testar busca, cópia e otimização com IA. Ao atingir o limite, basta escolher um plano.",
  },
  {
    q: "Como copiar um anúncio funciona na prática?",
    a: "A cópia gera um rascunho editável dentro da sua conta, com título, descrição, preço, estoque, categoria e imagens. Você revisa, otimiza e só então publica.",
  },
  {
    q: "Meu plano é ativado automaticamente após o pagamento?",
    a: "Sim. A liberação acontece somente após a confirmação válida do pagamento pelo Mercado Pago, via webhook processado no nosso backend.",
  },
  {
    q: "Posso pagar por Pix ou WhatsApp?",
    a: "Sim. Nessa modalidade o administrador gera manualmente a sua licença e você a ativa na tela “Já tenho uma licença”.",
  },
  {
    q: "Meus dados são apagados se o plano expirar?",
    a: "Não. Recursos premium ficam bloqueados, mas seus anúncios e dados permanecem salvos aguardando a renovação.",
  },
];

export function FaqSection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4">
        <SectionTitle eyebrow="FAQ" title="Perguntas frequentes" />
        <Accordion type="single" collapsible className="mt-8">
          {faq.map((item) => (
            <AccordionItem key={item.q} value={item.q} className="border-border/60">
              <AccordionTrigger className="text-left text-sm font-semibold">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="grid-noise py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-balance text-3xl font-extrabold sm:text-4xl">
          Comece hoje com <span className="text-gradient">10 anúncios grátis</span>
        </h2>
        <p className="mt-3 text-muted-foreground">{SLOGAN}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="font-semibold shadow-glow">
            <Link to="/auth" search={{ mode: "signup" }}>
              Criar minha conta <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Já tenho conta</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
        <Logo />
        <p>
          ANÚNCIO ML é uma plataforma independente e não possui vínculo oficial com o Mercado Livre.
        </p>
        <Link to="/admin/login" className="transition-colors hover:text-foreground">
          Área administrativa
        </Link>
      </div>
    </footer>
  );
}
