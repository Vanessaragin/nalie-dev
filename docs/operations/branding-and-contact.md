# Foto institucional e contato da página inicial

## Alterar a foto da página de login e dos perfis

A imagem oficial fica em:

`apps/web/public/vanessa-login.jpeg`

Para trocar a foto sem alterar o código, substitua esse arquivo por outra imagem
JPEG mantendo exatamente o nome `vanessa-login.jpeg`. Depois publique novamente o
site. A mesma imagem é utilizada no login e nos perfis.

O componente compartilhado dos perfis fica em:

`apps/web/app/components/fixed-profile-photo.tsx`

O banco protege o caminho por meio da função
`public.enforce_nalie_profile_photo`. A migração
`202608290002_m37_owner_managed_profile_photo.sql` permite a alteração somente
para a administradora mestre. Os demais usuários não recebem o controle para
alterar a foto.

No portal, a administradora mestre também encontra o botão **Alterar foto
oficial** em “Sobre mim e contatos”. A imagem escolhida é enviada para o bucket
`brand-assets` do Supabase, e seu endereço é salvo em
`public.site_branding.photo_url`. Assim, a foto passa a aparecer em todos os
perfis, inclusive em outros computadores e navegadores. Os demais usuários
podem visualizar a foto, mas não podem alterá-la.

## Alterar o link “Falar com um especialista”

O botão está em:

`apps/web/app/page.tsx`

O endereço é lido de `public.site_branding.specialist_url` no Supabase. A
administradora mestre pode alterá-lo na tela “Sobre mim e contatos”; os demais
usuários têm acesso somente para leitura. O número deve ser escrito no formato
internacional, somente com dígitos, depois de `https://wa.me/`.

Se o Supabase estiver temporariamente indisponível, a página utiliza o endereço
de reserva existente em `apps/web/app/page.tsx`.

## Onde ficam os dados institucionais criados no site

Os textos de “Sobre mim e contatos”, o link do especialista e o endereço da
foto oficial ficam na linha `nalie-main` da tabela `public.site_branding`. A
imagem em si fica no bucket público `brand-assets`. Esses dados não dependem do
armazenamento local do navegador e não desaparecem ao trocar de computador.
