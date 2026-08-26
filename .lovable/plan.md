# Plano de auditoria e correção final — ANÚNCIO ML

## Escopo principal
Preservar o projeto existente e fazer apenas correções pequenas e direcionadas. A prioridade será funcionalidade real, não cosmética.

## Ordem de execução

1. Mercado Livre OAuth
   - Testar o botão “Conectar Mercado Livre” no navegador com sessão real.
   - Validar a rota `/ml-start`, geração de URL oficial, `state` anti-CSRF e redirecionamento real para o Mercado Livre.
   - Auditar `/api/public/ml/callback`: `code`, `state`, troca de token, vínculo com usuário interno, gravação de conexão e retorno ao app.
   - Corrigir apenas falhas confirmadas.

2. Autenticação e sessão
   - Verificar login por e-mail, Google, logout, recuperação de senha e persistência.
   - Ajustar redirecionamento pós-login: cliente para `/dashboard`, admin para `/admin`.
   - Garantir que não haja flash de landing/visitante enquanto a sessão carrega.

3. Admin e isolamento multi-tenant
   - Confirmar que `/admin` é protegido por backend/RLS e não apenas por frontend.
   - Corrigir acesso de usuário comum, se houver falha real.
   - Revisar server functions críticas para garantir escopo por `userId` e verificação de admin.

4. Imagens de produtos
   - Criar/ajustar utilitário reutilizável `getProductImage()` se ainda não existir.
   - Usar o utilitário nos pontos críticos existentes: Radar/busca, Meus anúncios, Editor e Dashboard.
   - Adicionar placeholder profissional quando a API não fornecer imagem.

5. Radar, duplicação e filas
   - Auditar busca por palavra, produto, ID e URL.
   - Validar duplicação individual e em massa criando rascunhos do usuário logado.
   - Corrigir falhas confirmadas de imagens, seleção, progresso ou ownership.

6. IA e publicação
   - Auditar otimização de anúncio, títulos e descrição com IA real.
   - Onde faltar credencial/capacidade real, exibir “Configuração pendente” sem simular.
   - Auditar publicação e publicação em massa; não afirmar publicação real sem confirmação da API.

7. Suporte e navegação
   - Adicionar superfície global de suporte com WhatsApp e e-mail sem reescrever o layout.
   - Garantir que Google não apareça como integração dentro do painel.

8. Testes finais
   - Executar testes práticos no navegador para os fluxos críticos possíveis no ambiente.
   - Mercado Livre: validar até chegar ao domínio oficial OAuth; a autorização final depende do consentimento real do usuário no Mercado Livre.
   - Gerar relatório final com: Funcionando, Corrigido, Pendente, Erros, Configurações necessárias e Testes realizados.

## Detalhes técnicos
- Não expor `ML_CLIENT_SECRET`, access tokens ou refresh tokens no frontend.
- Usar `requireSupabaseAuth` em server functions privadas e o `context.userId` como fonte de ownership.
- Usar admin client somente dentro de handlers/server helpers, após autenticação quando aplicável.
- Não criar novas tabelas sem migração aprovada e GRANT/RLS no mesmo SQL.
- Não usar mocks para Mercado Livre, pagamentos, IA, imagens, licenças, vendas ou publicações.
