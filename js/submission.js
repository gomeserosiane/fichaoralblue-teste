(function () {
  const FormSubmission = {};

  function getValue(field) {
    if (!field) return '';
    if (field.type === 'checkbox') return field.checked;
    if (field.type === 'radio') return field.checked ? field.value : '';
    return (field.value || '').trim();
  }

  function getGroupValue(scope, name) {
    const fields = Array.from(scope.querySelectorAll(`[name="${name}"]`));
    if (!fields.length) return '';

    const radio = fields.find((field) => field.type === 'radio');
    if (radio) return fields.find((field) => field.checked)?.value || '';

    const checks = fields.filter((field) => field.type === 'checkbox' && field.checked).map((field) => field.value);
    if (checks.length) return checks;

    return fields.map(getValue).filter(Boolean);
  }

  function collectFieldPairs(scope) {
    const pairs = [];
    const handledNames = new Set();

    const fields = Array.from(scope.querySelectorAll('input, select, textarea'));
    fields.forEach((field) => {
      if (!field.offsetParent && field.type !== 'hidden') return;
      if (field.closest('.dependent-card')) return;

      const label = scope.querySelector(`label[for="${field.id}"]`) || field.closest('.form-group')?.querySelector('label');
      const key = field.id || field.name;
      if (!key) return;

      if (field.name && (field.type === 'radio' || field.type === 'checkbox')) {
        if (handledNames.has(field.name)) return;
        handledNames.add(field.name);
        const groupValue = getGroupValue(scope, field.name);
        if ((Array.isArray(groupValue) && !groupValue.length) || (!Array.isArray(groupValue) && !groupValue)) return;
        pairs.push({
          key: field.name,
          label: (label?.textContent || field.name).trim(),
          value: groupValue
        });
        return;
      }

      const value = getValue(field);
      if (value === '' || value === false) return;

      pairs.push({
        key,
        label: (label?.textContent || key).trim(),
        value
      });
    });

    return pairs;
  }

  function collectDependents(scope) {
    return Array.from(scope.querySelectorAll('.dependent-card')).map((card, index) => ({
      indice: index + 1,
      nome: card.querySelector('.dep-nome')?.value?.trim() || '',
      dataNascimento: card.querySelector('.dep-data, .dep-data-nascimento')?.value || '',
      nomeMae: card.querySelector('.dep-nome-mae')?.value?.trim() || '',
      cpf: card.querySelector('.dep-cpf')?.value?.trim() || '',
      sexo: card.querySelector('.dep-sexo')?.value || '',
      parentesco: card.querySelector('.dep-parentesco')?.value?.trim() || '',
      cns: card.querySelector('.dep-cns')?.value?.trim() || '',
      celular: card.querySelector('.dep-celular')?.value?.trim() || '',
      email: card.querySelector('.dep-email')?.value?.trim() || ''
    })).filter((dep) => Object.values(dep).some((value, idx) => idx === 0 ? false : Boolean(value)));
  }

  function getSignatureDataUrl(signaturePad) {
    if (!signaturePad || signaturePad.isEmpty()) return '';
    try {
      return signaturePad.canvas.toDataURL('image/png');
    } catch (error) {
      return '';
    }
  }

  function section(title, scope, extras = {}) {
    return {
      title,
      fields: collectFieldPairs(scope),
      ...extras
    };
  }

  function collectIndividualPayload() {
    const root = document.getElementById('container1');
    const plusSection = document.getElementById('container1Form2Section');
    const sections = [
      section('Dados do titular', document.getElementById('titularForm')),
      section('Pagamento do plano principal', document.getElementById('paymentSection1')),
      section('Local e data', document.getElementById('locationDateSection1')),
      section('Assinatura', document.getElementById('signatureSection1'))
    ];

    const dependents = collectDependents(root);
    if (dependents.length) {
      sections.push({ title: 'Dependentes do plano principal', dependents });
    }

    if (plusSection && !plusSection.hidden) {
      sections.push(
        section('Dados do titular - Mais Blue', document.getElementById('titularForm2')),
        section('Pagamento do plano Mais Blue', document.getElementById('paymentSection2'))
      );
      const plusDependents = collectDependents(plusSection);
      if (plusDependents.length) {
        sections.push({ title: 'Dependentes do plano Mais Blue', dependents: plusDependents });
      }
    }

    return {
      formType: 'individual',
      planName: plusSection && !plusSection.hidden ? 'Plano Individual / Familiar + Mais Blue' : 'Plano Individual / Familiar',
      customerName: document.getElementById('nomeTitular')?.value?.trim() || 'Titular não informado',
      customerEmail: document.getElementById('emailTitular')?.value?.trim() || '',
      customerDocument: document.getElementById('cpfTitular')?.value?.trim() || '',
      signatureDataUrl: getSignatureDataUrl(window.App?.signaturePad1),
      sections
    };
  }

  function collectBusinessPayload() {
    const plusSection = document.getElementById('container2Form2Section');
    const sections = [
      section('Dados da contratante', document.getElementById('contratanteForm')),
      section('Detalhes da contratação', document.getElementById('businessMetaSection')),
      section('Contributariedade e contratação', document.getElementById('businessDeclarationsSection')),
      section('Local e data', document.getElementById('locationDateSection2')),
      section('Assinatura', document.getElementById('signatureSection2'))
    ];

    if (plusSection && !plusSection.hidden) {
      sections.push(
        section('Dados da contratante - Mais Blue', document.getElementById('contratanteForm2')),
        section('Contributariedade e contratação - Mais Blue', document.getElementById('container2Form2Section'))
      );
    }

    return {
      formType: 'business',
      planName: plusSection && !plusSection.hidden ? 'Plano Empresarial / MEI + Mais Blue' : 'Plano Empresarial / MEI',
      customerName: document.getElementById('razaoSocial')?.value?.trim() || 'Empresa não informada',
      customerEmail: document.getElementById('emailContratante')?.value?.trim() || '',
      customerDocument: document.getElementById('cnpjMf')?.value?.trim() || '',
      signatureDataUrl: getSignatureDataUrl(window.App?.signaturePad2),
      sections
    };
  }

  function isLocalHtmlMode() {
    return window.location.protocol === 'file:';
  }

  function normalizeValue(value) {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    return value || '-';
  }

  function sanitizeFileName(value) {
    return String(value || 'proposta')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'proposta';
  }

  function buildLocalProposalHtml(payload) {
    const sections = (payload.sections || []).map((sectionItem) => {
      const rows = (sectionItem.fields || []).map((field) => `
        <tr>
          <th>${field.label}</th>
          <td>${normalizeValue(field.value)}</td>
        </tr>
      `).join('');

      const dependents = (sectionItem.dependents || []).map((dep) => `
        <div class="dependent">
          <h3>Dependente ${dep.indice}</h3>
          ${Object.entries(dep).filter(([key]) => key !== 'indice').map(([key, value]) => `<p><strong>${key}:</strong> ${normalizeValue(value)}</p>`).join('')}
        </div>
      `).join('');

      return `
        <section>
          <h2>${sectionItem.title}</h2>
          ${rows ? `<table>${rows}</table>` : ''}
          ${dependents}
        </section>
      `;
    }).join('');

    const signature = payload.signatureDataUrl ? `
      <section>
        <h2>Assinatura capturada no formulário</h2>
        <img class="signature" src="${payload.signatureDataUrl}" alt="Assinatura">
      </section>
    ` : '';

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Proposta Comercial - ${payload.customerName}</title>
<style>
  body{font-family:Arial,sans-serif;margin:32px;color:#1f2937;line-height:1.45} h1{color:#17324d;text-align:center} h2{color:#17324d;border-bottom:1px solid #dbe2ea;padding-bottom:6px} table{width:100%;border-collapse:collapse;margin:12px 0 24px} th,td{border:1px solid #dbe2ea;padding:8px;text-align:left;vertical-align:top} th{width:34%;background:#f8fafc}.box{border:1px solid #dbe2ea;border-radius:12px;padding:16px;margin:20px 0}.dependent{border:1px solid #dbe2ea;border-radius:8px;padding:12px;margin:10px 0}.signature{max-width:260px;max-height:110px;border:1px solid #dbe2ea;border-radius:8px;padding:8px}@media print{button{display:none}}
</style>
</head>
<body>
<h1>Proposta Comercial</h1>
<div class="box">
  <p><strong>Plano:</strong> ${payload.planName}</p>
  <p><strong>Cliente/Contratante:</strong> ${payload.customerName}</p>
  <p><strong>E-mail:</strong> ${payload.customerEmail || '-'}</p>
  <p><strong>CPF/CNPJ:</strong> ${payload.customerDocument || '-'}</p>
  <p><strong>Gerada em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
</div>
${sections}
${signature}
<p><em>Arquivo gerado localmente para conferência. O envio real para Assinafy e e-mail acontece somente quando o projeto está hospedado na Vercel ou executado por vercel dev.</em></p>
</body>
</html>`;
  }

  function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function submitLocalPreview(payload) {
    const filenameBase = `${sanitizeFileName(payload.formType)}-${sanitizeFileName(payload.customerName)}`;
    downloadTextFile(buildLocalProposalHtml(payload), `${filenameBase}-proposta-local.html`, 'text/html;charset=utf-8');

    return {
      success: true,
      localOnly: true,
      message: 'Modo local: proposta HTML baixada para conferência. Para enviar para Assinafy e e-mail, publique na Vercel ou rode com vercel dev.'
    };
  }

  async function submit(payload, triggerButton) {
    const button = triggerButton || null;
    const originalText = button?.textContent || '';

    if (button) {
      button.disabled = true;
      button.textContent = isLocalHtmlMode() ? 'Gerando prévia...' : 'Enviando...';
    }

    try {
      if (isLocalHtmlMode()) {
        return await submitLocalPreview(payload);
      }

      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.detail || result?.error || 'Falha ao enviar a proposta.');
      }

      return result;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  FormSubmission.collectIndividualPayload = collectIndividualPayload;
  FormSubmission.collectBusinessPayload = collectBusinessPayload;
  FormSubmission.submit = submit;

  window.FormSubmission = FormSubmission;
})();
