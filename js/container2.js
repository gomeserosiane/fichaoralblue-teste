const initialContainer = document.getElementById('initialContainer');
const container1 = document.getElementById('container1');
const container2 = document.getElementById('container2');

const openExistingContainerBtn =
  document.getElementById('openExistingContainerBtn') ||
  document.getElementById('openContainer1Btn');

const openContainer2Btn = document.getElementById('openContainer2Btn');

const homeButtons = document.querySelectorAll('.go-home-btn, .btn-voltar-inicial');
const switchButtons = document.querySelectorAll('.btn-alternar-formulario');

const switchToContainer2 = document.getElementById('switchToContainer2');
const switchToContainer1 = document.getElementById('switchToContainer1');

const submitFormBtn2 = document.getElementById('submitFormBtn2');

const billingModal = document.getElementById('billingModal');
const confirmBillingBtn = document.getElementById('confirmBillingBtn');
const cancelBillingBtn = document.getElementById('cancelBillingBtn');

const enderecoCorrespondencia = document.getElementById('enderecoCorrespondencia');
const enderecoFaturamento = document.getElementById('enderecoFaturamento');
const cepContratante = document.getElementById('cepContratante');
const cidadeContratante = document.getElementById('cidadeContratante');
const estadoContratante = document.getElementById('estadoContratante');
const complementoContratante = document.getElementById('complementoContratante');

/**

 * Padroniza interações de clique e toque no formulário empresarial.

 */

function bindPress(element, handler) {
  if (!element || typeof handler !== 'function') return;
  if (typeof App?.bindResponsivePress === 'function') {
    App.bindResponsivePress(element, handler);
    return;
  }

  let touchTriggered = false;

  element.addEventListener('click', (event) => {
    if (touchTriggered) {
      touchTriggered = false;
      return;
    }
    handler(event);
  });

  element.addEventListener('touchend', (event) => {
    touchTriggered = true;
    if (event.cancelable) event.preventDefault();
    handler(event);
  }, { passive: false });
}

/**

 * Fecha o modal que sugere copiar o endereço de correspondência para faturamento.

 */

function closeBillingModal() {
  App.setModalState(billingModal, false);
}

/**

 * Abre o modal de confirmação para reaproveitar o endereço de correspondência.

 */

function openBillingModal() {
  App.setModalState(billingModal, true);
}

/**

 * Limpa alertas e modais antes de trocar entre as telas do projeto.

 */

function resetNavigationState() {
  App.resetAlerts('all');
  App.closeAllKnownModals();
  closeBillingModal();
}

/**

 * Ativa ou desativa visualmente um container específico da aplicação.

 */

function setContainerState(section, isActive) {
  if (!section) return;
  section.hidden = !isActive;
  section.style.display = isActive ? '' : 'none';
  section.classList.toggle('is-active', isActive);
  section.setAttribute('aria-hidden', isActive ? 'false' : 'true');
}

/**

 * Exibe apenas o container desejado e oculta os demais.

 */

function showOnly(target) {
  [initialContainer, container1, container2].forEach((section) => {
    setContainerState(section, section === target);
  });

  requestAnimationFrame(() => {
    App.refreshSignaturePads();
  });

  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    window.scrollTo(0, 0);
  }
}

/**

 * Centraliza a navegação entre a home e os dois formulários principais.

 */

function goTo(target) {
  resetNavigationState();
  showOnly(target);
}

if (openExistingContainerBtn) {
  bindPress(openExistingContainerBtn, () => {
    goTo(container1);
  });
}

if (openContainer2Btn) {
  bindPress(openContainer2Btn, () => {
    goTo(container2);
  });
}

homeButtons.forEach((button) => {
  bindPress(button, () => {
    goTo(initialContainer);
  });
});

switchButtons.forEach((button) => {
  bindPress(button, () => {
    const current = button.dataset.current;

    if (current === 'container1') {
      goTo(container2);
      return;
    }

    if (current === 'container2') {
      goTo(container1);
    }
  });
});

if (switchToContainer2) {
  bindPress(switchToContainer2, () => {
    goTo(container2);
  });
}

if (switchToContainer1) {
  bindPress(switchToContainer1, () => {
    goTo(container1);
  });
}

App.addMask(document.getElementById('cepContratante'), App.formatters.cep);
App.addMask(document.getElementById('cnpjMf'), App.formatters.cnpj);
App.addMask(document.getElementById('telefoneContratante'), App.formatters.phone);
App.addMask(document.getElementById('celularContratante'), App.formatters.phone);
App.addMask(document.getElementById('cepContratante2'), App.formatters.cep);
App.addMask(document.getElementById('cnpjMf2'), App.formatters.cnpj);
App.addMask(document.getElementById('telefoneContratante2'), App.formatters.phone);
App.addMask(document.getElementById('celularContratante2'), App.formatters.phone);

if (cepContratante) {
  cepContratante.addEventListener('blur', async () => {
    const cep = App.numeric(cepContratante.value);
    if (cep.length !== 8) return;

    try {
      const data = await App.fetchViaCep(cep);

      if (enderecoCorrespondencia) enderecoCorrespondencia.value = data.logradouro || '';
      if (cidadeContratante) cidadeContratante.value = data.localidade || '';
      if (estadoContratante) estadoContratante.value = data.uf || '';
      if (complementoContratante) complementoContratante.value = data.complemento || '';
    } catch (error) {
      App.showToast('Não foi possível localizar o CEP da contratante.');
    }
  });
}

