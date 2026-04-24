const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Belem'
  }).format(date);
}

function sanitizeFileName(value = 'proposta') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'proposta';
}

function dataUrlToBuffer(dataUrl = '') {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return Buffer.from(match[2], 'base64');
}

function flattenSectionsToHtml(sections = []) {
  return sections.map((section) => {
    const fieldRows = (section.fields || []).map((field) => `
      <tr>
        <td style="padding:8px;border:1px solid #dbe2ea;font-weight:600;vertical-align:top;">${field.label}</td>
        <td style="padding:8px;border:1px solid #dbe2ea;vertical-align:top;">${Array.isArray(field.value) ? field.value.join(', ') : field.value}</td>
      </tr>
    `).join('');

    const dependentBlocks = (section.dependents || []).map((dependent) => `
      <div style="margin-bottom:12px;padding:12px;border:1px solid #dbe2ea;border-radius:8px;">
        <strong>Dependente ${dependent.indice}</strong><br>
        ${Object.entries(dependent).filter(([key]) => key !== 'indice').map(([key, value]) => `${key}: ${value || '-'}`).join('<br>')}
      </div>
    `).join('');

    return `
      <section style="margin-bottom:24px;">
        <h2 style="font-size:18px;margin:0 0 12px;color:#17324d;">${section.title}</h2>
        ${fieldRows ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">${fieldRows}</table>` : ''}
        ${dependentBlocks}
      </section>
    `;
  }).join('');
}

function buildEmailHtml(payload, assinafySummary = {}) {
  const docId = assinafySummary.documentId || '-';
  const signerId = assinafySummary.signerId || '-';

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5;">
      <h1 style="margin-bottom:8px;color:#0f172a;">Novo cadastro recebido</h1>
      <p style="margin-top:0;">Uma nova proposta foi enviada pelo formulário e encaminhada para assinatura via Assinafy.</p>
      <p><strong>Tipo:</strong> ${payload.formType === 'business' ? 'Empresarial / MEI' : 'Individual / Familiar'}</p>
      <p><strong>Plano:</strong> ${payload.planName}</p>
      <p><strong>Nome:</strong> ${payload.customerName}</p>
      <p><strong>E-mail:</strong> ${payload.customerEmail || '-'}</p>
      <p><strong>Documento:</strong> ${payload.customerDocument || '-'}</p>
      <p><strong>Recebido em:</strong> ${formatDateTime()}</p>
      <p><strong>ID do documento na Assinafy:</strong> ${docId}</p>
      <p><strong>ID do signatário:</strong> ${signerId}</p>
      ${flattenSectionsToHtml(payload.sections)}
    </div>
  `;
}

function createPdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#17324d').text('Proposta Comercial', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#334155').text(`Plano: ${payload.planName}`, { align: 'center' });
    doc.text(`Tipo: ${payload.formType === 'business' ? 'Empresarial / MEI' : 'Individual / Familiar'}`, { align: 'center' });
    doc.text(`Emitido em: ${formatDateTime()}`, { align: 'center' });
    doc.moveDown();

    doc.roundedRect(doc.x, doc.y, 515, 70, 10).strokeColor('#cbd5e1').stroke();
    doc.fillColor('#0f172a').fontSize(12).text(`Cliente/Contratante: ${payload.customerName}`, 50, doc.y - 60);
    doc.text(`E-mail: ${payload.customerEmail || '-'}`);
    doc.text(`CPF/CNPJ: ${payload.customerDocument || '-'}`);
    doc.moveDown(1.5);

    (payload.sections || []).forEach((section) => {
      if (doc.y > 700) doc.addPage();
      doc.fontSize(14).fillColor('#17324d').text(section.title, { underline: true });
      doc.moveDown(0.4);

      (section.fields || []).forEach((field) => {
        const value = Array.isArray(field.value) ? field.value.join(', ') : field.value;
        doc.fontSize(10).fillColor('#111827').text(`${field.label}: `, { continued: true }).fillColor('#475569').text(value || '-');
      });

      (section.dependents || []).forEach((dependent) => {
        doc.moveDown(0.3);
        doc.fontSize(11).fillColor('#0f172a').text(`Dependente ${dependent.indice}`);
        Object.entries(dependent).forEach(([key, value]) => {
          if (key === 'indice') return;
          doc.fontSize(9).fillColor('#475569').text(`${key}: ${value || '-'}`);
        });
      });

      doc.moveDown();
    });

    const signatureBuffer = dataUrlToBuffer(payload.signatureDataUrl);
    if (signatureBuffer) {
      if (doc.y > 620) doc.addPage();
      doc.moveDown();
      doc.fontSize(12).fillColor('#17324d').text('Assinatura capturada no formulário');
      doc.image(signatureBuffer, { fit: [220, 90], align: 'left' });
      doc.moveDown();
    }

    doc.fontSize(10).fillColor('#64748b').text(
      'Documento gerado automaticamente para envio à plataforma Assinafy e assinatura jurídica do gerente responsável.',
      { align: 'left' }
    );

    doc.end();
  });
}

