import {
  BarChart3,
  Bot,
  Boxes,
  HeartPulse,
  MessageCircleQuestion,
  PackageSearch,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: PackageSearch,
    title: "Busca em vários formatos",
    text: "Pesquise por palavra-chave, produto, ID, link ou vendedor e trabalhe os resultados dentro do painel.",
  },
  {
    icon: Sparkles,
    title: "Cópias e variações",
    text: "Crie rascunhos, cópias iguais e variações com novos títulos, sem adicionar “cópia” ao nome do anúncio.",
  },
  {
    icon: Bot,
    title: "Otimização com IA",
    text: "Revise título, descrição, categoria, preço e atributos disponíveis antes de aplicar uma melhoria.",
  },
  {
    icon: BarChart3,
    title: "Vendas e pedidos",
    text: "Acompanhe pedidos, faturamento, ticket médio, cancelamentos e produtos vendidos da conta conectada.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Perguntas com sugestão de IA",
    text: "Leia dúvidas dos compradores, veja o produto relacionado e prepare uma resposta antes de enviar ao Mercado Livre.",
  },
  {
    icon: Boxes,
    title: "Estoque e margem",
    text: "Organize estoque, custos e margem para enxergar melhor a operação sem depender de planilhas separadas.",
  },
  {
    icon: HeartPulse,
    title: "Saúde dos anúncios",
    text: "Identifique anúncios com pontos básicos a corrigir e abra diretamente o editor para trabalhar neles.",
  },
  {
    icon: WalletCards,
    title: "Plano e uso transparentes",
    text: "Veja sua franquia, créditos de IA, extras, pagamentos e capacidade restante em um único lugar.",
  },
];

export function VerifiedFeaturesSection() {
  return (
    <section id="recursos" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            Recursos da plataforma
          </span>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-4xl">
            O que você encontra dentro do ANÚNCIO ML
          </h2>
          <p className="mt-3 text-pretty leading-7 text-muted-foreground">
            Recursos para buscar, preparar, otimizar e acompanhar sua operação no Mercado Livre em um fluxo mais organizado.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group h-full border-border/60 bg-card/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg"
            >
              <CardContent className="p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-sm font-extrabold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