const enderecoCorrespondencia2 = document.getElementById('enderecoCorrespondencia2');
const cepContratante2 = document.getElementById('cepContratante2');
const cidadeContratante2 = document.getElementById('cidadeContratante2');
const estadoContratante2 = document.getElementById('estadoContratante2');
const complementoContratante2 = document.getElementById('complementoContratante2');
const container2Form2Section = document.getElementById('container2Form2Section');

if (cepContratante2) {
  cepContratante2.addEventListener('blur', async () => {
    const cep = App.numeric(cepContratante2.value);
    if (cep.length !== 8) return;

    try {
      const data = await App.fetchViaCep(cep);

      if (enderecoCorrespondencia2) enderecoCorrespondencia2.value = data.logradouro || '';
      if (cidadeContratante2) cidadeContratante2.value = data.localidade || '';
      if (estadoContratante2) estadoContratante2.value = data.uf || '';
      if (complementoContratante2) complementoContratante2.value = data.complemento || '';
    } catch (error) {
      App.showToast('Não foi possível localizar o CEP da contratante no segundo formulário.');
    }
  });
}

App.setupPlusBlueToggle({ groupKey: 'container2', yesId: 'maisBlueContainer2Sim', noId: 'maisBlueContainer2Nao', sectionId: 'container2Form2Section' });
App.setupInteractiveFields(document);

showOnly(initialContainer);

if (enderecoFaturamento) {
  enderecoFaturamento.addEventListener('focus', () => {
    const hasCorrespondencia = enderecoCorrespondencia && App.isFilled(enderecoCorrespondencia.value);
    const alreadyShown = App.hasShownAlert('container2', 'billingShown');

    if (hasCorrespondencia && !alreadyShown) {
      App.markAlertShown('container2', 'billingShown');
      openBillingModal();
    }
  });
}

if (confirmBillingBtn) {
  bindPress(confirmBillingBtn, () => {
    if (enderecoFaturamento && enderecoCorrespondencia) {
      enderecoFaturamento.value = enderecoCorrespondencia.value;
    }

    closeBillingModal();
    App.showToast('Endereço de faturamento preenchido com os dados de correspondência.', 'success');
  });
}

if (cancelBillingBtn) {
  bindPress(cancelBillingBtn, () => {
    closeBillingModal();
  });
}

document.querySelectorAll('.auto-date-trigger-2').forEach((input) => {
  input.addEventListener('focus', () => {
    if (!App.hasShownAlert('container2', 'locationShown')) {
      App.markAlertShown('container2', 'locationShown');
      App.openLocationModal('container2');
    }
  });
});

/**

 * Valida todos os campos obrigatórios do formulário empresarial antes do envio.

 */

function validateContainer2() {
  if (!container2) return false;

  App.clearInvalidMarks(container2);

  const requiredIds = [
    'razaoSocial',
    'cnpjMf',
    'inscricaoEstadual',
    'inscricaoMunicipal',
    'enderecoCorrespondencia',
    'cepContratante',
    'cidadeContratante',
    'estadoContratante',
    'complementoContratante',
    'enderecoFaturamento',
    'telefoneContratante',
    'celularContratante',
    'emailContratante',
    'dataAdesao',
    'dataPagamentoMensalidade',
    'percTitularContrib',
    'percDependenteContrib',
    'percTitularContratacao',
    'percDependenteContratacao',
    'cidadeAtual2',
    'ufAtual2',
    'diaAtual2',
    'mesAtual2',
    'anoAtual2'
  ];

  App.validateInputs(requiredIds);
  App.validateRadioGroup('portabilidade', null, container2);
  App.validateRadioGroup('contributariedade', null, container2);
  App.validateRadioGroup('contratacaoTipo', null, container2);

  const invalidElement = container2.querySelector('.invalid');
  if (invalidElement) {
    invalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    App.showToast('Preencha todos os campos obrigatórios do formulário empresarial antes de enviar.');
    return false;
  }

  if (App.signaturePad2 && App.signaturePad2.isEmpty()) {
    App.signaturePad2.box.classList.add('invalid');
    App.signaturePad2.box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    App.showToast('Faça a assinatura digital antes de enviar o formulário empresarial.');
    return false;
  }

  return true;
}

if (submitFormBtn2) {
  bindPress(submitFormBtn2, async (event) => {
    if (event?.cancelable) event.preventDefault();
    if (!validateContainer2()) return;

    try {
      await App.generatePremiumPdf(container2, {
        title: 'Ficha Empresarial / MEI',
        filename: 'ficha-empresarial-mei.pdf',
        headerSelector: '#container2 .header-image',
        plusBlueSelected: !!document.getElementById('maisBlueContainer2Sim')?.checked,
        plusBlueHeaderSelector: '#container2Form2Section img',
        plusBlueSectionSelector: '#container2Form2Section'
      });
      App.showToast('PDF do formulário empresarial gerado com sucesso.', 'success');
    } catch (error) {
      App.showToast('Não foi possível gerar o PDF do formulário empresarial.');
    }
  });
}
