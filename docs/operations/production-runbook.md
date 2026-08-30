# Publicação e operação do portal Nalie

## 1. Variáveis obrigatórias

Configure no provedor de hospedagem:

- `NEXT_PUBLIC_SITE_URL`: endereço HTTPS definitivo do portal;
- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase de produção;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave pública do projeto;
- `SUPABASE_SERVICE_ROLE_KEY`: segredo somente do servidor.

Nunca exponha a chave `service_role` em variável `NEXT_PUBLIC_*`, no navegador,
em planilhas ou na documentação entregue ao cliente.

## 2. Supabase

1. Aplique as migrações na ordem do nome do arquivo.
2. Em Authentication → URL Configuration, defina a URL oficial do site e
   permita `/primeiro-acesso` como redirecionamento.
3. Mantenha `company-files`, `financial-imports` e `payment-receipts` privados.
4. Configure SMTP Brevo e autorize os IPs exigidos pelo provedor.
5. Teste recuperação de senha usando um link novo e de uso único.

## 3. Integração financeira externa

O aplicativo externo deve gravar usando uma credencial de servidor nas tabelas:

- `movimentacoes_conta`;
- `cartao_lancamentos`;
- `cartao_parcelas_futuras`.

Todo registro deve conter o `cliente_id` UUID existente em `companies`. Não use
nome ou e-mail como chave de relacionamento. Use `registro_origem_hash` para
evitar duplicidades e preserve `arquivo_origem` e `processamento_id` para
rastreabilidade.

## 4. Compilado e arquivos

- O cliente baixa o Compilado em Relatórios.
- O ZIP contém um Excel com três abas e `usuario_<ID>.txt`.
- Acima de 10.000 registros ou 20 MB, o portal recusa a geração e orienta:
  “Arquivo extenso. Contacte o seu consultor.”
- Arquivos brutos enviados permanecem no bucket privado e são baixados em ZIP
  junto com o TXT de identificação.

## 5. Aceite antes de abrir o portal

1. Criar duas empresas sintéticas e usuários separados.
2. Confirmar que nenhum usuário consulta, altera ou baixa dados da outra empresa.
3. Testar acessos Completo, Limitado e Bloqueado.
4. Testar primeiro acesso, recuperação de senha, saída e nova autenticação.
5. Conferir PIX, cobranças, notificações, calendário, links de BI e arquivos.
6. Gerar um Compilado e conferir as três abas, o TXT e o registro em
   `report_exports`.
7. Executar `npm run format:check`, `npm run lint`, `npm run typecheck`,
   `npm test`, `npm run check:production-env` e `npm run build`.

## 6. Alterações institucionais

Consulte `docs/operations/branding-and-contact.md` para trocar a foto oficial e
o link “Falar com um especialista”. Apenas a administradora mestre pode alterar
a foto profissional compartilhada.
