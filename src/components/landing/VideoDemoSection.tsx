import { CheckCircle2, Copy, Search, Sparkles, Upload, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { AppMockup } from "@/components/landing/AppMockup";
import { SectionTitle } from "@/components/landing/sections";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TOUR_STEPS = [
  {
    icon: Search,
    title: "Busque anúncios no Mercado Livre",
    text: "Pesquise por palavra-chave, produto, ID, link ou vendedor dentro da própria plataforma.",
  },
  {
    icon: Copy,
    title: "Copie a estrutura em poucos cliques",
    text: "Traga imagens, atributos, categoria, preço e informações úteis para criar um rascunho.",
  },
  {
    icon: Sparkles,
    title: "Otimize antes de publicar",
    text: "Use o ANÚNCIO AI para revisar título, descrição e qualidade do anúncio quando quiser.",
  },
  {
    icon: Upload,
    title: "Publique na sua conta conectada",
    text: "Depois de revisar, envie o anúncio para a conta do Mercado Livre autorizada via OAuth.",
  },
  {
    icon: Zap,
    title: "Gerencie tudo no mesmo painel",
    text: "Acompanhe anúncios, estoque, vendas, relatórios, licença e integrações em um único lugar.",
  },
] as const;

/**
 * Tour visual fiel ao produto atual. Evita usar um vídeo gerado ou uma interface
 * que não existe no ANÚNCIO ML. Quando houver um screencast real da versão
 * publicada, ele pode substituir este tour sem alterar o restante da landing.
 */
export function VideoDemoSection() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % TOUR_STEPS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const current = TOUR_STEPS[activeStep]!;
  const CurrentIcon = current.icon;

  return (
    <section id="video-demo" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Demonstração real"
          title="Veja como o ANÚNCIO ML funciona"
          subtitle="Este tour usa a estrutura visual e os recursos do produto atual — sem telas em inglês, nomes inventados ou funcionalidades que não existem."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
          <div className="relative">
            <div aria-hidden className="absolute -inset-6 rounded-3xl bg-primary/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-2 shadow-2xl shadow-black/20 sm:p-3">
              <div className="mb-2 flex items-center justify-between gap-3 px-2 py-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Interface demonstrativa do produto
                </Badge>
              </div>
              <AppMockup />

              <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-xl backdrop-blur sm:inset-x-auto sm:bottom-7 sm:left-7 sm:max-w-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <CurrentIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{current.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {current.text}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {TOUR_STEPS.map((step, index) => {
              const Icon = step.icon;
              const active = index === activeStep;
              return (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                    active
                      ? "border-primary/40 bg-primary/10 shadow-sm"
                      : "border-border/60 bg-card/50 hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{step.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {step.text}
                    </span>
                  </span>
                  {active && <CheckCircle2 className="ml-auto mt-1 h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Demonstração do fluxo atual. Os dados visuais exibidos no mockup são ilustrativos e não representam vendas reais.
        </p>
      </div>
    </section>
  );
}
