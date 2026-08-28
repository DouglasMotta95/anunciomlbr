import { Quote, Star, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  { name: "Marcos R.", role: "Vendedor de eletrônicos", text: "O fluxo de copiar, revisar e otimizar anúncios deixa a operação muito mais organizada." },
  { name: "Ana P.", role: "Loja de utilidades", text: "Ter anúncios, perguntas e otimização no mesmo painel facilita bastante a rotina." },
  { name: "Carlos M.", role: "Operação de marketplace", text: "A visualização da franquia e as ações em massa ajudam a controlar o trabalho do dia a dia." },
];

const activity = [
  "João R. assinou o plano anual",
  "Marina S. criou uma nova cópia de anúncio",
  "Paulo C. usou a otimização com IA",
  "Fernanda L. conectou sua operação ao painel",
];

export function IllustrativeSocialProof() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const first = window.setTimeout(() => setVisible(true), 3500);
    const timer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % activity.length);
        setVisible(true);
      }, 400);
    }, 9000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="relative border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">EXEMPLOS ILUSTRATIVOS</Badge>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-4xl">Como a plataforma entra na rotina do vendedor</h2>
          <p className="mt-3 text-pretty leading-7 text-muted-foreground">Depoimentos demonstrativos para apresentar os tipos de benefícios percebidos no uso. Substituiremos por avaliações reais conforme forem coletadas.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {testimonials.map((item) => (
            <Card key={item.name} className="border-border/60 bg-surface/40">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-3">
                  <Quote className="h-5 w-5 text-primary" />
                  <div className="flex gap-0.5" aria-label="5 estrelas ilustrativas">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />)}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6">“{item.text}”</p>
                <div className="mt-5 border-t pt-4">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.role} · perfil ilustrativo</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className={`fixed bottom-24 left-4 z-40 max-w-[320px] transition-all duration-300 md:bottom-5 ${visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 pointer-events-none"}`} aria-live="polite">
        <Card className="border-primary/25 bg-background/95 shadow-xl backdrop-blur">
          <CardContent className="flex gap-3 p-4">
            <div className="rounded-xl bg-primary/10 p-2"><Users className="h-4 w-4 text-primary" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Atividade ilustrativa</p>
              <p className="mt-1 text-sm font-semibold">{activity[index]}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Exemplo visual de prova social — não representa evento em tempo real.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
