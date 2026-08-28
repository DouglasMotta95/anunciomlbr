import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";

const SUPPORT_WHATSAPP =
  "https://wa.me/5535991429262?text=Ol%C3%A1%21%20Estou%20conhecendo%20o%20AN%C3%9ANCIO%20ML%20e%20gostaria%20de%20tirar%20algumas%20d%C3%BAvidas%20antes%20de%20assinar.";

const faq = [
  {
    q: "O ANÚNCIO ML é uma plataforma oficial do Mercado Livre?",
    a: "Não. O ANÚNCIO ML é uma plataforma independente e não possui vínculo oficial com o Mercado Livre. A integração usa os recursos de API e autorização disponibilizados pelo Mercado Livre.",
  },
  {
    q: "Preciso ter uma conta no Mercado Livre para usar?",
    a: "Sim. Para sincronizar, publicar e acompanhar dados da operação, você precisa conectar uma conta do Mercado Livre e autorizar o acesso solicitado.",
  },
  {
    q: "Como funciona o teste gratuito?",
    a: "Contas elegíveis recebem uma franquia inicial de 10 anúncios para testar o fluxo da plataforma. Ao atingir o limite disponível, você pode escolher um plano para continuar criando ou duplicando anúncios pelo ANÚNCIO ML.",
  },
  {
    q: "Como copiar um anúncio funciona na prática?",
    a: "A cópia cria um rascunho editável no ANÚNCIO ML com os dados que estiverem disponíveis, como título, descrição, preço, estoque, categoria, atributos e imagens. Você revisa antes de publicar.",
  },
  {
    q: "O que a IA faz nos anúncios?",
    a: "A IA analisa o contexto disponível do anúncio — como título, descrição, categoria, preço e atributos — e sugere melhorias de clareza, organização e intenção de busca. Ela não garante vendas, posição no Mercado Livre ou aumento de conversão.",
  },
  {
    q: "Meu plano é ativado automaticamente após o pagamento?",
    a: "Quando o pagamento é feito pelo fluxo integrado, a liberação depende da confirmação válida do Mercado Pago no backend. Um pagamento pendente, recusado ou cancelado não é tratado como aprovado.",
  },
  {
    q: "Posso pagar por Pix ou receber uma licença manual?",
    a: "Quando essa modalidade estiver disponível para o atendimento, a equipe pode gerar uma licença manual e orientar a ativação. Fale com o suporte antes do pagamento para confirmar as opções disponíveis.",
  },
  {
    q: "Tem fidelidade ou multa por cancelar?",
    a: "O período e as condições do plano aparecem antes da contratação. No mensal, a cobrança é referente ao ciclo contratado; períodos maiores podem oferecer desconto proporcional ao compromisso escolhido.",
  },
  {
    q: "Meus anúncios do Mercado Livre param se eu atingir a franquia?",
    a: "Não. A franquia do ANÚNCIO ML controla novas criações e duplicações feitas pela plataforma. Anúncios que já existem no Mercado Livre continuam seguindo o status da sua conta e da própria plataforma do Mercado Livre.",
  },
  {
    q: "É seguro conectar minha conta do Mercado Livre?",
    a: "A conexão usa o fluxo OAuth do Mercado Livre. O ANÚNCIO ML não precisa armazenar sua senha do Mercado Livre; os tokens de acesso usados pela integração ficam restritos ao backend e não são expostos na interface do cliente.",
  },
  {
    q: "Tem suporte se eu travar em alguma etapa?",
    a: "Sim. O suporte pré-venda e de uso pode ser acionado pelo WhatsApp para dúvidas sobre conexão, planos e funcionamento da plataforma.",
  },
];

export function LaunchFaqSection() {
  return (
    <section id="faq" className="border-b border-border/60 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            FAQ
          </span>
          <h2 className="mt-4 text-balance text-3xl font-black sm:text-4xl">Tire suas dúvidas antes de começar</h2>
          <p className="mt-3 text-pretty leading-7 text-muted-foreground">
            Respostas objetivas sobre integração, teste, IA, pagamento e uso da plataforma.
          </p>
        </div>

        <Card className="mt-10 border-border/60 bg-surface/40 p-1">
          <Accordion type="single" collapsible className="divide-y divide-border/60">
            {faq.map((item) => (
              <AccordionItem key={item.q} value={item.q} className="border-0 px-4 py-1">
                <AccordionTrigger className="py-4 text-left text-sm font-semibold hover:no-underline sm:text-base">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Ficou alguma dúvida?{" "}
          <a
            href={SUPPORT_WHATSAPP}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Fale com o atendimento do ANÚNCIO ML no WhatsApp
          </a>
          .
        </p>
      </div>
    </section>
  );
}
