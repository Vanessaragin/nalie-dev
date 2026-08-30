# Estado final do portal

Nenhuma base financeira paralela é criada pelo portal. O aplicativo externo
grava nas três tabelas canônicas e o portal consulta e exporta esses dados com
isolamento por `company_id`.

## Concluído

- autenticação, primeiro acesso e recuperação de senha;
- IDs UUID de empresa, perfil, vínculo e arquivos;
- isolamento por empresa com RLS;
- dois usuários por empresa e acesso Completo/Limitado;
- acesso Limitado restrito a Análise, Calendário e Mais informações;
- upload bruto permanente em bucket privado, sem apagar o arquivo original;
- identificação de empresa, usuário e upload nos arquivos;
- links de BI, PowerPoint e dois Excels por empresa;
- nome visual configurável para cada link de Excel;
- administradora seleciona uma empresa por vez em Análise;
- foto profissional controlada somente pela proprietária;
- SMTP e e-mails de recuperação configurados;
- rotas vazias/órfãs removidas.
- Calendário do cliente conectado a `calendar_events`;
- ficha principal de Contatos/CRM conectada a `client_crm` e `companies`.
- histórico do CRM conectado a `client_activities` (acompanhamentos,
  processamentos, interações, entregas, pagamentos, ações e materiais);
- novo logo aplicado no login, primeiro acesso, portal e página institucional.
- cobranças, assinaturas, bloqueio de importações e chave Pix conectados a
  `service_payments`, `service_subscriptions` e `site_branding`;
- cliente consulta somente suas cobranças e informa pagamento por função segura.
- valor individual definido no cadastro de cada empresa gera assinatura e
  primeira cobrança automaticamente; alterações posteriores ficam em Pagamentos.
- cobrança classificada por cliente Pessoa ou Empresa, com frequência Semanal,
  Quinzenal ou Mensal; os antigos nomes de pacote não são exibidos ao usuário.
- Meu perfil conectado a `profiles` e ao usuário autenticado, sem nomes,
  e-mails ou contatos demonstrativos;
- seletor de empresa e gestão de usuários conectados a `companies` e
  `company_users`; acesso Completo, Limitado e Bloqueado vem do banco e não
  pode mais ser concedido por `localStorage`.
- políticas e regras versionadas por empresa em `company_settings.policies`,
  sem depender do navegador da administradora.
- bases financeiras canônicas: `movimentacoes_conta`, `cartao_lancamentos` e
  `cartao_parcelas_futuras`;
- visão financeira por empresa, período, mês, categoria e instituição;
- Compilado final em ZIP com Excel de três abas, aba de política `veryHidden`
  e TXT de identificação;
- limite de 10.000 registros no Compilado e mensagem para contactar o
  consultor quando o volume for extenso;
- registro do Compilado em `report_exports`;
- modelos e botão de importação financeira removidos do portal; essa integração
  pertence ao aplicativo externo.

## Pendências externas para ativação em produção

- testar administradora, usuário completo e usuário limitado;
- testar duas empresas e provar isolamento em leitura, alteração e download;
- informar a URL final do portal e configurá-la no ambiente de hospedagem e no
  Supabase Auth;
- executar testes de RLS, interface, API, upload e recuperação de senha;
- publicar e fazer o teste de aceite no endereço de produção.
- conectar o aplicativo externo às três tabelas financeiras e homologar uma
  carga real. Essa credencial não deve ser exposta no navegador nem neste
  repositório.
- validar com dois clientes reais ou sintéticos antes da abertura pública.
