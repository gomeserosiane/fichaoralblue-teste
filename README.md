# Oralblue Formulários

Projeto HTML/CSS/JS com backend serverless Node.js para Vercel.

## Como funciona

### Abrindo o `index.html` direto no navegador
O formulário abre normalmente e o botão **Enviar formulário** gera uma prévia local da proposta em HTML para conferência.

Nesse modo local (`file://`), o navegador não tem backend, então ele **não envia para a Assinafy** e **não dispara e-mail**. Isso é proposital para não expor chaves SMTP/API no front-end.

### Rodando na Vercel ou com `vercel dev`
O botão **Enviar formulário** chama `/api/submit-form` e executa o fluxo real:

1. gera PDF da proposta no backend;
2. envia o PDF para a Assinafy;
3. cria ou reaproveita o signatário do gerente;
4. cria o assignment de assinatura virtual;
5. envia e-mail de notificação com os dados completos e o PDF em anexo.

## Fluxo Assinafy implementado

- `POST /accounts/{account_id}/documents`
- `POST /accounts/{account_id}/signers`
- `GET /accounts/{account_id}/signers?search=...`
- `POST /documents/{document_id}/assignments`

Autenticação via header `X-Api-Key`.

## Variáveis de ambiente

Cadastre estas variáveis na Vercel em **Project Settings > Environment Variables**.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_de_app_do_gmail
SMTP_FROM="Novo cadastro <seu_email@gmail.com>"
SMTP_SECURE=true
NOTIFICATION_EMAIL=gomeserosiane.dev@gmail.com

ASSINAFY_API_KEY=sua_api_key_da_assinafy
ASSINAFY_BASE_URL=https://sandbox.assinafy.com.br/v1
ASSINAFY_ACCOUNT_ID=seu_workspace_account_id
ASSINAFY_MANAGER_NAME=Nome do Gerente
ASSINAFY_MANAGER_EMAIL=email_do_gerente@empresa.com
```

Para produção, troque:

```env
ASSINAFY_BASE_URL=https://api.assinafy.com.br/v1
```

## Teste local simulando Vercel

```bash
npm install
vercel dev
```

Depois acesse o endereço local exibido pela CLI, geralmente:

```text
http://localhost:3000
```

## Deploy

O projeto é estático com function em `/api`, então não precisa de framework nem build especial.

1. suba o projeto para GitHub ou envie pela CLI da Vercel;
2. configure as variáveis de ambiente;
3. faça redeploy;
4. teste o formulário publicado.

## Importante

Não coloque chaves reais em `.env.example`, GitHub ou arquivos públicos. Use somente as variáveis protegidas da Vercel.
