import { BarChart3, Copy, PackageSearch, PlayCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { demoImages } from "@/components/landing/demo-media";
import { SectionTitle } from "@/components/landing/sections";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const demoSteps = [
  {
    title: "Busque o anúncio",
    text: "Pesquise por palavra-chave, produto, ID, link ou vendedor e visualize os resultados no painel.",
    icon: PackageSearch,
    seek: 0.03,
    image: demoImages.fone,
    tag: "Buscar",
  },
  {
    title: "Copie e prepare",
    text: "Traga a estrutura do anúncio, mantenha imagens e atributos e transforme o resultado em um rascunho editável.",
    icon: Copy,
    seek: 0.3,
    image: demoImages.suporte,
    tag: "Copiar",
  },
  {
    title: "Otimize com IA",
    text: "Revise título, descrição e qualidade usando a IA diretamente dentro do fluxo do anúncio.",
    icon: Sparkles,
    seek: 0.58,
    image: demoImages.projetor,
    tag: "Otimizar",
  },
  {
    title: "Acompanhe a operação",
    text: "Volte ao painel para acompanhar anúncios, utilização do plano e dados sincronizados da conta.",
    icon: BarChart3,
    seek: 0.82,
    image: demoImages.camera,
    tag: "Acompanhar",
  },
];

export function VideoDemoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const [duration, setDuration] = useState(0);
  const [manualPause, setManualPause] = useState(false);

  const seekToStep = (index: number) => {
    setActive(index);
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    video.currentTime = Math.max(0, Math.min(video.duration - 0.2, video.duration * demoSteps[index]!.seek));
    if (!manualPause) void video.play().catch(() => undefined);
  };

  useEffect(() => {
    if (manualPause) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % demoSteps.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [manualPause]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = Math.max(0, Math.min(duration - 0.2, duration * demoSteps[active]!.seek));
    if (!manualPause) void video.play().catch(() => undefined);
  }, [active, duration, manualPause]);

  const current = demoSteps[active]!;

  return (
    <section id="demo" className="border-b border-border/60 py-16 sm:py-24">
      <div id="ia" className="scroll-mt-24" />
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle
          eyebrow="Demonstração guiada"
          title="Veja cada etapa e acompanhe a tela mudando junto"
          subtitle="A demonstração avança automaticamente. Você também pode tocar em qualquer etapa para ir direto ao trecho correspondente."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-[.82fr_1.18fr] lg:items-stretch">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {demoSteps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                onClick={() => seekToStep(index)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300",
                  active === index
                    ? "-translate-y-0.5 border-primary/50 bg-primary/10 shadow-lg shadow-primary/5"
                    : "border-border/60 bg-card/50 hover:border-primary/25 hover:bg-card",
                )}
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background">
                  <img src={step.image} alt="" aria-hidden className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                    <step.icon className="h-3.5 w-3.5" /> {step.tag}
                  </span>
                  <span className="mt-1 block text-sm font-extrabold text-foreground">{step.title}</span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">{step.text}</span>
                </span>
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full transition-all", active === index ? "scale-125 bg-primary shadow-[0_0_14px_hsl(var(--primary)/.65)]" : "bg-border")} />
              </button>
            ))}
          </div>

          <div className="relative min-h-[340px] overflow-hidden rounded-[2rem] border border-primary/20 bg-card p-2 shadow-2xl shadow-black/20 sm:p-3">
            <div aria-hidden className="absolute inset-x-10 -top-16 h-32 rounded-full bg-primary/15 blur-3xl" />
            <div className="relative mb-2 flex items-center justify-between gap-3 px-2 py-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              </div>
              <Badge variant="outline" className="text-[10px]"><PlayCircle className="mr-1 h-3 w-3" />{current.tag}</Badge>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                className="aspect-video w-full bg-black object-cover"
                src="/videos/platform-demo.webm"
                controls
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                onPause={() => setManualPause(true)}
                onPlay={() => setManualPause(false)}
              />
              <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-black/70 p-3 text-white backdrop-blur-md sm:inset-x-4 sm:bottom-4 sm:p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Etapa {active + 1} de {demoSteps.length}</p>
                <p className="mt-1 text-sm font-extrabold sm:text-base">{current.title}</p>
                <p className="mt-1 hidden text-xs leading-5 text-white/70 sm:block">{current.text}</p>
              </div>
            </div>

            <div className="relative mt-3 grid grid-cols-4 gap-1.5 px-1 pb-1">
              {demoSteps.map((step, index) => (
                <button
                  key={step.tag}
                  type="button"
                  aria-label={`Ir para ${step.title}`}
                  onClick={() => seekToStep(index)}
                  className={cn("h-1.5 overflow-hidden rounded-full bg-border/70 transition-all", active === index && "bg-primary")}
                >
                  <span className="sr-only">{step.tag}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
