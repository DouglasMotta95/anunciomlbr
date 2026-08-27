# ANÚNCIO ML — Subscription Growth Suite

Objetivo: aumentar ativação, conversão, retenção e expansão da assinatura sem inventar métricas ou automatizar ações irreversíveis sem confirmação.

## 15 frentes de produto

1. Onboarding orientado ao primeiro resultado: conectar ML → importar/buscar → escolher anúncio → duplicar/otimizar → publicar.
2. Valor percebido mensal: anúncios trabalhados, otimizações, créditos utilizados e resultados reais disponíveis.
3. Alertas acionáveis: estoque baixo, score baixo, cota em 70/85/100%, queda de vendas e anúncios pausados.
4. Upgrade inteligente contextual: upgrade ou pacote extra conforme consumo da cota.
5. Comparador de planos por benefícios e limites reais.
6. Prova social somente com dados reais/cases aprovados; remover números fictícios.
7. Teste grátis orientado por missão, com progresso e CTA de conversão.
8. Central de assinatura: plano, consumo, extras, pagamentos, renovação e ações permitidas.
9. Retenção no cancelamento: motivo, downgrade/pausa/oferta quando configurados; sem dark patterns.
10. Programa de indicação: código, conversões e recompensa em créditos/anúncios.
11. Revendedor profissional: carteira, custo, licenças, clientes, histórico e suspensão.
12. Assistente comercial no admin para pagamentos pendentes/recusados, sempre com revisão humana antes do envio.
13. Resultados mensais: resumo comercial e operacional com dados reais.
14. Confiabilidade visível: conexão ML, última sincronização, erros acionáveis e reconexão.
15. Central de notificações/oportunidades: campeão da semana, estoque, queda, cota e saúde dos anúncios.

## Regras de implementação

- Mercado Pago apenas para cobrança; Mercado Livre para integração operacional.
- Não exibir métricas simuladas como se fossem reais.
- Recursos dependentes de permissões ML devem mostrar estado de configuração, não erro genérico.
- Toda ação de IA consome a cota definida no plano.
- Upgrade e extras não podem apagar créditos extras já adquiridos.
- Revendedores nunca recebem acesso ao painel administrativo principal.
- Alertas e recomendações não devem executar publicação, cancelamento ou envio de mensagem sem confirmação explícita.

## Ordem técnica

A. Fundação: eventos de produto, preferências, notificações e resumo de valor.
B. Ativação: onboarding + trial mission + confiabilidade da integração.
C. Monetização: comparador, upgrade contextual, central de assinatura e retenção.
D. Retenção: resultados mensais, alertas, oportunidades e indicação.
E. Canais: revendedor + assistente comercial do admin.

Cada bloco deve entrar por PR revisável e ser integrado à main somente após validação de compatibilidade com as rotas, banco e fluxos existentes.