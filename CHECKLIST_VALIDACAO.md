# Checklist de validação — Plataforma Nalie

Atualizado em 27/08/2026.

## 1. Site público e login

- [ ] Logo oficial da Nalie aparece no cabeçalho.
- [ ] Identidade visual usa rosas mais quentes e vinho com maior contraste.
- [ ] Não existe mais a linha escura no topo.
- [ ] Espaçamento do topo e entre seções está equilibrado.
- [ ] Texto principal começa com “Seus números precisam fazer sentido”.
- [ ] Texto explicativo apresenta organização e análise financeira conforme aprovado.
- [ ] Botão “Falar com um especialista” abre o WhatsApp.
- [ ] WhatsApp pode ser alterado em **Mais informações → Sobre a Nalie → Editar informações**.
- [ ] Seletor Português/English traduz a página e preserva a escolha.
- [ ] Processo está apresentado em quatro etapas: envio, organização, análise e acompanhamento.
- [ ] Entregas citam BI, apresentações, importação/exportação, histórico e consultoria.
- [ ] Gráfico de pizza mantém categorias e percentuais alinhados.
- [ ] “Tempo economizado” foi substituído por “Diversos bancos”.
- [ ] Login mostra “Bem-vindo.”, sem “de volta” e sem “Ambiente protegido”.
- [ ] Login usa a foto de Vanessa ao fundo, sem o círculo decorativo.
- [ ] Frase do login está assinada por “Nalie Intelligence · Vanessa Rodrigues”.

## 2. Estrutura do portal

- [ ] Portal mantém padrão único de cores, tipografia, cards, tabelas e botões.
- [ ] Cabeçalho exibe usuário como informação principal e empresa/perfil como apoio.
- [ ] Menus e submenus usam ícones coloridos consistentes.
- [ ] Financeiro, Planejamento e Análises preservam o submenu aberto na rota ativa.
- [ ] Não existem Relatórios ou Documentos duplicados.
- [ ] Relatórios e Documentos estão dentro da área de Análises quando aplicável.
- [ ] Árvore de decisão está em Análises e não apresenta retorno para Produtos.
- [ ] Área de Custos agrupa produtos/custos de vendas e mão de obra.
- [ ] Cálculo de combustível está em Planejamento.
- [ ] Opções sem permissão desaparecem completamente do menu do usuário.
- [ ] “MINHA ÁREA PRIVADA” e Administração aparecem somente para Vanessa.
- [ ] Menu lateral pode ser recolhido e reaberto.

## 3. Análises, BI, apresentações e relatórios

- [ ] Análise é a página inicial de conteúdo do cliente.
- [ ] BI e apresentação mostram mensagem “em produção” quando não publicados.
- [ ] Endereço público do Power BI foi removido do código cliente.
- [ ] Campos de endereço de BI/PPT não são enviados ao HTML do usuário.
- [ ] Publicação segura está marcada como pendente de backend autenticado.
- [ ] Achados, hipóteses, decisões, ações e histórico estão organizados em Análises.
- [ ] Relatórios apresentam origem e contexto das informações quando necessário.
- [ ] Importação e exportação ficam concentradas em Relatórios.
- [ ] Exportação aparece uma única vez como compilado completo.
- [ ] Documentos possuem ação de exclusão com aviso sobre dados relacionados.

## 4. Financeiro e pagamentos

- [ ] Visão do cliente mostra apenas pagamentos do serviço Nalie, valor pago e próximo pagamento.
- [ ] Cobranças usam a lista de clientes existentes.
- [ ] Cobrança permite selecionar competência/período pago.
- [ ] PIX alterado por Vanessa aparece na área de pagamento do cliente.
- [ ] Não existem vínculos externos com cartões ou contas na área de pagamentos dos serviços.
- [ ] Contas e cartões inativos permanecem no histórico e não aceitam lançamentos futuros.
- [ ] Itens inativos podem ser reativados.
- [ ] Contas a pagar e receber possuem cadastro individual/em série, edição e filtros.
- [ ] Metas permitem registrar aportes e retiradas.
- [ ] Orçamento registra situação de aprovação ou rejeição.
- [ ] Tabelas financeiras seguem o mesmo padrão visual.

