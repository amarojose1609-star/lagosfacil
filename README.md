# LagosFácil — base para publicação

O app já tem a interface conectada ao fluxo de anúncios, cadastro, login, fotos e reservas de temporada. A conexão real começa depois que você cria o projeto Supabase e configura a aplicação Marketplace no Mercado Pago.

## Serviços

1. Conta e projeto no Supabase: Auth, banco de dados, fotos e funções do servidor.
2. Aplicação no Mercado Pago Developers, configurada como Marketplace com OAuth, checkout e webhook.
3. Hospedagem HTTPS para o site. O projeto inclui publicação pelo GitHub Pages.

O Split 1:1 do Mercado Pago exige que cada proprietário autorize sua conta via OAuth e atenda às regras do provedor. O app aplica 15% do valor bruto da reserva como `marketplace_fee`; a tarifa do Mercado Pago é descontada antes do valor da comissão do marketplace. Confira sua elegibilidade, tarifas e prazo de crédito diretamente com o Mercado Pago antes de operar. [Documentação oficial](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/prerequisites)

## Configuração inicial

1. O projeto `lagosfacil` já foi criado no Supabase na região São Paulo, no plano gratuito.
2. As tabelas, regras de acesso e o bucket `property-photos` já foram criados pelo SQL Editor.
3. `site/config.js` já está preenchido com a URL e chave **publicável** deste projeto. Essa chave foi feita para uso no navegador e as tabelas têm RLS. Nunca adicione ao site a chave service role, Access Token ou Client Secret.
4. Crie uma aplicação Marketplace no Mercado Pago Developers. Use como URL de retorno OAuth: `https://laxmtpdvsmhcdotorsof.supabase.co/functions/v1/mp-oauth-callback`. A conta de vendedor que você já tem será a conta da plataforma; cada proprietário também conectará sua própria conta para receber sua parte.
5. Publique as funções de `supabase/functions/` como Supabase Edge Functions e configure os secrets descritos abaixo.
6. O site já está publicado em [LagosFácil](https://amarojose1609-star.github.io/lagosfacil/) e o repositório público está em [GitHub](https://github.com/amarojose1609-star/lagosfacil). O fluxo `.github/workflows/pages.yml` publica automaticamente a pasta `site/` quando há atualização na branch `main`. Configure o endereço Pages em `SITE_URL`, no Mercado Pago e na lista de redirecionamentos do Supabase Auth.
7. Cadastre o URL do webhook de pagamentos na aplicação Mercado Pago: `https://laxmtpdvsmhcdotorsof.supabase.co/functions/v1/mp-webhook`. Copie o segredo de assinatura gerado pelo Mercado Pago para o secret `MP_WEBHOOK_SECRET`.
8. Faça o fluxo completo com credenciais de teste do Mercado Pago antes de habilitar produção.

## Secrets do servidor

- `MP_CLIENT_ID` e `MP_CLIENT_SECRET`: aplicação Marketplace.
- `MP_REDIRECT_URI`: URL HTTPS da função `mp-oauth-callback`.
- `MP_PLATFORM_ACCESS_TOKEN`: token privado da conta da plataforma, para consultar pagamentos.
- `MP_WEBHOOK_SECRET`: segredo de assinatura dos webhooks.
- `OAUTH_STATE_SECRET`: segredo aleatório forte para proteger o retorno OAuth.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`: configuração do projeto (os secrets Supabase padrão podem já estar disponíveis nas funções).
- `SITE_URL`: endereço HTTPS publicado do site, sem `/` no final.

Cadastre esses valores nos secrets do projeto Supabase. Não os envie no chat.

## Como funciona

- Proprietário cria conta, cadastra o imóvel e envia foto; o anúncio aparece na busca compartilhada.
- Proprietário conecta a conta Mercado Pago pelo botão de conexão OAuth.
- Para temporada, cliente escolhe entrada e saída; o app calcula noites e cria um checkout com comissão de 15%.
- O webhook valida a assinatura e consulta o pagamento antes de atualizar a reserva.
- Para aluguel fixo, o botão do anúncio abre uma conversa no WhatsApp; pagamento mensal no app não está incluído.

Uma reserva pendente bloqueia aquelas datas para evitar dupla reserva. Se o cliente abandonar o checkout, o cancelamento da reserva pendente ainda precisa ser feito manualmente. Política de cancelamento, reembolso e atendimento precisam estar definidas antes de aceitar clientes.

## Arquivos principais

- `site/index.html` e `site/app.js`: interface de busca, cadastro/login, anúncios com fotos, contato por WhatsApp e reserva de temporada.
- `site/config.example.js`: exemplo da configuração pública Supabase.
- `supabase/schema.sql`: tabelas e políticas de acesso.
- `supabase/functions/`: autorização OAuth, checkout e webhook de pagamento.

## Estado neste momento

O site já está no ar e conectado ao Supabase, mas ainda não há anúncios reais cadastrados. O repositório também contém o pacote-fonte completo `lagosfacil-online.zip`. O projeto Supabase e a estrutura de dados foram configurados, e `site/config.js` contém somente a chave publicável. Quando os proprietários publicarem anúncios reais, eles aparecerão na busca compartilhada. As funções de pagamento não foram publicadas nem configuradas com uma aplicação Marketplace; o app ainda não recebe reservas ou pagamentos reais. Faltam criar a aplicação Marketplace, configurar os secrets, publicar as funções, validar o fluxo com credenciais de teste e preparar textos de privacidade e cancelamento.
