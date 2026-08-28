import { Quote, ShoppingBag, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  { name: "Marcos R.", role: "Vendedor de eletrônicos", text: "O fluxo de copiar, revisar e otimizar anúncios deixa a operação muito mais organizada." },
  { name: "Ana P.", role: "Loja de utilidades", text: "Ter anúncios, perguntas e otimização no mesmo painel facilita bastante a rotina." },
  { name: "Carlos M.", role: "Operação de marketplace", text: "A visualização da franquia e as ações em massa ajudam a controlar o trabalho do dia a dia." },
];

const activity = [
  { name: "João R.", action: "acabou de assinar o plano Pro", detail: "Exemplo de compra demonstrativa" },
  { name: "Marina S.", action: "ativou o plano Starter", detail: "Exemplo de ativação demonstrativa" },
  { name: "Carlos M.", action: "acabou de assinar o plano Premium", detail: "Exemplo de compra demonstrativa" },
  { name: "Fernanda L.", action: "conectou sua operação ao Mercado Livre", detail: "Exemplo de atividade demonstrativa" },
];

export function IllustrativeSocialProof() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const first = window.setTimeout(() => setVisible(true), 4200);
    const timer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % activity.length);
        setVisible(true);
      }, 350);
    }, 9500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const current = activity[index];

  return (
    <section className="relative border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">EXEMPLOS DE USO</Badge>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-4xl">Como a plataforma entra na rotina do vendedor</h2>
          <p className="mt-3 text-pretty leading-7 text-muted-foreground">Cenários demonstrativos para mostrar como o ANÚNCIO ML pode ser usado. Não são avaliações nem compras reais.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {testimonials.map((item) => (
            <Card key={item.name} className="border-border/60 bg-surface/40">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-3">
                  <Quote className="h-5 w-5 text-primary" />
                  <div className="flex gap-0.5" aria-label="Representação visual de avaliação">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 text-primary" />)}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6">“{item.text}”</p>
                <div className="mt-5 border-t pt-4">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.role} · exemplo demonstrativo</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className={`pointer-events-none fixed bottom-24 left-3 z-30 w-[min(330px,calc(100vw-24px))] transition-all duration-300 md:bottom-6 md:left-6 ${visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`} aria-live="polite">
        <Card className="overflow-hidden border-primary/25 bg-background/96 shadow-2xl backdrop-blur-xl">
          <div className="h-1 bg-primary" />
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary"><Sparkles className="h-3 w-3" />Atividade demonstrativa</span>
                </div>
                <p className="mt-1 text-sm font-semibold leading-5"><strong>{current.name}</strong> {current.action}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{current.detail} · não representa evento em tempo real.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