## 5. Calendário

- [ ] Usuário possui uma agenda única.
- [ ] Vanessa possui filtros administrativos adicionais.
- [ ] Filtro de cliente/empresa afeta calendário e próximos compromissos.
- [ ] Seleção do dia afeta a lista de próximos compromissos.
- [ ] Próximos compromissos ficam abaixo do calendário.
- [ ] Linhas da grade mensal estão visíveis.
- [ ] Novo compromisso possui formulário e ação funcional.
- [ ] Compromissos do usuário aparecem nos lembretes do dia correto.
- [ ] Cliente é selecionado em lista, sem redigitação completa.

## 6. CRM e cadastros

- [ ] Existe um único fluxo para cadastrar e editar cliente.
- [ ] Cadastro contempla pessoa física ou pessoa jurídica.
- [ ] CRM usa clientes existentes nos compromissos, cobranças e atividades.
- [ ] Atividades podem ser concluídas e avançadas no fluxo.
- [ ] Blocos são separados por situação/problema.
- [ ] CRM não usa foto de perfil nos cards de atividade.
- [ ] Contato temporário pode evoluir para cliente definitivo no fluxo cadastral.
- [ ] Cadastro cria a empresa e até dois usuários definidos por Vanessa.
- [ ] Permissões por página são configuradas por usuário.
- [ ] Dados da empresa são alterados somente por Vanessa.

## 7. Perfil, informações e políticas

- [ ] Sobre a Nalie, contatos, bio, proposta e textos institucionais são editáveis por Vanessa.
- [ ] Foto ocupa todo o quadro de perfil e possui ação para troca.
- [ ] Instagram substituiu LinkedIn.
- [ ] Políticas e regras seguem a tipografia do portal.
- [ ] Portabilidade de dados e campos removidos não aparecem mais.
- [ ] Base de meteorologia e seus lembretes foram removidos.

## 8. Segurança — situação atual

### Proteções já aplicadas

- [x] Link público de Power BI removido do bundle da página de Análises.
- [x] Configuração direta de iframe retirada até existir integração segura.
- [x] Rotas `/portal` receberam Proxy de autenticação Supabase.
- [x] Produção sem Supabase configurado falha fechada e redireciona ao login.
- [x] Cabeçalhos `nosniff`, `DENY`, política de referenciador, permissões e proteção contra enquadramento adicionados.
- [x] Nenhum uso de `dangerouslySetInnerHTML`, `eval` ou `new Function` encontrado.
- [x] Arquivos `.env` estão ignorados pelo Git.
- [x] Auditoria npm das dependências de produção: zero vulnerabilidades conhecidas.

### Bloqueios antes de produção

- [ ] Configurar projeto Supabase real; as chaves atuais são placeholders.
- [ ] Mover dados de clientes, pagamentos, permissões e arquivos do `localStorage` para o banco.
- [ ] Criar tabelas por empresa e políticas RLS para impedir leitura cruzada.
- [ ] Armazenar papéis/permissões no servidor; atualmente ainda podem ser adulterados no navegador do protótipo.
- [ ] Proteger rotas administrativas com papel validado no servidor.
- [ ] Validar tipo, tamanho, assinatura e conteúdo dos arquivos enviados.
- [ ] Criar armazenamento privado com URLs temporárias para documentos e apresentações.
- [ ] Implementar Power BI Embedded com token temporário gerado no servidor. Links `view?r=` não são privados.
- [ ] Para Google Slides/Looker Studio, decidir entre aceitar a exposição do endereço do iframe ou entregar uma cópia privada pelo servidor.
- [ ] Configurar rate limiting, CAPTCHA, MFA, recuperação de senha e logs de auditoria.
- [ ] Executar teste de invasão em ambiente de homologação após o backend e o deploy.
- [ ] Corrigir os avisos e erros de lint remanescentes em componentes antigos antes da homologação.

## Próxima etapa recomendada

**Backend seguro e banco de dados multiempresa.** Antes de adicionar novos recursos visuais, configurar Supabase Auth, modelo de empresas/usuários, RLS, armazenamento privado, papéis administrativos e publicação segura dos relatórios. Depois: homologação com os dois perfis de usuário, teste de segurança e somente então produção.
