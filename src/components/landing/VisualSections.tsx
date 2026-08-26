import { ArrowRight, Copy, Rocket, Sparkles, Star, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ProductThumb, demoImages } from "@/components/landing/demo-media";
import { CountUp, Reveal } from "@/components/landing/Reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const DEMO_NOTE = "exemplo ilustrativo";

function Eyebrow({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* RADAR DE PRODUTOS — cards com imagem                                */
/* ------------------------------------------------------------------ */

const radarProducts = [
  {
    t: "Fone Bluetooth TWS Pro 5.3",
    p: "R$ 129,90",
    old: "R$ 189,90",
    rel: 96,
    sales: "1,2 mil vendidos",
    profit: "lucro estimado R$ 42/un",
    tag: "MAIS VENDIDO",
    img: demoImages.fone,
  },
  {
    t: "Suporte Articulado Monitor",
    p: "R$ 89,00",
    old: "R$ 119,00",
    rel: 91,
    sales: "870 vendidos",
    profit: "lucro estimado R$ 28/un",
    tag: "ALTO GIRO",
    img: demoImages.suporte,
  },
  {
    t: "Mini Projetor Full HD",
    p: "R$ 549,90",
    old: "R$ 699,90",
    rel: 88,
    sales: "410 vendidos",
    profit: "lucro estimado R$ 155/un",
    tag: "TICKET ALTO",
    img: demoImages.projetor,
  },
  {
    t: "Câmera Wi-Fi 360°",
    p: "R$ 179,90",
    old: "R$ 229,90",
    rel: 84,
    sales: "630 vendidos",
    profit: "lucro estimado R$ 51/un",
    tag: "TENDÊNCIA",
    img: demoImages.camera,
  },
];


export function RadarSection() {
  const [scan, setScan] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setScan((s) => (s + 1) % radarProducts.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Radar de oportunidades</Eyebrow>
          <h2 className="mt-4 text-balance text-3xl font-extrabold sm:text-4xl">
            O radar encontra os anúncios que valem copiar
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            Produtos com boa relevância, preço e giro — prontos para duplicar e otimizar.
          </p>
        </Reveal>

        <Reveal className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            varredura ativa
          </span>
          <span className="rounded-full border border-border/60 bg-surface/60 px-3 py-1.5">
            <CountUp to={47} /> anúncios encontrados
          </span>
          <span className="rounded-full border border-border/60 bg-surface/60 px-3 py-1.5">{DEMO_NOTE}</span>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {radarProducts.map((p, i) => (
            <Reveal key={p.t} delay={i * 90}>
              <Card
                className={cn(
                  "group h-full overflow-hidden border-border/60 bg-surface/60 p-0 transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-glow",
                  scan === i && "border-primary/50 shadow-glow",
                )}
              >
                <div className="relative aspect-square overflow-hidden bg-background">
                  <img
                    src={p.img}
                    alt={p.t}
                    loading="lazy"
                    decoding="async"
                    width={512}
                    height={512}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <Badge className="absolute left-2 top-2 bg-background/80 text-[10px] font-bold text-primary backdrop-blur">
                    {p.rel}% relevância
                  </Badge>
                  <Badge className="absolute right-2 top-2 bg-primary text-[10px] font-extrabold text-primary-foreground">
                    {p.tag}
                  </Badge>
                  <span className="absolute bottom-2 left-2 rounded-full bg-success/90 px-2 py-0.5 text-[10px] font-bold text-background">
                    FRETE GRÁTIS
                  </span>
                </div>
                <div className="space-y-2 p-4">
                  <p className="line-clamp-2 min-h-10 text-sm font-semibold">{p.t}</p>
                  <div className="flex items-end gap-2">
                    <p className="font-display text-lg font-extrabold text-primary">{p.p}</p>
                    <p className="text-xs text-muted-foreground line-through">{p.old}</p>
                  </div>
                  <p className="text-[11px] font-semibold text-success">{p.profit}</p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    {[0, 1, 2, 3].map((s) => (
                      <Star key={s} className="h-3 w-3 fill-primary text-primary" />
                    ))}
                    <span className="ml-1">4.8 · {p.sales}</span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="h-8 flex-1 text-[11px] font-bold active:scale-95">
                      <Copy className="mr-1 h-3 w-3" /> DUPLICAR
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 text-[11px] font-bold active:scale-95"
                    >
                      <Sparkles className="mr-1 h-3 w-3" /> IA
                    </Button>
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* DUPLICAÇÃO — fluxo visual                                           */
/* ------------------------------------------------------------------ */

const flowSteps = [
  { t: "ANÚNCIO ORIGINAL", d: "MLB1234567890", img: demoImages.fone, badge: "Original" },
  { t: "CÓPIA EDITÁVEL", d: "Rascunho na sua conta", img: demoImages.fone, badge: "Duplicado" },
  { t: "IA OTIMIZANDO", d: "Título, descrição e atributos", img: demoImages.estudioDepois, badge: "Score 94" },
  { t: "PUBLICADO", d: "Integração oficial ML", img: demoImages.estudioDepois, badge: "Ativo" },
];

export function DuplicationFlowSection() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % flowSteps.length), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="border-b border-border/60 bg-surface/30 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Duplicação inteligente</Eyebrow>
          <h2 className="mt-4 text-balance text-3xl font-extrabold sm:text-4xl">
            Do anúncio original ao publicado, em um fluxo só
          </h2>
        </Reveal>

        <div className="mt-10 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {flowSteps.map((s, i) => (
            <Reveal key={s.t} delay={i * 100} className="h-full">
              <Card
                className={cn(
                  "relative h-full border-border/60 bg-background/60 p-4 transition-all duration-500",
                  active === i ? "-translate-y-1 border-primary/50 shadow-glow" : "opacity-90",
                )}
              >
                <div className="flex items-center gap-3">
                  <ProductThumb src={s.img} alt={s.t} className="h-14 w-14" />
                  <div className="min-w-0">
                    <p className="font-display text-xs font-bold tracking-wide">{s.t}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{s.d}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="mt-3 border-primary/40 text-[10px] font-bold text-primary"
                >
                  {s.badge}
                </Badge>
                {i < flowSteps.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-primary/50 lg:block" />
                )}
              </Card>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] uppercase tracking-wider text-muted-foreground/70">
          {DEMO_NOTE}
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* IA — títulos gerados                                                */
/* ------------------------------------------------------------------ */

const aiTitles = [
  { t: "Fone Bluetooth TWS Pro 5.3 Cancelamento de Ruído Ativo 40h", score: 96 },
  { t: "Fone de Ouvido Bluetooth 5.3 ANC Estojo de Carga Rápida", score: 93 },
  { t: "Fone TWS Pro Sem Fio À Prova de Suor IPX5 Bateria 40h", score: 91 },
  { t: "Fone Bluetooth Esportivo TWS Pro Grave Potente + Case", score: 88 },
  { t: "Fone Sem Fio TWS Pro 5.3 Microfone Embutido Original", score: 85 },
];

export function AiTitlesSection() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setShown((s) => (s >= aiTitles.length ? 0 : s + 1)), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="ia" className="border-b border-border/60 py-16 sm:py-24">

      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>ANÚNCIO AI</Eyebrow>
          <h2 className="mt-4 text-balance text-3xl font-extrabold sm:text-4xl">
            Cinco títulos otimizados em segundos
          </h2>
        </Reveal>

        <Reveal className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="min-w-0 border-border/60 bg-surface/60 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Wand2 className="h-4 w-4 text-primary" /> GERAÇÃO DE TÍTULOS
            </div>
            <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Título original
              </p>
              <p className="text-sm">fone bluetooth sem fio bom barato</p>
            </div>
            <div className="mt-3 space-y-2">
              {aiTitles.map((a, i) => (
                <div
                  key={a.t}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 p-2.5 transition-all duration-500",
                    i < shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                  )}
                >
                  <span className="font-display text-xs font-bold text-primary">0{i + 1}</span>
                  <p className="min-w-0 flex-1 truncate text-xs">{a.t}</p>
                  <Badge variant="outline" className="border-success/40 text-[10px] text-success">
                    {a.score}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5">
              <Progress value={(shown / aiTitles.length) * 100} className="h-1.5" />
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 animate-pulse text-primary" /> IA processando ·{" "}
                {DEMO_NOTE}
              </p>
            </div>
          </Card>

          <Card className="min-w-0 border-primary/30 bg-primary/5 p-5">
            <p className="text-xs font-semibold text-muted-foreground">DESCRIÇÃO OTIMIZADA</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">
                Fone Bluetooth TWS Pro 5.3 com cancelamento ativo de ruído
              </p>
              <p>
                Som equilibrado, graves potentes e chamadas nítidas com microfone duplo. Bateria de
                até 40h com o estojo, conexão instantânea e resistência a suor IPX5.
              </p>
              <ul className="space-y-1 text-xs">
                <li>✓ Ficha técnica completa preenchida</li>
                <li>✓ Palavras-chave de busca aplicadas</li>
                <li>✓ Variações de cor sugeridas</li>
              </ul>
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-primary/30 bg-background/60 p-3">
              <div className="font-display text-3xl font-extrabold text-primary">
                <CountUp to={94} />
              </div>
              <p className="text-xs text-muted-foreground">
                score de otimização
                <br />
                <span className="text-success">+26 pontos vs. original</span>
              </p>
            </div>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* ESTÚDIO CRIATIVO — antes/depois                                     */
/* ------------------------------------------------------------------ */

const studioActions = [
  "Remover fundo",
  "Novo cenário",
  "Melhorar imagem",
  "Imagem promocional",
  "Lifestyle",
];

export function StudioSection() {
  const [after, setAfter] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setAfter((a) => !a), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="border-b border-border/60 bg-surface/30 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Estúdio criativo</Eyebrow>
          <h2 className="mt-4 text-balance text-3xl font-extrabold sm:text-4xl">
            Foto de celular vira imagem profissional
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            Remova o fundo, troque o cenário e gere imagens de marketplace prontas para anunciar.
          </p>
        </Reveal>

        <Reveal className="mt-10 grid grid-cols-1 items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <Card className="overflow-hidden border-border/60 bg-background/60 p-0">
            <div className="flex items-center justify-between px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Antes</span>
              <span>{DEMO_NOTE}</span>
            </div>
            <img
              src={demoImages.estudioAntes}
              alt="Foto amadora do produto antes do tratamento (exemplo ilustrativo)"
              loading="lazy"
              decoding="async"
              width={512}
              height={512}
              className="aspect-square w-full object-cover"
            />
          </Card>

          <div className="flex flex-col items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
              <Sparkles className={cn("h-5 w-5", after && "animate-pulse")} />
            </span>
            <ArrowRight className="h-5 w-5 rotate-90 text-primary/60 lg:rotate-0" />
          </div>

          <Card
            className={cn(
              "overflow-hidden border-primary/40 bg-background/60 p-0 transition-all duration-700",
              after ? "opacity-100 shadow-glow" : "opacity-80",
            )}
          >
            <div className="flex items-center justify-between px-4 py-2 text-[11px] uppercase tracking-wider text-primary">
              <span>Depois</span>
              <span className="text-muted-foreground">gerado com IA</span>
            </div>
            <img
              src={demoImages.estudioDepois}
              alt="Imagem profissional do produto gerada pelo estúdio criativo (exemplo ilustrativo)"
              loading="lazy"
              decoding="async"
              width={512}
              height={512}
              className="aspect-square w-full object-cover"
            />
          </Card>
        </Reveal>

        <Reveal className="mt-6 flex flex-wrap justify-center gap-2">
          {studioActions.map((a, i) => (
            <span
              key={a}
              className={cn(
                "cursor-default rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-[11px] font-semibold transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary",
                i === 0 && "border-primary/50 text-primary",
              )}
            >
              {a}
            </span>
          ))}
        </Reveal>

        <Reveal className="mt-8 flex justify-center">
          <Button size="lg" className="font-semibold shadow-glow active:scale-95">
            <Rocket className="mr-1.5 h-4 w-4" /> Criar imagens agora
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
