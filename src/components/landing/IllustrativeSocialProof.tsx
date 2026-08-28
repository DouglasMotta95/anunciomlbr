import { Quote, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  { name: "Marcos R.", role: "Vendedor de eletrônicos", text: "O fluxo de copiar, revisar e otimizar anúncios deixa a operação muito mais organizada." },
  { name: "Ana P.", role: "Loja de utilidades", text: "Ter anúncios, perguntas e otimização no mesmo painel facilita bastante a rotina." },
  { name: "Carlos M.", role: "Operação de marketplace", text: "A visualização da franquia e as ações em massa ajudam a controlar o trabalho do dia a dia." },
];

export function IllustrativeSocialProof() {
  return (
    <section className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">EXEMPLOS DE USO</Badge>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-4xl">Como a plataforma entra na rotina do vendedor</h2>
          <p className="mt-3 text-pretty leading-7 text-muted-foreground">Cenários demonstrativos para mostrar como o ANÚNCIO ML pode ser usado. Não são avaliações de clientes reais.</p>
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
    </section>
  );
}
