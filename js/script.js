const App = (() => {
  const toast = document.getElementById('toast');
  const locationModal = document.getElementById('locationModal');
  const confirmLocationBtn = document.getElementById('confirmLocationBtn');
  const cancelLocationBtn = document.getElementById('cancelLocationBtn');
  const copyDataModal = document.getElementById('copyDataModal');
  const confirmCopyDataBtn = document.getElementById('confirmCopyDataBtn');
  const cancelCopyDataBtn = document.getElementById('cancelCopyDataBtn');

  let activeDateTarget = null;
  let toastTimer = null;

  let alertState = {
    container1: { locationShown: false, copyPromptClosed: false },
    container2: { locationShown: false, billingShown: false, copyPromptClosed: false }
  };

  const cityByState = (address = {}) => (
    address.city || address.town || address.village || address.municipality || ''
  );

  /**

   * Exibe uma notificação temporária na tela para informar sucesso, erro ou aviso ao usuário.

   */

  function showToast(message, type = 'error') {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.className = 'toast';
    }, 3000);
  }

  /**

   * Abre ou fecha um modal controlando classes visuais e atributos de acessibilidade.

   */

  function setModalState(modal, isActive) {
    if (!modal) return;
    modal.classList.toggle('active', isActive);
    document.body.classList.toggle('modal-open', isActive);
  }

  /**

   * Padroniza interações de clique e toque para evitar eventos duplicados em mobile.

   */

  function bindResponsivePress(element, handler) {
    if (!element || typeof handler !== 'function') return;

    let lastTouchTime = 0;

    const runHandler = (event) => {
      handler(event);
    };

    if ('PointerEvent' in window) {
      element.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'mouse') return;
        lastTouchTime = Date.now();
        if (event.cancelable) event.preventDefault();
        runHandler(event);
      });
    } else {
      element.addEventListener('touchend', (event) => {
        lastTouchTime = Date.now();
        if (event.cancelable) event.preventDefault();
        runHandler(event);
      }, { passive: false });
    }

    element.addEventListener('click', (event) => {
      if (Date.now() - lastTouchTime < 500) return;
      runHandler(event);
    });
  }

  /**

   * Abre o modal que ajuda a preencher os campos de local e data automaticamente.

   */

  function openLocationModal(targetKey) {
    activeDateTarget = targetKey;
    setModalState(locationModal, true);
  }

  /**

   * Fecha o modal de local e data e limpa o alvo ativo do preenchimento.

   */

  function closeLocationModal() {
    activeDateTarget = null;
    setModalState(locationModal, false);
  }

  /**

   * Fecha o modal usado para confirmar a cópia de dados entre formulários.

   */

  function closeCopyDataModal() {
    setModalState(copyDataModal, false);
  }

  /**

   * Fecha todos os modais conhecidos da aplicação de uma só vez.

   */

  function closeAllKnownModals() {
    closeLocationModal();
    closeCopyDataModal();
    const billingModal = document.getElementById('billingModal');
    if (billingModal) setModalState(billingModal, false);
  }

  /**

   * Limpa os alertas já exibidos para um grupo específico ou para toda a aplicação.

   */

  function resetAlerts(scope = 'all') {
    if (scope === 'container1') {
      alertState.container1.locationShown = false;
      return;
    }
    if (scope === 'container2') {
      alertState.container2.locationShown = false;
      alertState.container2.billingShown = false;
      return;
    }
    alertState = {
      container1: { locationShown: false, copyPromptClosed: alertState.container1.copyPromptClosed },
      container2: { locationShown: false, billingShown: false, copyPromptClosed: alertState.container2.copyPromptClosed }
    };
  }

  /**

   * Verifica se um alerta específico já foi mostrado para evitar repetição.

   */

  function hasShownAlert(containerKey, alertKey) {
    return Boolean(alertState?.[containerKey]?.[alertKey]);
  }

  /**

   * Marca um alerta como já exibido dentro do controle interno da aplicação.

   */

  function markAlertShown(containerKey, alertKey) {
    if (!alertState[containerKey]) return;
    alertState[containerKey][alertKey] = true;
  }

  /**

   * Obtém data atual e tenta inferir a localidade do usuário para auto preenchimento.

   */

  async function getCurrentPlaceAndDate() {
    const now = new Date();
    const dateData = {
      dia: String(now.getDate()).padStart(2, '0'),
      mes: String(now.getMonth() + 1).padStart(2, '0'),
      ano: String(now.getFullYear())
    };

    if (!('geolocation' in navigator)) {
      return { cidade: '', uf: '', ...dateData };
    }

    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    }).catch(() => null);

    if (!position) {
      return { cidade: '', uf: '', ...dateData };
    }

    try {
      const { latitude, longitude } = position.coords;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=pt-BR`
      );
      const data = await response.json();
      const city = cityByState(data.address);
      const stateCode = (data.address.state_code || data.address.region_code || '').replace('BR-', '');
      return { cidade: city, uf: stateCode, ...dateData };
    } catch (error) {
      return { cidade: '', uf: '', ...dateData };
    }
  }

  /**

   * Preenche os campos de cidade, UF e data no formulário alvo selecionado.

   */

  function fillDateFields(targetKey, payload) {
    const map = {
      container1: ['cidadeAtual', 'ufAtual', 'diaAtual', 'mesAtual', 'anoAtual'],
      container2: ['cidadeAtual2', 'ufAtual2', 'diaAtual2', 'mesAtual2', 'anoAtual2']
    };
    const ids = map[targetKey];
    if (!ids) return;
    const [cidadeId, ufId, diaId, mesId, anoId] = ids;
    const cidade = document.getElementById(cidadeId);
    const uf = document.getElementById(ufId);
    const dia = document.getElementById(diaId);
    const mes = document.getElementById(mesId);
    const ano = document.getElementById(anoId);
    if (cidade) cidade.value = payload.cidade || '';
    if (uf) uf.value = payload.uf || '';
    if (dia) dia.value = payload.dia || '';
    if (mes) mes.value = payload.mes || '';
    if (ano) ano.value = payload.ano || '';
  }

  /**

   * Remove os destaques visuais de erro dos campos marcados como inválidos.

   */

  function clearInvalidMarks(scope) {
    if (!scope) return;
    scope.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
  }

  /**

   * Marca visualmente um campo ou bloco como inválido para orientar o usuário.

   */

  function markInvalid(element) {
    if (!element) return;
    element.classList.add('invalid');
  }

  /**

   * Valida se um valor possui conteúdo útil depois de remover espaços extras.

   */

  function isFilled(value) {
    return String(value || '').trim() !== '';
  }

  /**

   * Percorre uma lista de campos obrigatórios e marca os que estiverem vazios.

   */

  function validateInputs(ids = []) {
    const empty = [];
    ids.forEach((id) => {
      const field = document.getElementById(id);
      if (!field) return;
      if (!isFilled(field.value)) {
        markInvalid(field);
        empty.push(field);
      }
    });
    return empty;
  }

  /**

   * Valida se um grupo de radio possui uma opção selecionada.

   */

  function validateRadioGroup(name, wrapperSelector = null, scope = document) {
    const radios = Array.from(scope.querySelectorAll(`input[name="${name}"]`));
    if (!radios.length) return null;
    const hasChecked = radios.some((input) => input.checked);
    if (hasChecked) return null;
    const wrapper = wrapperSelector
      ? document.querySelector(wrapperSelector)
      : radios[0].closest('.choice-group, .radio-inline-group, .whatsapp-box, .form-group');
    markInvalid(wrapper);
    return wrapper;
  }

  /**

   * Valida se pelo menos um checkbox do grupo foi marcado.

   */

  function validateCheckboxGroup(name, wrapperSelector = null, scope = document) {
    const checks = Array.from(scope.querySelectorAll(`input[name="${name}"]`));
    if (!checks.length) return null;
    const hasChecked = checks.some((input) => input.checked);
    if (hasChecked) return null;
    const wrapper = wrapperSelector
      ? document.querySelector(wrapperSelector)
      : checks[0].closest('.choice-group, .checkbox-inline-group, .form-group');
    markInvalid(wrapper);
    return wrapper;
  }

  /**

   * Gera uma imagem do container informado usando html2canvas e dispara o download.

   */

  async function captureContainer(element, filename) {
    document.body.classList.add('screenshot-mode');
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: element.scrollHeight
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename;
      link.click();
    } finally {
      document.body.classList.remove('screenshot-mode');
    }
  }

  /**

   * Aplica uma máscara de formatação dinâmica enquanto o usuário digita.

   */

  function addMask(input, formatter) {
    if (!input || typeof formatter !== 'function') return;
    input.addEventListener('input', (event) => {
      event.target.value = formatter(event.target.value);
    });
  }

  /**

   * Remove tudo que não for número de uma string para facilitar máscaras e validações.

   */

  function numeric(value) {
    return String(value || '').replace(/\D/g, '');
  }

  const formatters = {
    cep: (value) => {
      const digits = numeric(value).slice(0, 8);
      return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    },
    cpf: (value) => {
      const digits = numeric(value).slice(0, 11);
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    },
    cnpj: (value) => {
      const digits = numeric(value).slice(0, 14);
      return digits
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    },
    phone: (value) => {
      const digits = numeric(value).slice(0, 11);
      if (digits.length <= 10) {
        return digits
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      }
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
  };

  /**

   * Consulta a API do ViaCEP e devolve os dados do endereço do CEP informado.

   */

  async function fetchViaCep(cep) {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();
    if (data.erro) throw new Error('CEP não encontrado');
    return data;
  }

  /**

   * Inicializa a área de assinatura digital e devolve seus controles principais.

   */

  function setupSignature(canvasId, boxId) {
    const canvas = document.getElementById(canvasId);
    const box = document.getElementById(boxId);
    if (!canvas || !box) return null;

    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasSignature = false;
    let lastPoint = null;
    let resizeObserver = null;

    /**

     * Calcula a altura visual do canvas de assinatura com fallback seguro.

     */

    function getCssHeight() {
      const height = parseFloat(getComputedStyle(canvas).height);
      return Number.isFinite(height) && height > 0 ? height : 180;
    }

    /**

     * Redesenha a assinatura anterior no canvas após um redimensionamento.

     */

    function redrawFromDataUrl(dataUrl, width, height) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = dataUrl;
    }

    /**

     * Ajusta o tamanho real do canvas de assinatura preservando o desenho existente.

     */

    function resizeCanvas(force = false) {
      const rect = box.getBoundingClientRect();
      if (!force && (!rect.width || !rect.height)) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const cssWidth = Math.max(rect.width || box.clientWidth || 0, 1);
      const cssHeight = Math.max(getCssHeight(), 140);
      const previousImage = hasSignature ? canvas.toDataURL() : null;

      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111827';
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      if (previousImage) {
        redrawFromDataUrl(previousImage, cssWidth, cssHeight);
      }
    }

    /**

     * Converte a posição do mouse ou toque para a coordenada correta dentro do canvas.

     */

    function getPosition(event) {
      const rect = canvas.getBoundingClientRect();
      if (event.touches && event.touches.length > 0) {
        return {
          x: event.touches[0].clientX - rect.left,
          y: event.touches[0].clientY - rect.top
        };
      }
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }

    /**

     * Inicia o traço da assinatura quando o usuário começa a desenhar.

     */

    function startDrawing(event) {
      event.preventDefault();
      if (!canvas.width || !canvas.height) resizeCanvas(true);
      drawing = true;
      lastPoint = getPosition(event);
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(lastPoint.x + 0.01, lastPoint.y + 0.01);
      ctx.stroke();
      hasSignature = true;
      box.classList.remove('invalid');
    }

    /**

     * Continua desenhando a assinatura enquanto o ponteiro se move.

     */

    function draw(event) {
      if (!drawing) return;
      event.preventDefault();
      const pos = getPosition(event);
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPoint = pos;
      hasSignature = true;
    }

    /**

     * Encerra o desenho da assinatura e finaliza o traço atual.

     */

    function stopDrawing(event) {
      if (event) event.preventDefault();
      drawing = false;
      lastPoint = null;
      ctx.closePath();
    }

    /**

     * Limpa completamente a assinatura desenhada no canvas.

     */

    function clear() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width || canvas.width, rect.height || canvas.height);
      hasSignature = false;
      box.classList.remove('invalid');
    }

    /**

     * Informa se a área de assinatura ainda está vazia.

     */

    function isEmpty() {
      return !hasSignature;
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    window.addEventListener('touchend', stopDrawing, { passive: false });
    canvas.addEventListener('touchcancel', stopDrawing, { passive: false });

    window.addEventListener('resize', () => resizeCanvas(true));
    window.addEventListener('orientationchange', () => resizeCanvas(true));

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => resizeCanvas(true));
      resizeObserver.observe(box);
    }

    requestAnimationFrame(() => resizeCanvas(true));

    return { canvas, box, clear, isEmpty, resize: () => resizeCanvas(true) };
  }


  /**


   * Melhora a usabilidade dos campos e labels em desktop e dispositivos touch.


   */


  function setupInteractiveFields(scope = document) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;

    const prefersTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const textSelectors = 'input:not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea';
    const choiceSelectors = 'input[type="radio"], input[type="checkbox"]';

    const focusField = (field, preserveScroll = false) => {
      if (!field || field.disabled || typeof field.focus !== 'function') return;
      if (preserveScroll) {
        try { field.focus({ preventScroll: true }); return; } catch (error) {}
      }
      field.focus();
    };

    const activateChoice = (field) => {
      if (!field || field.disabled) return;

      if (field.type === 'radio') {
        if (!field.checked) field.checked = true;
      } else if (field.type === 'checkbox') {
        field.checked = !field.checked;
      }

      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    };

    scope.querySelectorAll(textSelectors).forEach((field) => {
      if (field.dataset.interactiveBound === 'true') return;
      field.dataset.interactiveBound = 'true';
      field.setAttribute('autocomplete', field.getAttribute('autocomplete') || 'off');

      if (prefersTouch) {
        const focusOnTouch = () => focusField(field, false);
        field.addEventListener('touchend', focusOnTouch, { passive: true });
        field.addEventListener('click', focusOnTouch);
        return;
      }

      const focusDesktopField = () => {
        window.requestAnimationFrame(() => {
          focusField(field, true);
        });
      };

      field.addEventListener('pointerdown', focusDesktopField);
      field.addEventListener('click', focusDesktopField);
    });

    scope.querySelectorAll(choiceSelectors).forEach((field) => {
      if (field.dataset.choiceInteractiveBound === 'true') return;
      field.dataset.choiceInteractiveBound = 'true';

      if (!prefersTouch) return;

      field.addEventListener('touchend', (event) => {
        if (event.cancelable) event.preventDefault();
        activateChoice(field);
      }, { passive: false });

      field.addEventListener('click', (event) => {
        if (event.detail === 0) return;
        event.preventDefault();
        activateChoice(field);
      });
    });

    scope.querySelectorAll('label').forEach((label) => {
      if (label.dataset.interactiveBound === 'true') return;
      label.dataset.interactiveBound = 'true';

      const activate = (event) => {
        if (prefersTouch && event.target && event.target.closest && event.target.closest(choiceSelectors)) return;

        const input = label.querySelector('input[type="radio"], input[type="checkbox"]');
        const forId = label.getAttribute('for');
        const target = input || (forId ? document.getElementById(forId) : null);
        if (!target || target.disabled) return;

        if (target.matches('input[type="radio"], input[type="checkbox"]')) {
          if (event.target === target && !prefersTouch) return;
          if (prefersTouch) {
            if (event.cancelable) event.preventDefault();
            activateChoice(target);
            return;
          }
          target.click();
          return;
        }

        if (prefersTouch) {
          focusField(target, false);
          return;
        }

        focusField(target, true);
      };

      if (prefersTouch) {
        label.addEventListener('touchend', activate, { passive: false });
      }

      label.addEventListener('click', activate);
    });
  }

  const signaturePad1 = setupSignature('signatureCanvas1', 'signatureBox1');
  const signaturePad2 = setupSignature('signatureCanvas2', 'signatureBox2');

  setupInteractiveFields(document);

  /**

   * Redimensiona novamente as áreas de assinatura quando necessário.

   */

  function refreshSignaturePads() {
    if (signaturePad1) signaturePad1.resize();
    if (signaturePad2) signaturePad2.resize();
  }

  document.querySelectorAll('.signature-clear-btn').forEach((button) => {
    bindResponsivePress(button, () => {
      const target = button.dataset.signature;
      if (target === '1' && signaturePad1) signaturePad1.clear();
      if (target === '2' && signaturePad2) signaturePad2.clear();
    });
  });

  if (confirmLocationBtn) {
    bindResponsivePress(confirmLocationBtn, async () => {
      const payload = await getCurrentPlaceAndDate();
      fillDateFields(activeDateTarget, payload);
      closeLocationModal();
      showToast('Campos de local e data atualizados.', 'success');
    });
  }

  if (cancelLocationBtn) {
    bindResponsivePress(cancelLocationBtn, closeLocationModal);
  }

  /**

   * Verifica se o formulário base já possui dados para reaproveitar no segundo bloco.

   */

  function sourceGroupHasData(groupKey) {
    const targetForm = document.querySelector(`.form-copy-target[data-copy-group="${groupKey}"]`);
    if (!targetForm) return false;

    const sourceIds = new Set();
    const sourceRadioNames = new Set();

    targetForm.querySelectorAll('[data-copy-from]').forEach((field) => {
      const source = field.dataset.copyFrom;
      if (!source) return;
      if (field.type === 'radio' || field.type === 'checkbox') {
        sourceRadioNames.add(source);
      } else {
        sourceIds.add(source);
      }
    });

    for (const id of sourceIds) {
      const sourceField = document.getElementById(id);
      if (sourceField && isFilled(sourceField.value)) return true;
    }

    for (const name of sourceRadioNames) {
      if (document.querySelector(`input[name="${name}"]:checked`)) return true;
    }

    if (groupKey === 'container1') {
      const sourceDependentCards = Array.from(document.querySelectorAll('#dependentesContainer .dependent-card'));
      if (sourceDependentCards.some((card) => Array.from(card.querySelectorAll('input, select, textarea')).some((field) => {
        if (field.type === 'radio' || field.type === 'checkbox') return field.checked;
        return isFilled(field.value);
      }))) {
        return true;
      }

      if (document.querySelector('#paymentSection1 .payment-toggle.active')) return true;
    }

    return false;
  }

  /**

   * Ativa visualmente a forma de pagamento selecionada e exibe seu painel.

   */

  function setPaymentSelection(scopeElement, targetId = null) {
    if (!scopeElement) return;
    const buttons = Array.from(scopeElement.querySelectorAll('.payment-toggle'));
    const cards = Array.from(scopeElement.querySelectorAll('.payment-card'));
    buttons.forEach((btn) => btn.classList.remove('active'));
    cards.forEach((card) => card.classList.remove('active'));
    if (!targetId) return;

    const button = buttons.find((btn) => btn.dataset.target === targetId);
    const card = cards.find((item) => item.id === targetId);
    if (button) button.classList.add('active');
    if (card) card.classList.add('active');
  }

  /**

   * Configura os botões de seleção e o controle dos painéis de pagamento.

   */

  function setupPaymentToggle(scopeSelector) {
    const scopeElement = document.querySelector(scopeSelector);
    if (!scopeElement) {
      return {
        scopeElement: null,
        getActivePanel: () => null,
        setActiveById: () => {}
      };
    }

    const buttons = scopeElement.querySelectorAll('.payment-toggle');
    buttons.forEach((button) => {
      bindResponsivePress(button, () => {
        const targetId = button.dataset.target;
        const targetCard = scopeElement.querySelector(`#${targetId}`);
        if (!targetCard) return;
        const alreadyActive = targetCard.classList.contains('active');
        setPaymentSelection(scopeElement, alreadyActive ? null : targetId);
      });
    });

    return {
      scopeElement,
      getActivePanel: () => Array.from(scopeElement.querySelectorAll('.payment-card')).find((card) => card.classList.contains('active')) || null,
      setActiveById: (targetId) => setPaymentSelection(scopeElement, targetId)
    };
  }

  const dependentTemplate = document.getElementById('dependentTemplate');
  const dependentFieldBindings = [
    ['.dep-cpf', formatters.cpf],
    ['.dep-celular', formatters.phone]
  ];

  /**

   * Adiciona comportamentos, máscaras e ações a um card de dependente criado dinamicamente.

   */

  function enhanceDependentCard(card) {
    if (!card) return;
    dependentFieldBindings.forEach(([selector, formatter]) => {
      addMask(card.querySelector(selector), formatter);
    });
  }

  /**

   * Gerencia a área que cria, remove e renomeia dependentes do formulário.

   */

  function setupDependentSection({ buttonId, containerId }) {
    const button = document.getElementById(buttonId);
    const container = document.getElementById(containerId);

    /**

     * Atualiza a numeração dos cards de dependentes exibidos na tela.

     */

    function updateTitles() {
      if (!container) return;
      container.querySelectorAll('.dependent-card').forEach((card, index) => {
        const title = card.querySelector('.dependent-title');
        if (title) title.textContent = `Dependente ${String(index + 1).padStart(2, '0')}`;
      });
    }

    /**

     * Cria um novo card de dependente a partir do template HTML.

     */

    function addDependent(prefill = null) {
      if (!dependentTemplate || !container) return null;
      const fragment = dependentTemplate.content.cloneNode(true);
      const card = fragment.querySelector('.dependent-card');
      if (!card) return null;
      container.appendChild(fragment);
      const appendedCard = container.lastElementChild;
      enhanceDependentCard(appendedCard);
      setupInteractiveFields(appendedCard);
      if (prefill) {
        Object.entries(prefill).forEach(([selector, value]) => {
          const field = appendedCard.querySelector(selector);
          if (field) field.value = value || '';
        });
      }
      updateTitles();
      return appendedCard;
    }

    if (button) bindResponsivePress(button, () => addDependent());

    if (container) {
      const handleRemoveDependent = (event) => {
        const removeButton = event.target.closest('.remove-dependent-btn');
        if (!removeButton) return;
        if (event.cancelable) event.preventDefault();
        removeButton.closest('.dependent-card')?.remove();
        updateTitles();
      };

      if ('PointerEvent' in window) {
        container.addEventListener('pointerup', (event) => {
          if (event.pointerType === 'mouse') return;
          handleRemoveDependent(event);
        });
      } else {
        container.addEventListener('touchend', handleRemoveDependent, { passive: false });
      }

      container.addEventListener('click', handleRemoveDependent);
    }

    return {
      button,
      container,
      addDependent,
      updateTitles,
      clear() {
        if (!container) return;
        container.innerHTML = '';
      },
      getCards() {
        return container ? Array.from(container.querySelectorAll('.dependent-card')) : [];
      }
    };
  }

  /**

   * Captura os dados atuais dos dependentes para permitir cópia entre formulários.

   */

  function getDependentSnapshot(card) {
    return {
      '.dep-nome': card.querySelector('.dep-nome')?.value || '',
      '.dep-data-nascimento': card.querySelector('.dep-data-nascimento')?.value || '',
      '.dep-nome-mae': card.querySelector('.dep-nome-mae')?.value || '',
      '.dep-cpf': card.querySelector('.dep-cpf')?.value || '',
      '.dep-sexo': card.querySelector('.dep-sexo')?.value || '',
      '.dep-parentesco': card.querySelector('.dep-parentesco')?.value || '',
      '.dep-cns': card.querySelector('.dep-cns')?.value || '',
      '.dep-celular': card.querySelector('.dep-celular')?.value || '',
      '.dep-email': card.querySelector('.dep-email')?.value || ''
    };
  }

  /**

   * Replica dependentes do formulário principal para o formulário Mais Blue.

   */

  function syncContainer1Dependents() {
    const sourceManager = dependentManagers.primary;
    const targetManager = dependentManagers.secondary;
    if (!sourceManager?.container || !targetManager?.container) return;

    targetManager.clear();
    sourceManager.getCards().forEach((card) => {
      targetManager.addDependent(getDependentSnapshot(card));
    });
    targetManager.updateTitles();
  }

  /**

   * Replica a forma de pagamento e seus dados para o segundo formulário.

   */

  function syncContainer1Payment() {
    const activeSourcePanel = paymentController1.getActivePanel();
    if (!activeSourcePanel) {
      paymentController2.setActiveById(null);
      return;
    }
    paymentController2.setActiveById(`${activeSourcePanel.id}2`);
  }

  /**

   * Copia dados de um grupo de formulário para outro com base nos atributos data-copy-from.

   */

  function copyFormGroup(groupKey) {
    const targetForm = document.querySelector(`.form-copy-target[data-copy-group="${groupKey}"]`);
    if (!targetForm) return false;

    targetForm.querySelectorAll('[data-copy-from]').forEach((field) => {
      const source = field.dataset.copyFrom;
      if (!source) return;

      if (field.type === 'radio') {
        const selected = document.querySelector(`input[name="${source}"]:checked`);
        field.checked = Boolean(selected && selected.value === field.value);
        return;
      }

      if (field.type === 'checkbox') {
        const checkedValues = Array.from(document.querySelectorAll(`input[name="${source}"]:checked`)).map((input) => input.value);
        field.checked = checkedValues.includes(field.value);
        return;
      }

      const sourceField = document.getElementById(source);
      if (sourceField) {
        field.value = sourceField.value || '';
      }
    });

    if (groupKey === 'container1') {
      syncContainer1Dependents();
      syncContainer1Payment();
    }

    return true;
  }

  /**

   * Abre o modal perguntando se o usuário quer reaproveitar os dados já preenchidos.

   */

  function openCopyPrompt(groupKey) {
    if (!copyDataModal) return;
    copyDataModal.dataset.group = groupKey;
    setModalState(copyDataModal, true);
  }

  /**

   * Reseta o estado do aviso de cópia ligado ao fluxo Mais Blue.

   */

  function clearPlusBluePrompt(groupKey) {
    const groupState = alertState[groupKey];
    if (!groupState?.plusBluePromptTimeout) return;
    clearTimeout(groupState.plusBluePromptTimeout);
    groupState.plusBluePromptTimeout = null;
  }

  /**

   * Mostra ou oculta um elemento atualizando display, hidden e aria-hidden.

   */

  function setElementVisibility(element, shouldShow) {
    if (!element) return;
    element.hidden = !shouldShow;
    element.style.display = shouldShow ? '' : 'none';
    element.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  }

  /**

   * Agenda a abertura do prompt de cópia quando o fluxo Mais Blue for ativado.

   */

  function schedulePlusBluePrompt(groupKey) {
    const groupState = alertState[groupKey];
    if (!groupState) return;

    clearPlusBluePrompt(groupKey);

    if (hasShownAlert(groupKey, 'copyPromptClosed')) return;
    if (!sourceGroupHasData(groupKey)) return;

    groupState.plusBluePromptTimeout = window.setTimeout(() => {
      groupState.plusBluePromptTimeout = null;
      if (hasShownAlert(groupKey, 'copyPromptClosed')) return;
      if (!sourceGroupHasData(groupKey)) return;
      openCopyPrompt(groupKey);
    }, 1000);
  }

  /**

   * Controla a exibição do segundo formulário quando o usuário escolhe aderir ao Mais Blue.

   */

  function setupPlusBlueToggle({ groupKey, yesId, noId, sectionId }) {
    const yesInput = document.getElementById(yesId);
    const noInput = document.getElementById(noId);
    const section = document.getElementById(sectionId);
    if (!yesInput || !section) return;

    setElementVisibility(section, Boolean(yesInput.checked));

    yesInput.addEventListener('change', () => {
      if (!yesInput.checked) return;
      setElementVisibility(section, true);
      schedulePlusBluePrompt(groupKey);
      requestAnimationFrame(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    if (noInput) {
      noInput.addEventListener('change', () => {
        if (!noInput.checked) return;
        clearPlusBluePrompt(groupKey);
        setElementVisibility(section, false);
      });
    }
  }


  const cepInput = document.getElementById('cepTitular');
  const enderecoInput = document.getElementById('enderecoTitular');
  const bairroInput = document.getElementById('bairroTitular');
  const complementoInput = document.getElementById('complementoTitular');
  const submitFormBtns = Array.from(document.querySelectorAll('#submitFormBtn1, .submit-form-btn'));
  const container1 = document.getElementById('container1');
  const dependentManagers = {
    primary: setupDependentSection({ buttonId: 'addDependentBtn', containerId: 'dependentesContainer' }),
    secondary: setupDependentSection({ buttonId: 'addDependentBtn2', containerId: 'dependentesContainer2' })
  };
  const paymentController1 = setupPaymentToggle('#paymentSection1');
  const paymentController2 = setupPaymentToggle('#paymentSection1Form2');

  if (cepInput) {
    addMask(cepInput, formatters.cep);
    cepInput.addEventListener('blur', async () => {
      const cep = numeric(cepInput.value);
      if (cep.length !== 8) return;
      try {
        const data = await fetchViaCep(cep);
        if (enderecoInput) enderecoInput.value = data.logradouro || '';
        if (bairroInput) bairroInput.value = data.bairro || '';
        if (complementoInput) complementoInput.value = data.complemento || '';
      } catch (error) {
        showToast('Não foi possível localizar o CEP informado.');
      }
    });
  }

  document.querySelectorAll('.auto-date-trigger').forEach((input) => {
    input.addEventListener('focus', () => {
      if (!hasShownAlert('container1', 'locationShown')) {
        markAlertShown('container1', 'locationShown');
        openLocationModal('container1');
      }
    });
  });

  [['cpfTitular', formatters.cpf], ['telefoneTitular', formatters.phone], ['celularTitular', formatters.phone], ['cpfTitular2', formatters.cpf], ['telefoneTitular2', formatters.phone], ['celularTitular2', formatters.phone], ['cepTitular2', formatters.cep]].forEach(([id, formatter]) => {
    addMask(document.getElementById(id), formatter);
  });

  const cepInput2 = document.getElementById('cepTitular2');
  const enderecoInput2 = document.getElementById('enderecoTitular2');
  const bairroInput2 = document.getElementById('bairroTitular2');
  const complementoInput2 = document.getElementById('complementoTitular2');

  if (cepInput2) {
    cepInput2.addEventListener('blur', async () => {
      const cep = numeric(cepInput2.value);
      if (cep.length !== 8) return;
      try {
        const data = await fetchViaCep(cep);
        if (enderecoInput2) enderecoInput2.value = data.logradouro || '';
        if (bairroInput2) bairroInput2.value = data.bairro || '';
        if (complementoInput2) complementoInput2.value = data.complemento || '';
      } catch (error) {
        showToast('Não foi possível localizar o CEP informado no segundo formulário.');
      }
    });
  }

  setupPlusBlueToggle({ groupKey: 'container1', yesId: 'maisBlueContainer1Sim', noId: 'maisBlueContainer1Nao', sectionId: 'container1Form2Section' });

  /**

   * Retorna o painel de pagamento ativo do formulário individual principal.

   */

  function getActivePaymentPanel() {
    return paymentController1.getActivePanel();
  }

  /**

   * Retorna o painel de pagamento ativo do formulário individual Mais Blue.

   */

  function getActivePaymentPanel2() {
    return paymentController2.getActivePanel();
  }

  /**

   * Valida o formulário individual completo, incluindo o bloco Mais Blue quando ele estiver visível.

   */

  function validateContainer1() {
    if (!container1) return false;
    clearInvalidMarks(container1);
    const requiredIds = [
      'nomeTitular', 'nomeMaeTitular', 'dataNascimentoTitular', 'profissaoTitular', 'localTrabalhoTitular',
      'matriculaTitular', 'rgTitular', 'orgaoEmissorTitular', 'cpfTitular', 'cnsTitular', 'telefoneTitular',
      'celularTitular', 'emailTitular', 'cepTitular', 'enderecoTitular', 'numeroTitular', 'bairroTitular',
      'complementoTitular', 'cidadeAtual', 'ufAtual', 'diaAtual', 'mesAtual', 'anoAtual'
    ];
    validateInputs(requiredIds);
    validateRadioGroup('whatsapp', null, container1);

    const activePayment = getActivePaymentPanel();
    if (!activePayment) {
      showToast('Selecione uma forma de pagamento antes de enviar.');
      return false;
    }

    if (activePayment.id === 'boletoCard') {
      validateRadioGroup('vencimentoBoleto', '#boletoCard .radio-inline-group', container1);
    }
    if (activePayment.id === 'cartaoCard') {
      validateInputs(['nomeCartao', 'numeroCartao', 'validadeCartao', 'cvvCartao']);
    }
    if (activePayment.id === 'debitoCard') {
      validateInputs(['nomeBanco', 'codBanco', 'agenciaBanco', 'contaCorrente']);
    }
    if (activePayment.id === 'folhaCard') {
      validateInputs(['matriculaFolha', 'orgaoFolha']);
      const hasTipoOrgao = container1.querySelectorAll('input[name="tipoOrgao"]').length > 0;
      const hasFolhaEscolha = container1.querySelectorAll('input[name="folhaEscolha"]').length > 0;
      if (hasTipoOrgao) {
        validateCheckboxGroup('tipoOrgao', '#folhaCard .checkbox-inline-group', container1);
      } else if (hasFolhaEscolha) {
        validateCheckboxGroup('folhaEscolha', '#folhaCard .checkbox-inline-group', container1);
      }
    }

    const plusBlueSection = document.getElementById('container1Form2Section');
    const isPlusBlueVisible = plusBlueSection && !plusBlueSection.hidden;

    if (isPlusBlueVisible) {
      const requiredIds2 = [
        'nomeTitular2', 'nomeMaeTitular2', 'dataNascimentoTitular2', 'profissaoTitular2', 'localTrabalhoTitular2',
        'matriculaTitular2', 'rgTitular2', 'orgaoEmissorTitular2', 'cpfTitular2', 'cnsTitular2', 'telefoneTitular2',
        'celularTitular2', 'emailTitular2', 'cepTitular2', 'enderecoTitular2', 'numeroTitular2', 'bairroTitular2',
        'complementoTitular2'
      ];
      validateInputs(requiredIds2);
      validateRadioGroup('whatsapp2', null, container1);

      const activePayment2 = getActivePaymentPanel2();
      if (!activePayment2) {
        showToast('Selecione uma forma de pagamento do plano Mais Blue antes de enviar.');
        return false;
      }

      if (activePayment2.id === 'boletoCard2') {
        validateRadioGroup('vencimentoBoleto2', '#boletoCard2 .radio-inline-group', container1);
      }
      if (activePayment2.id === 'cartaoCard2') {
        validateInputs(['nomeCartao2', 'numeroCartao2', 'validadeCartao2', 'cvvCartao2']);
      }
      if (activePayment2.id === 'debitoCard2') {
        validateInputs(['nomeBanco2', 'codBanco2', 'agenciaBanco2', 'contaCorrente2']);
      }
      if (activePayment2.id === 'folhaCard2') {
        validateInputs(['matriculaFolha2', 'orgaoFolha2']);
        validateCheckboxGroup('tipoOrgao2', '#folhaCard2 .checkbox-inline-group', container1);
      }
    }

    const invalidElement = container1.querySelector('.invalid');
    if (invalidElement) {
      invalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Preencha todos os campos obrigatórios do formulário antes de enviar.');
      return false;
    }

    if (signaturePad1 && signaturePad1.isEmpty()) {
      signaturePad1.box.classList.add('invalid');
      signaturePad1.box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Faça a assinatura digital antes de enviar o formulário.');
      return false;
    }
    return true;
  }

  submitFormBtns.forEach((button) => {
    bindResponsivePress(button, async (event) => {
      if (event?.cancelable) event.preventDefault();
      if (!validateContainer1()) return;
      try {
        const payload = window.FormSubmission?.collectIndividualPayload?.();
        if (!payload) throw new Error('Não foi possível montar os dados da proposta.');
        const result = await window.FormSubmission.submit(payload, button);
        showToast(result?.message || 'Proposta enviada com sucesso para assinatura e notificação.', 'success');
      } catch (error) {
        showToast(error?.message || 'Não foi possível enviar a proposta.');
      }
    });
  });

  if (confirmCopyDataBtn) {
    bindResponsivePress(confirmCopyDataBtn, () => {
      const groupKey = copyDataModal?.dataset.group;
      if (!groupKey) return;
      copyFormGroup(groupKey);
      markAlertShown(groupKey, 'copyPromptClosed');
      closeCopyDataModal();
      showToast('Os dados do primeiro formulário foram reaproveitados no novo formulário.', 'success');
    });
  }

  if (cancelCopyDataBtn) {
    bindResponsivePress(cancelCopyDataBtn, () => {
      const groupKey = copyDataModal?.dataset.group;
      if (groupKey) markAlertShown(groupKey, 'copyPromptClosed');
      closeCopyDataModal();
    });
  }

  return {
    showToast,
    setModalState,
    openLocationModal,
    closeLocationModal,
    closeAllKnownModals,
    clearInvalidMarks,
    validateInputs,
    validateRadioGroup,
    validateCheckboxGroup,
    captureContainer,
    addMask,
    formatters,
    numeric,
    fetchViaCep,
    isFilled,
    resetAlerts,
    hasShownAlert,
    markAlertShown,
    sourceGroupHasData,
    copyFormGroup,
    openCopyPrompt,
    setupPlusBlueToggle,
    closeCopyDataModal,
    bindResponsivePress,
    setupInteractiveFields,
    signaturePad1,
    signaturePad2,
    refreshSignaturePads
  };
})();
