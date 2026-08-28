import { createFileRoute, Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — ANÚNCIO ML" },
      {
        name: "description",
        content: "Termos de Uso da plataforma ANÚNCIO ML.",
      },
    ],
  }),
  component: TermsPage,
});

const UPDATED_AT = "28 de agosto de 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Logo to="/" />
          <Button asChild variant="outline" size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">DOCUMENTO LEGAL</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Termos de Uso</h1>
          <p className="mt-2 text-sm text-muted-foreground">Última atualização: {UPDATED_AT}</p>
        </div>

        <Card>
          <CardContent className="space-y-8 p-6 sm:p-8">
            <Section title="1. Sobre o ANÚNCIO ML">
              <p>O ANÚNCIO ML é uma plataforma independente voltada à organização e operação de anúncios por vendedores de marketplaces, com recursos de busca, criação e cópia de rascunhos, edição, automação, inteligência artificial, relatórios e integrações.</p>
              <p>O ANÚNCIO ML não é o Mercado Livre, não representa o Mercado Livre e não garante aprovação, posicionamento, vendas ou manutenção de anúncios em plataformas de terceiros.</p>
            </Section>

            <Section title="2. Conta e acesso">
              <p>Você é responsável por fornecer dados corretos, manter suas credenciais protegidas e por toda atividade realizada em sua conta. O acesso pode exigir confirmação de e-mail ou autenticação de provedores externos.</p>
              <p>É proibido compartilhar acesso de forma que viole regras do plano, tentar contornar limites, acessar contas de terceiros sem autorização ou interferir na segurança da plataforma.</p>
            </Section>

            <Section title="3. Integrações com terceiros">
              <p>Recursos do Mercado Livre, Mercado Pago, provedores de inteligência artificial e outros serviços dependem das APIs e políticas desses terceiros. Indisponibilidades, mudanças de regra, limites ou recusas desses serviços podem afetar funcionalidades do ANÚNCIO ML.</p>
              <p>Ao conectar uma conta externa, você declara possuir autorização para utilizá-la e autoriza o tratamento dos dados estritamente necessário para executar as funcionalidades solicitadas.</p>
            </Section>

            <Section title="4. Anúncios e responsabilidade pelo conteúdo">
              <p>Você continua responsável por revisar título, descrição, imagens, preço, estoque, atributos, categoria e demais dados antes de publicar. Sugestões automáticas ou geradas por IA devem ser conferidas antes do uso.</p>
              <p>Não é permitido usar a plataforma para fraude, conteúdo ilegal, produtos proibidos, violação de propriedade intelectual ou qualquer prática contrária às regras do marketplace aplicável.</p>
            </Section>

            <Section title="5. Franquias, créditos e uso de IA">
              <p>Os planos podem possuir limites separados para criações ou cópias de anúncios e para ações de inteligência artificial. A tela da ação informa o consumo aplicável antes da execução.</p>
              <p>Editar ou publicar novamente o mesmo rascunho não cria, por si só, uma nova unidade de franquia de criação. Pacotes extras podem ter validade e condições próprias exibidas no momento da compra.</p>
            </Section>

            <Section title="6. Planos, pagamentos e renovação">
              <p>Preços, periodicidade, descontos e recursos do plano são apresentados antes da contratação. Compras processadas por provedores de pagamento estão sujeitas à confirmação do respectivo provedor.</p>
              <p>Quando houver renovação, cancelamento ou alteração de plano, as regras e datas aplicáveis serão mostradas na área de assinatura. Benefícios promocionais podem possuir condições e prazo específicos.</p>
            </Section>

            <Section title="7. Disponibilidade e alterações">
              <p>Buscamos manter a plataforma disponível e segura, mas não garantimos operação ininterrupta. Manutenções, falhas de terceiros, mudanças de APIs ou eventos fora de controle razoável podem causar indisponibilidade temporária.</p>
              <p>Funcionalidades podem evoluir para acompanhar mudanças técnicas, comerciais ou regulatórias, preservando os direitos já adquiridos quando aplicável.</p>
            </Section>

            <Section title="8. Suspensão e encerramento">
              <p>Contas podem ser suspensas em caso de fraude, abuso, risco de segurança, inadimplência quando aplicável ou violação destes termos. Sempre que possível, o usuário receberá informação sobre o motivo e os meios disponíveis para regularização.</p>
            </Section>

            <Section title="9. Privacidade">
              <p>O tratamento de dados pessoais é detalhado na Política de Privacidade, que faz parte destes Termos de Uso.</p>
              <Button asChild variant="link" className="h-auto p-0 text-primary">
                <Link to="/privacidade">Ler a Política de Privacidade</Link>
              </Button>
            </Section>

            <Section title="10. Contato e suporte">
              <p>Dúvidas sobre a plataforma, conta, cobrança ou estes termos podem ser encaminhadas pelos canais de suporte disponibilizados no próprio ANÚNCIO ML.</p>
            </Section>
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Criar conta</Link></Button>
          <Button asChild variant="outline"><Link to="/">Voltar ao site</Link></Button>
        </div>
      </main>
    </div>
  );
}
