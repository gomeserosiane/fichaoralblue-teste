# Envio automático de ficha por PDF - Vercel + Python + Gmail SMTP

Este projeto foi atualizado para funcionar assim:

```txt
Formulário HTML/JS
↓
POST para /api/send-email
↓
Python gera o PDF
↓
Python envia via Gmail SMTP
↓
Email chega com PDF anexado
```

## Arquivos principais alterados/adicionados

- `js/script.js`: coleta os dados visíveis do formulário e envia para `/api/send-email`.
- `js/email-config.js`: permite definir emails extras no front-end.
- `api/send-email.py`: função Python serverless da Vercel que gera o PDF e envia o email.
- `requirements.txt`: dependências Python usadas pela função serverless.
- `/api/send-email.py`: a Vercel detecta automaticamente como Python Function.
- `.env.example`: modelo das variáveis de ambiente necessárias.

## Variáveis de ambiente na Vercel

Configure em **Vercel > Project > Settings > Environment Variables**:

```env
EMAIL_USER=seuemail@gmail.com
EMAIL_PASSWORD=sua_senha_de_app_do_gmail
EMAIL_TO=gomeserosiane.dev@gmail.com
EMAIL_EXTRA_TO=
EMAIL_FROM_NAME=Ficha Oral Blue
```

## Gmail

Use uma **senha de app do Gmail**, não a senha normal da conta.

O email enviado terá a mensagem:

```txt
Novo cadastro! Nome: NOME_PREENCHIDO e CPF/CNPJ: DOCUMENTO_PREENCHIDO
```

O PDF completo vai anexado ao email.

## Emails extras

Para enviar também para outros emails, edite `js/email-config.js`:

```js
window.PDF_EMAIL_CONFIG = {
  endpoint: '/api/send-email',
  extraRecipients: ['outro@email.com']
};
```

Também é possível configurar emails extras pela variável `EMAIL_EXTRA_TO` na Vercel, separados por vírgula.
