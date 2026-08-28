import { Bot, ImageIcon, PackagePlus, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const items = [
  {
    icon: PackagePlus,
    title: "Franquia de anúncios",
    text: "Novas criações e cópias usam a franquia de anúncios. Editar ou publicar novamente o mesmo rascunho não consome outra unidade.",
  },
  {
    icon: Bot,
    title: "Créditos de IA separados",
    text: "Títulos, descrições, análises e otimizações usam créditos de IA, sem reduzir sua franquia de anúncios.",
  },
  {
    icon: ImageIcon,
    title: "Imagem com IA",
    text: "Cada imagem gerada usa 3 créditos de IA. O custo é mostrado antes da geração e aplicar a imagem pronta não cobra novamente.",
  },
  {
    icon: Sparkles,
    title: "Precisou de mais?",
    text: "Clientes com plano ativo podem comprar pacotes extras de anúncios ou de IA separadamente, sem precisar trocar de plano.",
  },
] as const;

export function CreditsExplainer() {
  return (
    <section className="border-y border-border/60 bg-surface/20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            LIMITES CLAROS, SEM SURPRESA
          </Badge>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-4xl">
            Anúncios e inteligência artificial têm saldos separados
          </h2>
          <p className="mt-3 text-pretty leading-7 text-muted-foreground">
            Você sempre sabe o que será consumido antes de executar uma ação. Criar anúncios não gasta IA e usar IA não reduz sua franquia de criação.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="border-border/60 bg-background/75">
                <CardContent className="p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-muted-foreground">
          A quantidade incluída em cada plano e os valores de pacotes extras são exibidos na contratação e na Central da assinatura.
        </p>
      </div>
    </section>
  );
}
