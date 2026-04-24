// Configuração do envio automático via Vercel Serverless Function.
// O PDF é gerado e enviado pelo backend Python em /api/send-email.
window.PDF_EMAIL_CONFIG = {
  endpoint: '/api/send-email',
  extraRecipients: []
};
