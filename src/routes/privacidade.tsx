import { createFileRoute, Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — ANÚNCIO ML" },
      {
        name: "description",
        content: "Política de Privacidade da plataforma ANÚNCIO ML.",
      },
    ],
  }),
  component: PrivacyPage,
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

function PrivacyPage() {
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
          <p className="text-xs font-bold uppercase tracking-wider text-primary">PRIVACIDADE E DADOS</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Política de Privacidade</h1>
          <p className="mt-2 text-sm text-muted-foreground">Última atualização: {UPDATED_AT}</p>
        </div>

        <Card>
          <CardContent className="space-y-8 p-6 sm:p-8">
            <Section title="1. Escopo">
              <p>Esta Política explica como o ANÚNCIO ML trata dados necessários para criar contas, prestar o serviço, integrar ferramentas externas, processar pagamentos, oferecer suporte e proteger a plataforma.</p>
            </Section>

            <Section title="2. Dados que podemos tratar">
              <p>Podemos tratar dados de cadastro, como nome, e-mail e identificadores de conta; dados técnicos e de sessão; dados de uso da plataforma; informações necessárias para cobrança; e dados obtidos de integrações autorizadas pelo usuário.</p>
              <p>Ao conectar o Mercado Livre, tratamos somente os dados necessários para as funcionalidades solicitadas, como identificação da conta, catálogo, anúncios, perguntas, vendas, pedidos e informações operacionais disponíveis pela API autorizada.</p>
            </Section>

            <Section title="3. Finalidades">
              <p>Os dados são utilizados para autenticar usuários, executar funcionalidades, sincronizar integrações, personalizar o painel, processar pagamentos, medir uso e franquias, prevenir fraude, investigar falhas, prestar suporte e cumprir obrigações legais.</p>
            </Section>

            <Section title="4. Inteligência artificial">
              <p>Quando você solicita uma ação de IA, os dados necessários daquela tarefa podem ser enviados ao provedor de IA configurado para gerar a resposta. O ANÚNCIO ML procura limitar o contexto ao necessário para a função solicitada.</p>
              <p>Conteúdos gerados por IA devem ser revisados pelo usuário antes de publicação ou uso comercial.</p>
            </Section>

            <Section title="5. Compartilhamento e operadores">
              <p>Dados podem ser processados por fornecedores essenciais ao serviço, como infraestrutura, autenticação, banco de dados, Mercado Livre, Mercado Pago e provedores de IA, sempre de acordo com a função necessária e as permissões concedidas.</p>
              <p>Não vendemos dados pessoais como produto. Informações podem ser compartilhadas quando exigido por lei, ordem válida ou para proteção contra fraude e abuso.</p>
            </Section>

            <Section title="6. Segurança">
              <p>Aplicamos controles de autenticação, autorização por função, segregação de áreas administrativas e validações no servidor. Tokens e segredos de integração não devem ser exibidos na interface do usuário.</p>
              <p>Nenhum sistema é totalmente imune a incidentes; medidas de segurança são revisadas e ajustadas conforme a evolução da plataforma.</p>
            </Section>

            <Section title="7. Retenção">
              <p>Os dados são mantidos pelo período necessário para prestação do serviço, cumprimento de obrigações, prevenção de fraude, resolução de disputas e manutenção de registros legítimos. Dados podem ser anonimizados quando não precisarem mais estar associados ao usuário.</p>
            </Section>

            <Section title="8. Direitos do titular">
              <p>Nos termos da legislação aplicável, você pode solicitar informações sobre tratamento, correção, atualização, portabilidade quando cabível, oposição, eliminação de dados tratados com base adequada para isso e revisão de consentimentos aplicáveis.</p>
              <p>Alguns registros podem precisar ser mantidos mesmo após pedido de exclusão quando houver obrigação legal, prevenção de fraude, exercício regular de direitos ou outra base jurídica válida.</p>
            </Section>

            <Section title="9. Cookies, sessão e armazenamento local">
              <p>A plataforma pode utilizar cookies ou armazenamento do navegador necessários para autenticação, manutenção da sessão, segurança e preferências de uso. Esses mecanismos também podem ser utilizados para métricas operacionais e melhoria da experiência.</p>
            </Section>

            <Section title="10. Serviços de terceiros">
              <p>Ao acessar links ou integrações externas, passam a valer também as políticas do respectivo terceiro. O ANÚNCIO ML não controla práticas de privacidade de serviços externos fora do contexto da integração contratada.</p>
            </Section>

            <Section title="11. Alterações e contato">
              <p>Esta política pode ser atualizada para refletir mudanças de produto, segurança, fornecedores ou exigências legais. A versão vigente permanece disponível nesta página.</p>
              <p>Solicitações relacionadas a privacidade podem ser encaminhadas pelos canais oficiais de suporte disponibilizados no ANÚNCIO ML.</p>
            </Section>

            <Section title="12. Termos de Uso">
              <Button asChild variant="link" className="h-auto p-0 text-primary">
                <Link to="/termos">Ler os Termos de Uso</Link>
              </Button>
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
