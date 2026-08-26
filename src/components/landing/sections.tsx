import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Boxes,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  Filter,
  Flame,
  Gauge,
  History,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Lock,
  Package,
  PackageCheck,
  PenSquare,
  Quote,
  Rocket,
  Search,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Truck,
  Users,
  Wand2,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppMockup } from "@/components/landing/AppMockup";
import { ProductThumb, demoImages } from "@/components/landing/demo-media";
import { Logo, SLOGAN } from "@/components/brand";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { usePeriods, usePlans } from "@/hooks/usePlans";
import { formatBRL } from "@/lib/format";
import {
  periodMonthlyCents,
  periodSavingsCents,
  periodTotalCents,
  type BillingPeriod,
} from "@/lib/pricing";
import { trackEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

export function SectionTitle({
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

/** Selo simples usado em mockups para indicar que os dados são apenas ilustrativos. */
function IllustrativeTag() {
  return (
    <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground/70">
      exemplo ilustrativo
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* NAV                                                                        */
/* ------------------------------------------------------------------------ */

export function LandingNav() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const loggedIn = mounted && !!user;

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
          <a href="#recursos" className="transition-colors hover:text-foreground">
            Recursos
          </a>
          <a href="#planos" className="transition-colors hover:text-foreground">
            Planos
          </a>
          <a href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {loggedIn ? (
            <Button asChild size="sm" className="font-semibold">
              <Link to="/dashboard">Acessar dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button asChild size="sm" className="font-semibold">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Começar grátis
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------ */
/* HERO                                                                       */
/* ------------------------------------------------------------------------ */

const heroBenefits = [
  "Encontre produtos que já vendem no Mercado Livre",
  "Copie anúncios em massa com um clique",
  "Otimize títulos e descrições com IA",
  "Publique direto na sua conta ML",
];

const testimonialAvatars = [
  { initials: "RL", color: "bg-secondary text-secondary-foreground" },
  { initials: "MF", color: "bg-primary text-primary-foreground" },
  { initials: "JP", color: "bg-success text-success-foreground" },
  { initials: "TA", color: "bg-warning text-warning-foreground" },
];

function StarRating({ value = 5 }: { value?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < value ? "fill-primary text-primary" : "fill-muted text-muted",
          )}
        />
      ))}
    </div>
  );
}

function AvatarStack({
  avatars,
  count,
}: {
  avatars: { initials: string; color: string }[];
  count: number;
}) {
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {avatars.map((a, i) => (
          <span
            key={i}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold",
              a.color,
            )}
          >
            {a.initials}
          </span>
        ))}
      </div>
      <span className="ml-3 text-xs font-medium text-muted-foreground">
        +{count} vendedores ativos
      </span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="grid-noise relative overflow-hidden border-b border-border/60">
      {/* Glow decorativo de fundo */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute -left-20 top-1/3 h-[350px] w-[350px] rounded-full bg-secondary/15 blur-[100px]" />

      <div className="relative mx-auto grid grid-cols-1 max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:py-24">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            <Sparkles className="mr-1.5 h-3 w-3" /> 10 ANÚNCIOS GRÁTIS PARA COMEÇAR
          </Badge>

          <h1 className="mt-5 text-pretty text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Venda mais no Mercado Livre{" "}
            <span className="text-gradient">sem criar anúncios do zero.</span>
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Descubra produtos com alta demanda, copie anúncios prontos, otimize com IA e publique
            na sua conta — tudo em uma única plataforma.
          </p>

          <ul className="mt-6 space-y-3">
            {heroBenefits.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm font-medium sm:text-base">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-foreground/90">{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="w-full gap-2 bg-gradient-to-r from-primary to-warning font-bold text-primary-foreground shadow-glow sm:w-auto">
              <Link to="/auth" search={{ mode: "signup" }}>
                Quero comprar agora <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href="#demo">Ver demonstração</a>
            </Button>
          </div>

          {/* Prova social + selos de confiança ao lado do CTA */}
          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface/40 p-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="space-y-1">
              <AvatarStack avatars={testimonialAvatars} count={847} />
              <div className="flex items-center gap-2">
                <StarRating value={5} />
                <span className="text-xs font-semibold text-foreground">4.9/5</span>
                <span className="text-[11px] text-muted-foreground">(127 avaliações)</span>
              </div>
            </div>
            <div className="hidden h-8 w-px bg-border/60 sm:block" />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-success" /> Integração oficial ML
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-success" /> Sem cartão para testar
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-success" /> Suporte no WhatsApp
              </span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-border/60 pt-6 sm:max-w-md">
            {[
              { v: "10", l: "anúncios grátis" },
              { v: "6", l: "módulos completos" },
              { v: "24/7", l: "gestão automatizada" },
            ].map((s) => (
              <div key={s.l}>
                <p className="font-display text-xl font-extrabold text-primary sm:text-2xl">{s.v}</p>
                <p className="text-[11px] text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-in fade-in zoom-in-95 duration-1000">
          <div className="float-soft">
            <AppMockup />
          </div>

          {/* Cards flutuantes sobrepostos para dar profundidade ao mockup */}
          <div className="glass-panel float-soft absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-2xl px-3 py-2 lg:flex">
            <ProductThumb src={demoImages.fone} alt="Fone bluetooth (exemplo)" className="h-10 w-10" />
            <div>
              <p className="text-[11px] font-semibold">Fone TWS Pro 5.3</p>
              <p className="text-[10px] text-primary">score 94 · otimizado</p>
            </div>
          </div>
          <div className="glass-panel absolute -right-4 -top-4 hidden items-center gap-2 rounded-2xl px-3 py-2 lg:flex">
            <Store className="h-4 w-4 text-success" />
            <p className="text-[11px] font-semibold">Integração oficial</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* TRUST BAR                                                                  */
/* ------------------------------------------------------------------------ */

const trustItems = [
  { icon: Shield, label: "Integração oficial ML e Mercado Pago" },
  { icon: Lock, label: "Dados protegidos com criptografia" },
  { icon: Zap, label: "Ativação automática após pagamento" },
  { icon: Users, label: "Suporte humano via WhatsApp" },
];

export function TrustBar() {
  return (
    <section className="border-b border-border/60 bg-surface/40 py-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 sm:grid-cols-4">
        {trustItems.map((t) => (
          <div key={t.label} className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            <t.icon className="h-4 w-4 shrink-0 text-primary" />
            <span>{t.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* DEMO                                                                       */
/* ------------------------------------------------------------------------ */

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

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
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
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
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
            <Progress value={current.value} className="h-2.5 transition-all duration-500" />
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

/* ------------------------------------------------------------------------ */
/* COMO FUNCIONA                                                              */
/* ------------------------------------------------------------------------ */

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

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {["BUSCAR", "SELECIONAR", "COPIAR", "OTIMIZAR", "PUBLICAR", "ACOMPANHAR"].map(
            (label, i, arr) => (
              <div key={label} className="flex items-center gap-2">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-bold tracking-wider text-primary">
                  {label}
                </span>
                {i < arr.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                )}
              </div>
            ),
          )}
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <Card
              key={s.n}
              className="group relative overflow-hidden border-border/60 bg-surface/60 p-5 transition-all hover:-translate-y-1 hover:border-primary/40"
            >
              <span className="absolute right-4 top-3 font-display text-4xl font-extrabold text-foreground/5">
                {s.n}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform group-hover:scale-110">
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

/* ------------------------------------------------------------------------ */
/* BUSCA DE ANÚNCIOS                                                          */
/* ------------------------------------------------------------------------ */

const searchResults = [
  { t: "Fone Bluetooth TWS Pro 5.3", p: "R$ 129,90", c: "Eletrônicos", sales: "1.2k vendas", img: demoImages.fone },
  { t: "Suporte Articulado para Monitor", p: "R$ 89,00", c: "Informática", sales: "480 vendas", img: demoImages.suporte },
  { t: "Mini Projetor Portátil Full HD", p: "R$ 549,90", c: "Áudio e Vídeo", sales: "302 vendas", img: demoImages.projetor },
  { t: "Câmera de Segurança Wi-Fi 360°", p: "R$ 179,90", c: "Segurança", sales: "890 vendas", img: demoImages.camera },
];

export function SearchSection() {
  return (
    <section id="buscar" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Busca de anúncios"
          title="Encontre os melhores anúncios em segundos"
          subtitle="Pesquise por palavra-chave, categoria, ID, link ou vendedor com filtros avançados."
        />

        <Card className="mt-10 overflow-hidden border-border/60 bg-surface/60 p-0">
          <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
              <Search className="h-4 w-4 shrink-0" /> fone bluetooth
            </div>
            <div className="flex flex-wrap gap-2">
              {["Eletrônicos", "Frete grátis", "Mais vendidos", "Novo"].map((f) => (
                <span
                  key={f}
                  className="flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                >
                  <Filter className="h-3 w-3" /> {f}
                </span>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {searchResults.map((r, i) => (
              <div
                key={r.t}
                className="flex items-center gap-3 p-3 transition-colors hover:bg-background/40 sm:p-4"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <ProductThumb src={r.img} alt={r.t} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.t}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.c} · {r.sales}
                  </p>
                </div>
                <span className="hidden text-sm font-bold text-primary sm:block">{r.p}</span>
                <Button size="sm" variant="secondary" className="h-8 shrink-0 text-xs font-bold">
                  COPIAR
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border/60 p-3 text-xs text-muted-foreground">
            <span>Mostrando 4 de 47 resultados</span>
            <IllustrativeTag />
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* COPIA EM MASSA                                                             */
/* ------------------------------------------------------------------------ */

const copyResults = [
  { t: "Fone Bluetooth TWS Pro 5.3", p: "R$ 129,90", c: "Eletrônicos", id: "MLB1234567890", img: demoImages.fone },
  { t: "Suporte Articulado para Monitor", p: "R$ 89,00", c: "Informática", id: "MLB2233445566", img: demoImages.suporte },
  { t: "Mini Projetor Portátil Full HD", p: "R$ 549,90", c: "Áudio e Vídeo", id: "MLB9988776655", img: demoImages.projetor },
];

export function CopySection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Cópia em massa"
          title="Selecione vários anúncios e copie de uma vez"
          subtitle="Crie cópias editáveis na sua conta e otimize dezenas de anúncios em minutos."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
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
                  <ProductThumb src={r.img} alt={r.t} className="h-10 w-10" />
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

/* ------------------------------------------------------------------------ */
/* ANÚNCIO AI                                                                  */
/* ------------------------------------------------------------------------ */

function ScoreGauge({ value, label, tone }: { value: number; label: string; tone: "muted" | "primary" }) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-border/60" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-1000", tone === "primary" ? "stroke-primary" : "stroke-muted-foreground")}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn("font-display text-2xl font-extrabold", tone === "primary" && "text-primary")}>
          {value}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
    </div>
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
          <Card className="flex flex-col items-center border-border/60 bg-surface/60 p-6 text-center">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Antes</p>
            <ScoreGauge value={68} label="score" tone="muted" />
          </Card>
          <Card className="glass-panel flex flex-col items-center gap-3 p-6 text-center">
            <Sparkles className="h-6 w-6 animate-pulse text-primary" />
            <p className="font-display text-sm font-bold">IA ANALISANDO</p>
            <Progress value={72} className="h-2" />
            <ul className="space-y-1 text-left text-xs text-muted-foreground">
              <li>✓ Título otimizado com palavras-chave</li>
              <li>✓ Descrição reescrita e persuasiva</li>
              <li>✓ Atributos e ficha técnica completos</li>
              <li>✓ Sugestão de imagens e variações</li>
            </ul>
            <Button size="sm" className="mt-1 w-full font-semibold">
              Aplicar melhorias
            </Button>
          </Card>
          <Card className="flex flex-col items-center border-primary/40 bg-primary/10 p-6 text-center shadow-glow">
            <p className="mb-2 text-xs uppercase tracking-wider text-primary">Depois</p>
            <ScoreGauge value={94} label="score" tone="primary" />
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* EDITOR DE ANÚNCIOS                                                         */
/* ------------------------------------------------------------------------ */

export function EditorSection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Editor de anúncios"
          title="Edite tudo com pré-visualização em tempo real"
          subtitle="Título, descrição, preço, estoque, categoria, atributos e imagens em um só editor."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 border-border/60 bg-surface/60 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <PenSquare className="h-4 w-4 text-primary" /> FORMULÁRIO
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">Título</p>
              <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm">
                Fone Bluetooth TWS Pro 5.3 Cancelamento de Ruído
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">Descrição</p>
              <div className="h-16 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                Fone de ouvido sem fio com cancelamento ativo de ruído, bateria de longa duração...
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Preço</p>
                <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm font-semibold text-primary">
                  R$ 129,90
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Estoque</p>
                <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm">42 un.</div>
              </div>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/40 text-muted-foreground"
                >
                  <ImageIcon className="h-4 w-4" />
                </span>
              ))}
            </div>
            <Button size="sm" className="w-full font-semibold">
              Salvar e otimizar com IA
            </Button>
          </Card>

          <Card className="border-border/60 bg-surface/60 p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <ImageIcon className="h-4 w-4 text-secondary" /> PRÉ-VISUALIZAÇÃO
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-background/60">
              <img
                src={demoImages.fone}
                alt="Pré-visualização do anúncio de fone bluetooth (exemplo ilustrativo)"
                loading="lazy"
                decoding="async"
                width={512}
                height={512}
                className="h-40 w-full object-cover"
              />
              <div className="space-y-2 p-4">
                <p className="text-sm font-semibold">
                  Fone Bluetooth TWS Pro 5.3 Cancelamento de Ruído
                </p>
                <p className="font-display text-2xl font-extrabold text-primary">R$ 129,90</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="border-success/40 text-success">
                    Frete grátis
                  </Badge>
                  <Badge variant="outline" className="border-border/60 text-muted-foreground">
                    42 disponíveis
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* GESTÃO DE ANÚNCIOS                                                         */
/* ------------------------------------------------------------------------ */

const manageRows = [
  { t: "Fone Bluetooth TWS Pro", status: "Ativo", tone: "success", visits: 342, sales: 21, img: demoImages.fone },
  { t: "Suporte Articulado Monitor", status: "Otimizado", tone: "primary", visits: 128, sales: 9, img: demoImages.suporte },
  { t: "Mini Projetor 4K Portátil", status: "Rascunho", tone: "muted", visits: 0, sales: 0, img: demoImages.projetor },
  { t: "Câmera de Segurança 360°", status: "Pausado", tone: "warning", visits: 54, sales: 3, img: demoImages.camera },
];

export function ManageSection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Gestão de anúncios"
          title="Gerencie tudo em uma única tela"
          subtitle="Ative, pause, edite em massa e acompanhe status e desempenho de cada anúncio."
        />
        <Card className="mt-10 overflow-hidden border-border/60 bg-surface/60 p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
            <Checkbox checked className="pointer-events-none" />
            <span className="text-xs font-semibold text-muted-foreground">4 selecionados</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {["ATIVAR", "PAUSAR", "EDITAR EM MASSA", "EXCLUIR"].map((b) => (
                <span
                  key={b}
                  className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-[11px] font-semibold"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {manageRows.map((r) => (
              <div key={r.t} className="flex items-center gap-3 p-3">
                <Checkbox checked className="pointer-events-none" />
                <ProductThumb src={r.img} alt={r.t} className="h-9 w-9" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{r.t}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "hidden sm:inline-flex",
                    r.tone === "success" && "border-success/40 text-success",
                    r.tone === "primary" && "border-primary/40 text-primary",
                    r.tone === "warning" && "border-warning/40 text-warning",
                    r.tone === "muted" && "border-border/60 text-muted-foreground",
                  )}
                >
                  {r.status}
                </Badge>
                <span className="hidden w-20 text-right text-xs text-muted-foreground md:block">
                  {r.visits} visitas
                </span>
                <span className="w-16 text-right text-xs font-semibold text-primary">{r.sales} vendas</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* DASHBOARD                                                                   */
/* ------------------------------------------------------------------------ */

const dashboardHighlights = [
  { t: "Visão 360°", d: "Vendas, faturamento, lucro, estoque e alertas em tempo real.", icon: BarChart3 },
  { t: "Alertas inteligentes", d: "Avisos automáticos de estoque baixo e anúncios com problemas.", icon: Bell },
  { t: "Multi-conta", d: "Gerencie mais de uma conta do Mercado Livre no mesmo painel.", icon: Users },
];

export function DashboardSection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Dashboard"
          title="Um painel completo depois do login"
          subtitle="Dados reais aparecem quando sua conta do Mercado Livre estiver conectada."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <AppMockup />
          <div className="grid gap-3">
            {dashboardHighlights.map((m) => (
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

/* ------------------------------------------------------------------------ */
/* RELATÓRIOS                                                                  */
/* ------------------------------------------------------------------------ */

const reportBars = [42, 58, 35, 70, 64, 88, 76, 52, 68, 90, 74, 60];

export function ReportsSection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Relatórios"
          title="Relatórios visuais para decidir com dados"
          subtitle="Faturamento, margem, ticket médio e performance por categoria — exportável a qualquer momento."
        />
        <Card className="mt-10 border-border/60 bg-surface/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-primary" /> Faturamento mensal
            </div>
            <div className="flex gap-1.5">
              {["7d", "30d", "12m"].map((p, i) => (
                <span
                  key={p}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-semibold",
                    i === 2 ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground",
                  )}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-6 flex h-40 items-end gap-1.5 sm:gap-2.5">
            {reportBars.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-gradient-to-t from-primary/80 to-primary/30 transition-all duration-700 ease-out"
                style={{ height: `${v}%` }}
              />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 sm:grid-cols-4">
            {[
              { l: "Faturamento", v: "R$ 84.320" },
              { l: "Lucro líquido", v: "R$ 31.960" },
              { l: "Ticket médio", v: "R$ 96,40" },
              { l: "Margem média", v: "38%" },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</p>
                <p className="font-display text-lg font-bold">{s.v}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Valores meramente ilustrativos para fins de demonstração.
          </p>
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* VENDAS                                                                      */
/* ------------------------------------------------------------------------ */

const salesFunnel = [
  { l: "Pendente", v: 8, icon: ClipboardList },
  { l: "Pago", v: 34, icon: Wallet },
  { l: "Enviado", v: 27, icon: Truck },
  { l: "Entregue", v: 59, icon: PackageCheck },
];

export function SalesSection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Vendas"
          title="Acompanhe pedidos do início ao fim"
          subtitle="Funil de status, ticket médio, cancelamentos e filtros por período."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid grid-cols-2 gap-3">
            {salesFunnel.map((s) => (
              <Card key={s.l} className="border-border/60 bg-surface/60 p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <s.icon className="h-4 w-4" />
                </span>
                <p className="mt-3 font-display text-2xl font-extrabold">{s.v}</p>
                <p className="text-xs text-muted-foreground">{s.l}</p>
              </Card>
            ))}
          </div>
          <Card className="border-border/60 bg-surface/60 p-0">
            <div className="flex items-center gap-2 border-b border-border/60 p-3 text-xs font-semibold text-muted-foreground">
              <ShoppingCart className="h-4 w-4 text-primary" /> Pedidos recentes
            </div>
            <div className="divide-y divide-border/60 text-sm">
              {[
                { id: "#48291", c: "Fone Bluetooth TWS Pro", v: "R$ 129,90", s: "Entregue" },
                { id: "#48290", c: "Suporte Articulado Monitor", v: "R$ 89,00", s: "Enviado" },
                { id: "#48288", c: "Mini Projetor 4K", v: "R$ 549,90", s: "Pago" },
              ].map((o) => (
                <div key={o.id} className="flex items-center gap-3 p-3">
                  <span className="text-xs text-muted-foreground">{o.id}</span>
                  <span className="min-w-0 flex-1 truncate">{o.c}</span>
                  <span className="font-semibold text-primary">{o.v}</span>
                  <Badge variant="outline" className="border-border/60 text-muted-foreground">
                    {o.s}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* ESTOQUE                                                                     */
/* ------------------------------------------------------------------------ */

const inventoryRows = [
  { t: "Fone Bluetooth TWS Pro", qty: 42, pct: 84, tone: "success" },
  { t: "Suporte Articulado Monitor", qty: 6, pct: 20, tone: "warning" },
  { t: "Mini Projetor 4K Portátil", qty: 0, pct: 0, tone: "destructive" },
  { t: "Câmera de Segurança 360°", qty: 58, pct: 96, tone: "success" },
];

export function InventorySection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Estoque"
          title="Nunca mais venda sem estoque"
          subtitle="Alertas automáticos de estoque baixo e sem estoque, com histórico de movimentações."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="grid gap-3">
            {inventoryRows.map((r) => (
              <Card key={r.t} className="border-border/60 bg-surface/60 p-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium">{r.t}</p>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      r.tone === "success" && "text-success",
                      r.tone === "warning" && "text-warning",
                      r.tone === "destructive" && "text-destructive",
                    )}
                  >
                    {r.qty} un.
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-accent">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      r.tone === "success" && "bg-success",
                      r.tone === "warning" && "bg-warning",
                      r.tone === "destructive" && "bg-destructive",
                    )}
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>
          <Card className="flex flex-col gap-4 border-border/60 bg-surface/60 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-primary" /> Movimentações recentes
            </div>
            {[
              { t: "Entrada de estoque", d: "+50 unidades · Fone Bluetooth TWS", icon: Boxes },
              { t: "Alerta de estoque baixo", d: "Suporte Articulado Monitor · 6 un.", icon: AlertTriangle },
              { t: "Sem estoque", d: "Mini Projetor 4K Portátil", icon: Package },
            ].map((m) => (
              <div key={m.t} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/50 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground">
                  <m.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{m.t}</p>
                  <p className="text-xs text-muted-foreground">{m.d}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* BENEFÍCIOS                                                                  */
/* ------------------------------------------------------------------------ */

const benefits = [
  { t: "Economize horas por semana", d: "Automatize tarefas repetitivas de busca, cópia e cadastro.", icon: Zap },
  { t: "Reduza erros manuais", d: "Menos retrabalho em títulos, preços e atributos.", icon: Shield },
  { t: "Venda mais com anúncios melhores", d: "Otimização com IA aumenta a qualidade e o alcance.", icon: TrendingUp },
  { t: "Decisões com dados reais", d: "Relatórios claros para priorizar o que traz resultado.", icon: BarChart3 },
  { t: "Nunca fique sem estoque", d: "Alertas automáticos evitam vendas sem produto disponível.", icon: Boxes },
  { t: "Tudo em um só lugar", d: "Busca, cópia, IA, edição, vendas e estoque no mesmo painel.", icon: Layers },
];

export function BenefitsSection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow="Benefícios" title="Por que vendedores escolhem o ANÚNCIO ML" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <Card
              key={b.t}
              className="border-border/60 bg-surface/60 p-5 transition-all hover:-translate-y-1 hover:border-primary/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <b.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-sm font-bold">{b.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* GRADE DE RECURSOS                                                          */
/* ------------------------------------------------------------------------ */

const featureGrid = [
  { t: "Multiusuário", icon: Users },
  { t: "Notificações em tempo real", icon: Bell },
  { t: "Histórico completo", icon: History },
  { t: "Exportação de dados", icon: Database },
  { t: "API oficial Mercado Livre", icon: BadgeCheck },
  { t: "Central de ajuda", icon: Shield },
  { t: "Múltiplas contas ML", icon: Store },
  { t: "Backup automático", icon: Lock },
  { t: "Oportunidades de melhoria", icon: Flame },
  { t: "Gauge de performance", icon: Gauge },
];

export function FeaturesGridSection() {
  return (
    <section id="recursos" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow="Recursos" title="Tudo que você precisa, incluso na plataforma" />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {featureGrid.map((f) => (
            <div
              key={f.t}
              className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-surface/60 p-4 text-center transition-colors hover:border-primary/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
                <f.icon className="h-4 w-4" />
              </span>
              <p className="text-xs font-semibold leading-tight">{f.t}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* COMPARATIVO                                                                */
/* ------------------------------------------------------------------------ */

const comparisonRows = [
  { label: "Busca de anúncios concorrentes", manual: false, app: true },
  { label: "Cópia em massa de anúncios", manual: false, app: true },
  { label: "Otimização de título e descrição com IA", manual: false, app: true },
  { label: "Cadastro anúncio por anúncio", manual: true, app: false },
  { label: "Alertas automáticos de estoque", manual: false, app: true },
  { label: "Relatórios consolidados de vendas", manual: false, app: true },
  { label: "Tempo médio por anúncio", manual: true, app: true },
];

export function ComparisonSection() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4">
        <SectionTitle
          eyebrow="Comparativo"
          title="ANÚNCIO ML vs. processo manual"
          subtitle="Menos cliques, menos planilhas, menos retrabalho."
        />
        <Card className="mt-10 overflow-hidden border-border/60 bg-surface/60 p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border/60 bg-background/40 p-3 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:gap-4 sm:p-4">
            <span>Tarefa</span>
            <span className="w-20 text-center sm:w-28">Manual</span>
            <span className="w-20 text-center text-primary sm:w-28">ANÚNCIO ML</span>
          </div>
          <div className="divide-y divide-border/60">
            {comparisonRows.map((r) => (
              <div
                key={r.label}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 p-3 text-sm sm:gap-4 sm:p-4"
              >
                <span className="text-muted-foreground">{r.label}</span>
                <span className="flex w-20 justify-center sm:w-28">
                  {r.manual ? (
                    <Check className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <X className="h-4 w-4 text-destructive/70" />
                  )}
                </span>
                <span className="flex w-20 justify-center sm:w-28">
                  {r.app ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <X className="h-4 w-4 text-destructive/70" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* PLANOS                                                                      */
/* ------------------------------------------------------------------------ */

export function PricingSection() {
  const { data: plans, isLoading } = usePlans();
  const { data: periods } = usePeriods();
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const discount = periods?.find((p) => p.period === period) ?? periods?.[0];

  return (
    <section id="planos" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Planos"
          title="Escolha o plano e o período"
          subtitle="Comece pelo mensal, sem fidelidade. Se quiser economizar, escolha um período maior."
        />

        <div className="mx-auto mt-8 flex w-fit flex-wrap justify-center gap-1 rounded-xl border border-border/60 bg-surface/60 p-1">
          {(periods ?? []).map((p) => (
            <button
              key={p.period}
              onClick={() => setPeriod(p.period)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all",
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
        {period === "monthly" ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Sem fidelidade — cancele quando quiser.{" "}
            <span className="font-semibold text-primary">
              Prefere economizar? Escolha 3, 6 ou 12 meses.
            </span>
          </p>
        ) : (
          <p className="mt-3 text-center text-xs font-semibold text-primary">
            MELHOR CUSTO-BENEFÍCIO
          </p>
        )}


        <div
          key={period}
          className="mt-8 grid animate-in fade-in slide-in-from-bottom-2 gap-4 duration-300 md:grid-cols-2 xl:grid-cols-4"
        >
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
              const fullPrice = plan.price_monthly_cents * discount.months;
              const isBestValue = plan.highlighted;
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col border-border/60 bg-surface/60 p-5 transition-transform hover:-translate-y-1",
                    plan.highlighted && "border-primary/50 bg-primary/5 shadow-glow",
                  )}
                >
                  {plan.highlighted && (
                    <Badge className="mb-2 w-fit bg-primary text-primary-foreground">
                      ⭐ MAIS VENDIDO
                    </Badge>
                  )}
                  <p className="font-display text-sm font-extrabold tracking-wide">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">{plan.tagline}</p>

                  {savings > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground line-through">
                      {formatBRL(fullPrice)}
                    </p>
                  )}
                  <p className="font-display text-3xl font-extrabold">
                    {formatBRL(monthly)}
                    <span className="text-sm font-medium text-muted-foreground">/mês</span>
                  </p>
                  {discount.months > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {formatBRL(total)} por {discount.months} meses
                    </p>
                  )}
                  {savings > 0 && (
                    <p className="mt-1 text-xs font-semibold text-success">
                      Economize {Math.round((savings / fullPrice) * 100)}% ({formatBRL(savings)})
                    </p>
                  )}
                  {isBestValue && (
                    <p className="mt-1 text-[11px] font-semibold text-primary">Melhor custo-benefício</p>
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
                    <Link
                      to="/checkout"
                      search={{ plan: plan.code, period }}
                      onClick={() =>
                        trackEvent("view_plan", { plan_code: plan.code, period, amount_cents: total })
                      }
                    >
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

/* ------------------------------------------------------------------------ */
/* FAQ                                                                         */
/* ------------------------------------------------------------------------ */

const faq = [
  {
    q: "O ANÚNCIO ML é uma plataforma oficial do Mercado Livre?",
    a: "Não. Somos uma plataforma independente que utiliza apenas as APIs e integrações oficiais disponibilizadas publicamente pelo Mercado Livre e Mercado Pago. Você mantém o controle total da sua conta ML.",
  },
  {
    q: "Preciso ter uma conta no Mercado Livre para usar?",
    a: "Sim. A integração oficial exige uma conta ativa do Mercado Livre. Basta conectar sua conta com um clique e autorizar o acesso seguro. Se ainda não tiver, crie uma gratuitamente no site do ML.",
  },
  {
    q: "Como funciona o teste gratuito?",
    a: "Toda nova conta elegível recebe 10 anúncios gratuitos para testar busca, cópia e otimização com IA. Você não precisa de cartão para começar. Ao atingir o limite, basta escolher um plano.",
  },
  {
    q: "Como copiar um anúncio funciona na prática?",
    a: "A cópia gera um rascunho editável dentro da sua conta, com título, descrição, preço, estoque, categoria e imagens. Você revisa, otimiza com IA e só então publica — nada vai ao ar sem sua aprovação.",
  },
  {
    q: "A IA realmente melhora os resultados dos anúncios?",
    a: "A IA analisa títulos, descrições e palavras-chave de alta conversão para sugerir textos mais claros e vendedores. Vendedores relatam economia de horas e melhora na visibilidade dos anúncios.",
  },
  {
    q: "Meu plano é ativado automaticamente após o pagamento?",
    a: "Sim. A liberação acontece somente após a confirmação válida do pagamento pelo Mercado Pago, processada via webhook no nosso backend. Geralmente leva poucos minutos.",
  },
  {
    q: "Posso pagar por Pix ou WhatsApp?",
    a: "Sim. Nessa modalidade o administrador gera manualmente a sua licença e você a ativa na tela “Já tenho uma licença”. É ideal para quem prefere não usar cartão.",
  },
  {
    q: "Tem fidelidade ou multa por cancelar?",
    a: "No plano mensal não há fidelidade: você cancela quando quiser sem multa. Planos de 3, 6 ou 12 meses oferecem desconto por compromisso, mas ainda podem ser cancelados sem cobranças extras.",
  },
  {
    q: "Meus dados são apagados se o plano expirar?",
    a: "Não. Recursos premium ficam bloqueados, mas seus anúncios, rascunhos e dados permanecem salvos aguardando a renovação. Você nunca perde o que construiu.",
  },
  {
    q: "É seguro conectar minha conta do Mercado Livre?",
    a: "Sim. Usamos o OAuth oficial do Mercado Livre, com tokens criptografados e escopos limitados. Não armazenamos sua senha do ML e você pode revogar o acesso a qualquer momento.",
  },
  {
    q: "Tem suporte se eu travar em alguma etapa?",
    a: "Sim. Oferecemos suporte humano via WhatsApp e e-mail. Nosso time ajuda desde a conexão da conta até a publicação do primeiro anúncio.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4">
        <SectionTitle
          eyebrow="FAQ"
          title="Tire suas dúvidas antes de começar"
          subtitle="Respostas diretas para as principais objeções de quem quer vender mais no Mercado Livre."
        />

        <Card className="mt-10 border-border/60 bg-surface/40 p-1">
          <Accordion type="single" collapsible className="divide-y divide-border/60">
            {faq.map((item) => (
              <AccordionItem key={item.q} value={item.q} className="border-0 px-4 py-1">
                <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:no-underline sm:text-base">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Ficou alguma dúvida? Fale com nosso time no WhatsApp:{" "}
          <a
            href="https://wa.me/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            atendimento ANÚNCIO ML
          </a>
        </p>

      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* DEPOIMENTOS / PROVA SOCIAL                                                */
/* ------------------------------------------------------------------------ */

const testimonials = [
  {
    quote:
      "Em 3 semanas consegui publicar 47 anúncios sem escrever nenhum título do zero. A IA economiza horas do meu dia.",
    name: "Ricardo L.",
    role: "Vendedor de eletrônicos, SP",
    rating: 5,
    result: "+R$ 12k/mês",
  },
  {
    quote:
      "O radar me mostrou produtos que eu nem imaginava que vendiam tanto. Hoje 60% do meu faturamento vem dessas oportunidades.",
    name: "Mariana F.",
    role: "Loja de acessórios, MG",
    rating: 5,
    result: "+340% de lucro",
  },
  {
    quote:
      "Antes demorava 2 dias para replicar um anúncio. Agora faço isso em minutos e ainda otimizo a descrição com um clique.",
    name: "João P.",
    role: "Dropshipping, RS",
    rating: 5,
    result: "10x mais rápido",
  },
];

export function TestimonialsSection() {
  return (
    <section className="border-b border-border/60 bg-surface/30 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Prova social"
          title="Vendedores que já estão vendendo mais"
          subtitle="Resultados reais de quem usa a plataforma para escalar no Mercado Livre."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <Card
              key={t.name}
              className="relative flex flex-col border-border/60 bg-background/60 p-6 transition-transform hover:-translate-y-1"
            >
              <Quote className="absolute right-4 top-4 h-6 w-6 text-primary/20" />
              <StarRating value={t.rating} />
              <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
                “{t.quote}”
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-border/60 pt-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                  {t.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.role}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px] font-bold">
                  {t.result}
                </Badge>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-background/40 p-6 sm:flex-row sm:gap-8">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {testimonialAvatars.map((a, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 border-background text-[11px] font-bold",
                    a.color,
                  )}
                >
                  {a.initials}
                </span>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <StarRating value={5} />
                <span className="text-sm font-bold">4.9/5</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Baseado em 127 avaliações</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground sm:gap-6">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-success" /> Pagamento seguro
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-success" /> Ativação imediata
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4 text-success" /> 7 dias de garantia
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* CTA FINAL                                                                   */
/* ------------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------------ */
/* RODAPÉ                                                                      */
/* ------------------------------------------------------------------------ */

const footerColumns = [
  {
    title: "Produto",
    links: [
      { label: "Demonstração", href: "#demo" },
      { label: "Como funciona", href: "#como-funciona" },
      { label: "ANÚNCIO AI", href: "#ia" },
      { label: "Recursos", href: "#recursos" },
      { label: "Planos", href: "#planos" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Entrar", to: "/auth" },
      { label: "Criar conta", to: "/auth" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">{SLOGAN}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              ANÚNCIO ML é uma plataforma independente e não possui vínculo oficial com o Mercado
              Livre.
            </p>
          </div>
          {footerColumns.map((col) => (
            <div key={col.title}>
              <p className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) =>
                  "href" in l ? (
                    <li key={l.label}>
                      <a href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link to={l.to} className="text-muted-foreground transition-colors hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} ANÚNCIO ML. Todos os direitos reservados.</p>
          <p>Integrações oficiais Mercado Livre e Mercado Pago.</p>
        </div>
      </div>
    </footer>
  );
}
