import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, Bot, CircleDollarSign, Gauge, HeartPulse, Radar, ShieldCheck, Sparkles, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const slides = [
  { id: "dashboard", title: "Dashboard", benefit: "Entenda a operação em poucos segundos.", icon: Gauge },
  { id: "opportunities", title: "Central de Oportunidades", benefit: "Descubra o que merece ação primeiro.", icon: Target },
  { id: "market", title: "Pesquisa de Mercado", benefit: "Compare referências antes de decidir.", icon: BarChart3 },
  { id: "competition", title: "Radar de Concorrentes", benefit: "Acompanhe mudanças com contexto.", icon: Radar },
  { id: "pricing", title: "Precificação", benefit: "Simule margem antes de alterar preço.", icon: CircleDollarSign },
  { id: "health", title: "Raio-X", benefit: "Encontre pontos concretos para melhorar.", icon: HeartPulse },
  { id: "automation", title: "Automação", benefit: "Avalie regras com guardrails antes de executar.", icon: Bot },
] as const;

export function ProductScreensCarousel() {
  const [index, setIndex] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (interacted || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 5200);
    return () => window.clearInterval(timer);
  }, [interacted]);

  const active = slides[index] ?? slides[0];
  const go = (next: number) => {
    setInteracted(true);
    setIndex((next + slides.length) % slides.length);
  };

  return (
    <section id="telas-produto" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> TOUR VISUAL</Badge>
            <h2 className="mt-4 text-balance text-3xl font-black sm:text-5xl">Passe pelas principais telas do ANÚNCIO ML.</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Uma apresentação visual do produto para você entender como as áreas se conectam. Todos os números exibidos aqui são demonstrativos.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="icon" aria-label="Slide anterior" onClick={() => go(index - 1)}><ArrowLeft className="h-4 w-4" /></Button>
            <Button type="button" variant="outline" size="icon" aria-label="Próximo slide" onClick={() => go(index + 1)}><ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div
          className="mt-9 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[var(--shadow-panel)]"
          onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const end = event.changedTouches[0]?.clientX;
            touchStart.current = null;
            if (start == null || end == null) return;
            const distance = end - start;
            if (Math.abs(distance) < 45) return;
            go(distance < 0 ? index + 1 : index - 1);
          }}
        >
          <div key={active.id} className="grid animate-in fade-in slide-in-from-right-3 duration-500 lg:grid-cols-[.34fr_.66fr]">
            <div className="border-b border-border/70 bg-surface/30 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><active.icon className="h-5 w-5" /></div>
              <p className="mt-6 text-xs font-extrabold uppercase tracking-[.16em] text-primary">Slide {String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 text-2xl font-black sm:text-3xl">{active.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{active.benefit}</p>
              <div className="mt-6 flex flex-wrap gap-1.5">{slides.map((slide, itemIndex) => <button key={slide.id} type="button" aria-label={`Abrir ${slide.title}`} onClick={() => go(itemIndex)} className={`h-1.5 rounded-full transition-all duration-300 ${itemIndex === index ? "w-8 bg-primary" : "w-3 bg-muted"}`} />)}</div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Dados ilustrativos</p>
            </div>
            <div className="p-5 sm:p-7"><SlidePreview id={active.id} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SlidePreview({ id }: { id: (typeof slides)[number]["id"] }) {
  if (id === "dashboard") return <div className="grid gap-3 sm:grid-cols-2"><Panel title="Receita · 30 dias" value="R$ 28,4 mil" /><Panel title="Saúde operacional" value="91/100" /><div className="sm:col-span-2 rounded-2xl border p-5"><p className="text-sm font-black">Desempenho</p><div className="mt-7 flex h-40 items-end gap-2">{[28,42,36,55,48,66,61,75,72,86,82,94].map((height,i)=><span key={i} className="flex-1 rounded-t bg-primary/25" style={{height:`${height}%`}} />)}</div></div></div>;
  if (id === "opportunities") return <div className="space-y-3">{["Margem abaixo da meta","Estoque crítico","Anúncio com cadastro incompleto"].map((text,i)=><div key={text} className="flex items-center gap-3 rounded-2xl border p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">0{i+1}</span><div className="flex-1"><p className="text-sm font-black">{text}</p><p className="text-xs text-muted-foreground">Exemplo de oportunidade operacional.</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>)}</div>;
  if (id === "market") return <div><div className="grid gap-3 sm:grid-cols-3"><Panel title="Preço mínimo" value="R$ 109" /><Panel title="Mediana" value="R$ 124" /><Panel title="Preço máximo" value="R$ 149" /></div><div className="mt-4 rounded-2xl border p-5"><div className="flex items-center gap-2 text-sm font-black"><BarChart3 className="h-4 w-4 text-primary" />Faixa de mercado</div><div className="mt-6 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full w-[62%] rounded-full bg-primary" /></div></div></div>;
  if (id === "competition") return <div className="space-y-4">{[["Sua oferta",72],["Concorrente A",88],["Concorrente B",61]].map(([label,value])=><div key={String(label)} className="rounded-2xl border p-4"><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">{label}</span><span>{value}%</span></div><Progress value={Number(value)} /></div>)}</div>;
  if (id === "pricing") return <div className="grid gap-3 sm:grid-cols-3"><Panel title="Preço simulado" value="R$ 129,90" /><Panel title="Margem" value="24,6%" /><Panel title="Resultado/unidade" value="R$ 31,95" /></div>;
  if (id === "health") return <div className="grid gap-4 lg:grid-cols-[.4fr_.6fr]"><div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border bg-primary/[.05]"><HeartPulse className="h-6 w-6 text-primary" /><p className="mt-4 text-5xl font-black">85</p><p className="text-xs text-muted-foreground">score demonstrativo</p></div><div className="space-y-4 rounded-2xl border p-5">{[["Título",92],["Cadastro",84],["Apresentação",76],["Consistência",88]].map(([label,value])=><div key={String(label)}><div className="mb-1 flex justify-between text-xs"><span>{label}</span><span>{value}/100</span></div><Progress value={Number(value)} /></div>)}</div></div>;
  return <div className="grid gap-3 sm:grid-cols-2">{["Estoque baixo","Margem baixa","Saúde do anúncio","Mudança de concorrente"].map((title)=><div key={title} className="rounded-2xl border p-4"><div className="flex items-center justify-between"><Bot className="h-5 w-5 text-primary" /><Badge variant="outline">Dry-run</Badge></div><p className="mt-4 text-sm font-black">{title}</p><p className="mt-1 text-xs text-muted-foreground">Regra demonstrativa sem ação externa nesta vitrine.</p></div>)}</div>;
}

function Panel({ title, value }: { title: string; value: string }) { return <div className="rounded-2xl border bg-background p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p><ShieldCheck className="h-3.5 w-3.5 text-primary" /></div><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">dado demonstrativo</p></div>; }