function createTransporterFromEnv() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

async function sendNotificationEmail(payload, pdfBuffer, fileName, assinafySummary) {
  const transporter = createTransporterFromEnv();
  if (!transporter) {
    return { skipped: true, reason: 'SMTP não configurado.' };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const notificationEmail = process.env.NOTIFICATION_EMAIL || 'gomeserosiane.dev@gmail.com';

  await transporter.sendMail({
    from,
    to: notificationEmail,
    subject: `[Novo Cadastro] ${payload.customerName} - ${payload.planName}`,
    html: buildEmailHtml(payload, assinafySummary),
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });

  return { sent: true, to: notificationEmail };
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(url) {
  return (url || 'https://api.assinafy.com.br/v1').replace(/\/$/, '');
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

async function assinafyFetch(path, options = {}) {
  const baseUrl = normalizeBaseUrl(process.env.ASSINAFY_BASE_URL);
  const apiKey = getRequiredEnv('ASSINAFY_API_KEY');

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'X-Api-Key': apiKey,
      ...(options.headers || {})
    }
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText || 'Falha na API da Assinafy';
    throw new Error(`Assinafy ${response.status}: ${message}`);
  }

  return payload;
}

async function uploadDocumentToAssinafy(pdfBuffer, fileName) {
  const accountId = getRequiredEnv('ASSINAFY_ACCOUNT_ID');
  const form = new FormData();
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  form.append('file', blob, fileName);

  const payload = await assinafyFetch(`/accounts/${accountId}/documents`, {
    method: 'POST',
    body: form
  });

  const documentId = payload?.data?.id || payload?.id;
  if (!documentId) {
    throw new Error('Assinafy não retornou o ID do documento após upload.');
  }

  return {
    documentId,
    raw: payload
  };
}

function extractSignerIdFromList(payload, desiredEmail) {
  const normalizedEmail = (desiredEmail || '').trim().toLowerCase();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const match = rows.find((item) => (item?.email || '').trim().toLowerCase() === normalizedEmail);
  return match?.id || null;
}

async function findExistingSignerId(accountId, signerEmail) {
  const query = new URLSearchParams({ search: signerEmail, 'per-page': '100' }).toString();
  const payload = await assinafyFetch(`/accounts/${accountId}/signers?${query}`, {
    method: 'GET'
  });

  return extractSignerIdFromList(payload, signerEmail);
}

async function createOrReuseSigner(accountId, signerName, signerEmail) {
  try {
    const payload = await assinafyFetch(`/accounts/${accountId}/signers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: signerName,
        email: signerEmail
      })
    });

    const signerId = payload?.data?.id || payload?.id;
    if (!signerId) {
      throw new Error('Assinafy não retornou o ID do signatário.');
    }

    return { signerId, raw: payload, reused: false };
  } catch (error) {
    const existingId = await findExistingSignerId(accountId, signerEmail);
    if (!existingId) throw error;
    return { signerId: existingId, raw: null, reused: true };
  }
}

async function createAssignment(documentId, signerId) {
  const payload = await assinafyFetch(`/documents/${documentId}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'virtual',
      signerIds: [signerId]
    })
  });

  return payload;
}

async function sendToAssinafy(payload, pdfBuffer, fileName) {
  const accountId = getRequiredEnv('ASSINAFY_ACCOUNT_ID');
  const signerName = process.env.ASSINAFY_MANAGER_NAME || 'Gerente da empresa';
  const signerEmail = getRequiredEnv('ASSINAFY_MANAGER_EMAIL');

  const upload = await uploadDocumentToAssinafy(pdfBuffer, fileName);
  const signer = await createOrReuseSigner(accountId, signerName, signerEmail);
  const assignment = await createAssignment(upload.documentId, signer.signerId);

  return {
    sent: true,
    documentId: upload.documentId,
    signerId: signer.signerId,
    signerReused: signer.reused,
    document: upload.raw,
    assignment
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método não permitido.' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!payload || !payload.formType || !payload.customerName || !Array.isArray(payload.sections)) {
      return json(res, 400, { error: 'Payload inválido para geração da proposta.' });
    }

    const fileName = `${sanitizeFileName(payload.formType)}-${sanitizeFileName(payload.customerName)}.pdf`;
    const pdfBuffer = await createPdfBuffer(payload);

    const assinafyResult = await sendToAssinafy(payload, pdfBuffer, fileName);
    const emailResult = await sendNotificationEmail(payload, pdfBuffer, fileName, assinafyResult);

    return json(res, 200, {
      success: true,
      message: 'Proposta enviada com sucesso para a Assinafy e notificação disparada por e-mail.',
      email: emailResult,
      assinafy: {
        sent: assinafyResult.sent,
        documentId: assinafyResult.documentId,
        signerId: assinafyResult.signerId,
        signerReused: assinafyResult.signerReused
      }
    });
  } catch (error) {
    return json(res, 500, {
      error: 'Erro interno ao processar a proposta.',
      detail: error.message
    });
  }
};
