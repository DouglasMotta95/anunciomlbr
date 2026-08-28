import { Quote, ShoppingBag, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    role: "Moda e acessórios",
    text: "Centralizar pesquisa, cópia e otimização em um só lugar deixa a rotina de anúncios muito mais simples.",
  },
  {
    role: "Casa e decoração",
    text: "Revisar títulos, descrições e imagens com IA antes de publicar ajuda a ganhar velocidade sem perder controle.",
  },
  {
    role: "Eletrônicos",
    text: "Ter um painel para acompanhar anúncios, oportunidades e publicação reduz bastante o trabalho manual do dia a dia.",
  },
];

const activity = [
  "Um vendedor de moda acabou de assinar o plano Pro",
  "Alguém de São Paulo otimizou 12 anúncios com IA agora há pouco",
  "Um novo vendedor entrou no plano Premium",
  "Um lojista de eletrônicos criou novos anúncios para sua operação",
  "Um vendedor otimizou títulos e descrições com IA",
  "Uma nova conta do Mercado Livre foi conectada à plataforma",
];

export function IllustrativeSocialProof() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let transitionTimer: number | undefined;
    const first = window.setTimeout(() => setVisible(true), 4200);
    const timer = window.setInterval(() => {
      setVisible(false);
      transitionTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % activity.length);
        setVisible(true);
      }, 350);
    }, 9500);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      if (transitionTimer) window.clearTimeout(transitionTimer);
    };
  }, []);

  const current = activity[index] ?? activity[0]!;

  return (
    <section className="relative border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            EXEMPLOS DE USO
          </Badge>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-4xl">
            Como a plataforma pode entrar na rotina do vendedor
          </h2>
          <p className="mt-3 text-pretty leading-7 text-muted-foreground">
            Cenários ilustrativos para mostrar como o ANÚNCIO ML pode ser usado na prática, até termos avaliações reais e autorizadas de clientes.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {testimonials.map((item) => (
            <Card key={item.role} className="border-border/60 bg-surface/40">
              <CardContent className="pt-6">
                <Quote className="h-5 w-5 text-primary" aria-hidden="true" />
                <p className="mt-4 text-sm leading-6">“{item.text}”</p>
                <div className="mt-5 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Exemplo de uso · {item.role}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground/70">
          Exemplos ilustrativos. Estes textos não representam depoimentos reais e serão substituídos por avaliações de clientes quando houver autorização para publicação.
        </p>
      </div>

      <div
        className={`pointer-events-none fixed bottom-24 left-3 z-30 w-[min(350px,calc(100vw-24px))] transition-all duration-300 md:bottom-6 md:left-6 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
        aria-live="polite"
        aria-atomic="true"
      >
        <Card className="overflow-hidden border-primary/25 bg-background/96 shadow-2xl backdrop-blur-xl">
          <div className="h-1 bg-primary" />
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Atividade ilustrativa
                </span>
                <p className="mt-1 text-sm font-semibold leading-5">{current}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Exemplo demonstrativo · não representa evento em tempo real.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
