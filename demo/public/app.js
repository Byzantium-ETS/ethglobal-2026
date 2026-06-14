const state = {
  page: 'landing',
  wallet: 'world',
  agentName: 'oracle-alpha',
  agentDisplay: 'Oracle Alpha',
  agentDesc: 'World verified price oracle for autonomous agents.',
  endpoint: 'http://127.0.0.1:3000/call',
  price: 0.001,
  trialTotal: 3,
  trialLeft: 3,
  caps: ['Price feeds', 'Risk checks'],
  calls: 0,
  spent: 0,
  lastJson: {},
};

const els = {
  pages: Array.from(document.querySelectorAll('.page')),
  navButtons: Array.from(document.querySelectorAll('[data-page]')),
  walletButtons: Array.from(document.querySelectorAll('.wallet-option')),
  connectButton: document.getElementById('connect-button'),
  agentName: document.getElementById('agent-name'),
  agentDisplay: document.getElementById('agent-display'),
  agentDesc: document.getElementById('agent-desc'),
  providerUrl: document.getElementById('provider-url'),
  agentPrice: document.getElementById('agent-price'),
  agentTrial: document.getElementById('agent-trial'),
  capButtons: Array.from(document.querySelectorAll('.cap-item')),
  registerButton: document.getElementById('register-button'),
  deployOverlay: document.getElementById('deploy-overlay'),
  deploySteps: Array.from(document.querySelectorAll('.deploy-step')),
  previewDisplay: document.getElementById('preview-display'),
  previewEns: document.getElementById('preview-ens'),
  previewDesc: document.getElementById('preview-desc'),
  previewCaps: document.getElementById('preview-caps'),
  previewPrice: document.getElementById('preview-price'),
  previewTrial: document.getElementById('preview-trial'),
  previewEndpoint: document.getElementById('preview-endpoint'),
  recordsPreview: document.getElementById('records-preview'),
  consoleName: document.getElementById('console-name'),
  consoleEns: document.getElementById('console-ens'),
  consoleCaps: document.getElementById('console-caps'),
  statCalls: document.getElementById('stat-calls'),
  statSpent: document.getElementById('stat-spent'),
  trialCount: document.getElementById('trial-count'),
  trialBar: document.getElementById('trial-bar'),
  trialMode: document.getElementById('trial-mode'),
  providerPill: document.getElementById('provider-pill'),
  providerBadge: document.querySelector('.badge-live'),
  healthButton: document.getElementById('health-button'),
  callState: document.getElementById('call-state'),
  chatWindow: document.getElementById('chat-window'),
  suggestChips: Array.from(document.querySelectorAll('.suggest-chip')),
  promptInput: document.getElementById('prompt-input'),
  callButton: document.getElementById('call-button'),
  activityFeed: document.getElementById('activity-feed'),
  responseJson: document.getElementById('response-json'),
  copyJson: document.getElementById('copy-json'),
  toast: document.getElementById('toast'),
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'agent';
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2400);
}

function showPage(page) {
  state.page = page;
  els.pages.forEach((item) => item.classList.toggle('active', item.id === `page-${page}`));

  if (page === 'console') {
    initConsole();
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}

function chipHtml(items) {
  return items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('');
}

function selectedCaps() {
  return els.capButtons
    .filter((button) => button.classList.contains('active'))
    .map((button) => button.dataset.cap);
}

function syncStateFromForm() {
  state.agentName = slugify(els.agentName.value);
  state.agentDisplay = els.agentDisplay.value.trim() || state.agentName;
  state.agentDesc = els.agentDesc.value.trim() || 'Verified AgentGate provider agent.';
  state.endpoint = els.providerUrl.value.trim() || 'http://127.0.0.1:3000/call';
  state.price = Number(els.agentPrice.value) || 0.001;
  state.trialTotal = Math.max(0, Number.parseInt(els.agentTrial.value, 10) || 0);
  state.trialLeft = Math.min(state.trialLeft, state.trialTotal);
  if (state.calls === 0) state.trialLeft = state.trialTotal;
  state.caps = selectedCaps();
}

function updatePreview() {
  syncStateFromForm();

  const ens = `${state.agentName}.agentgate.eth`;
  const endpointPath = (() => {
    try {
      return new URL(state.endpoint).pathname || '/call';
    } catch {
      return state.endpoint;
    }
  })();

  els.previewDisplay.textContent = state.agentDisplay;
  els.previewEns.textContent = ens;
  els.previewDesc.textContent = state.agentDesc;
  els.previewCaps.innerHTML = chipHtml(state.caps);
  els.previewPrice.textContent = `${state.price.toFixed(3)} USDC`;
  els.previewTrial.textContent = `${state.trialTotal} calls`;
  els.previewEndpoint.textContent = endpointPath;
  els.recordsPreview.textContent = [
    `description -> ${state.agentDesc}`,
    `io.agentgate.capabilities -> ${JSON.stringify(state.caps)}`,
    `io.agentgate.x402-endpoint -> ${state.endpoint}`,
    `io.agentgate.x402-price -> ${state.price.toFixed(3)}`,
    'io.agentgate.world-verified -> true',
  ].join('\n');
}

function setProviderHealth(kind, label) {
  els.providerPill.textContent = label;
  els.providerBadge.classList.remove('online', 'offline');
  if (kind) els.providerBadge.classList.add(kind);
}

function setCallState(label, kind = '') {
  els.callState.textContent = label;
  els.callState.className = `status-chip ${kind}`.trim();
}

function setJson(payload) {
  state.lastJson = payload;
  els.responseJson.textContent = JSON.stringify(payload, null, 2);
}

function addActivity(title, meta) {
  const item = document.createElement('div');
  item.className = 'activity-item';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  item.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(meta)} - ${time}</span>`;
  els.activityFeed.prepend(item);
}

function updateConsoleStats() {
  els.consoleName.textContent = state.agentDisplay;
  els.consoleEns.textContent = `${state.agentName}.agentgate.eth`;
  els.consoleCaps.innerHTML = chipHtml(state.caps);
  els.statCalls.textContent = String(state.calls);
  els.statSpent.textContent = state.spent.toFixed(3);

  const total = Math.max(1, state.trialTotal);
  const pct = Math.max(0, Math.min(100, (state.trialLeft / total) * 100));
  els.trialBar.style.width = `${pct}%`;
  els.trialCount.textContent = state.trialLeft > 0 ? `${state.trialLeft} calls left` : 'x402 active';
  els.trialMode.textContent = state.trialLeft > 0 ? 'World' : 'Arc';
}

function appendMessage(role, text, detail) {
  const article = document.createElement('article');
  article.className = `message message-${role}`;
  const avatar = role === 'agent'
    ? '<img src="/assets/agentgate-logo.png" alt="" />'
    : 'YOU';
  const detailHtml = detail
    ? `<div class="action-card"><strong>${escapeHtml(detail.title)}</strong><span>${escapeHtml(detail.body)}</span></div>`
    : '';

  article.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-body"><p>${escapeHtml(text)}</p>${detailHtml}</div>
  `;
  els.chatWindow.appendChild(article);
  els.chatWindow.scrollTop = els.chatWindow.scrollHeight;
}

function initConsole() {
  updatePreview();
  updateConsoleStats();

  if (els.chatWindow.children.length === 0) {
    appendMessage(
      'agent',
      `${state.agentDisplay} is live as ${state.agentName}.agentgate.eth.`,
      {
        title: 'ENS profile',
        body: `${state.caps.join(', ')} at ${state.price.toFixed(3)} USDC per paid call.`,
      },
    );
    addActivity('Agent online', `${state.agentName}.agentgate.eth`);
    setJson({});
  }
}

function responseStatus(result) {
  const body = result && typeof result.body === 'object' ? result.body : {};
  if (body.status) return body.status;
  if (result.status === 402 || body.accepts) return 'payment_required';
  if (result.status >= 500) return 'provider_unavailable';
  return 'unknown';
}

function responseCopy(result) {
  const status = responseStatus(result);
  const errors = Array.isArray(result.auth?.errors) ? result.auth.errors.filter(Boolean) : [];
  const errorText = errors.length ? errors.join(' ') : '';

  if (status === 'free_trial') {
    return {
      state: ['Free trial', 'success'],
      message: 'The provider accepted the World-backed trial call.',
      activity: 'World trial call',
      detail: result.auth?.worldProof === 'generated'
        ? 'AgentGate generated an AgentKit proof and attached it to the request.'
        : 'AgentGate attached the configured AgentKit proof to the request.',
    };
  }

  if (status === 'paid') {
    return {
      state: ['Paid call', 'success'],
      message: 'The provider accepted the x402 payment and processed the call.',
      activity: 'x402 paid call',
      detail: result.auth?.payment === 'sdk'
        ? `${state.price.toFixed(3)} USDC authorized through the SDK payment client.`
        : `${state.price.toFixed(3)} USDC authorized with the provided payment header.`,
    };
  }

  if (status === 'payment_required') {
    return {
      state: ['Payment required', 'warn'],
      message: 'The provider returned an x402 payment challenge.',
      activity: 'x402 challenge',
      detail: errorText || 'The next paid call can attach a payment header or use the SDK payment client.',
    };
  }

  return {
    state: ['Provider offline', 'error'],
    message: 'The provider is not reachable, so AgentGate kept the call in demo mode.',
    activity: 'Local demo fallback',
    detail: 'Start the provider server and send again when the backend is ready.',
  };
}

function callModeForPrompt(prompt) {
  if (/challenge/i.test(prompt)) return 'challenge';
  if (/paid|payment|x402|pay/i.test(prompt)) return 'paid';
  if (state.trialLeft > 0) return 'world';
  return 'paid';
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}

async function checkProvider() {
  setProviderHealth('', 'Checking provider');

  try {
    const url = `/api/health?providerUrl=${encodeURIComponent(state.endpoint)}`;
    const result = await (await fetch(url)).json();
    setJson({ health: result });

    if (result.status >= 200 && result.status < 500) {
      setProviderHealth('online', `Provider ${result.status}`);
      showToast('Provider reachable');
    } else {
      setProviderHealth('offline', 'Provider offline');
      showToast('Provider is not reachable yet');
    }
  } catch (error) {
    setProviderHealth('offline', 'Provider offline');
    setJson({ error: error instanceof Error ? error.message : String(error) });
  }
}

async function sendCall() {
  const prompt = els.promptInput.value.trim();
  if (!prompt) {
    showToast('Enter a prompt first');
    els.promptInput.focus();
    return;
  }

  appendMessage('user', prompt);
  els.promptInput.value = '';
  els.callButton.disabled = true;
  els.callButton.textContent = 'Sending';
  setCallState('Calling');

  const mode = callModeForPrompt(prompt);

  try {
    const result = await postJson('/api/call', {
      providerUrl: state.endpoint,
      prompt,
      mode,
    });
    setJson(result);
    const copy = responseCopy(result);
    setCallState(copy.state[0], copy.state[1]);
    appendMessage('agent', copy.message, { title: copy.activity, body: copy.detail });
    addActivity(copy.activity, `${state.agentName}.agentgate.eth`);

    const status = responseStatus(result);
    if (status === 'free_trial' && state.trialLeft > 0) {
      state.trialLeft -= 1;
    } else if (status === 'paid') {
      state.spent += state.price;
    } else if (status === 'provider_unavailable' && mode === 'world' && state.trialLeft > 0) {
      state.trialLeft -= 1;
    }
  } catch (error) {
    const payload = {
      ok: false,
      status: 502,
      body: { status: 'provider_unavailable' },
      error: error instanceof Error ? error.message : String(error),
    };
    setJson(payload);
    setCallState('Provider offline', 'error');
    appendMessage('agent', 'The provider is offline, so this stayed in local demo mode.', {
      title: 'Local demo fallback',
      body: 'The workflow remains usable while the backend catches up.',
    });
    addActivity('Local demo fallback', state.endpoint);
    if (mode === 'world' && state.trialLeft > 0) state.trialLeft -= 1;
  } finally {
    state.calls += 1;
    updateConsoleStats();
    els.callButton.disabled = false;
    els.callButton.textContent = 'Send';
  }
}

function runDeployFlow() {
  updatePreview();
  els.deployOverlay.classList.add('show');
  els.deployOverlay.setAttribute('aria-hidden', 'false');
  els.deploySteps.forEach((step) => {
    step.classList.remove('active', 'done');
  });

  let index = 0;
  const next = () => {
    els.deploySteps.forEach((step, stepIndex) => {
      step.classList.toggle('done', stepIndex < index);
      step.classList.toggle('active', stepIndex === index);
    });

    if (index >= els.deploySteps.length) {
      window.setTimeout(() => {
        els.deployOverlay.classList.remove('show');
        els.deployOverlay.setAttribute('aria-hidden', 'true');
        showToast(`${state.agentName}.agentgate.eth is live`);
        showPage('console');
      }, 300);
      return;
    }

    index += 1;
    window.setTimeout(next, 520);
  };

  next();
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.lastJson, null, 2));
    showToast('Response copied');
  } catch {
    showToast('Copy failed');
  }
}

els.navButtons.forEach((button) => {
  button.addEventListener('click', () => showPage(button.dataset.page));
});

els.walletButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.wallet = button.dataset.wallet;
    els.walletButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.querySelector('.wallet-check').textContent = selected ? 'OK' : '';
    });
  });
});

els.connectButton.addEventListener('click', () => {
  showToast('Identity connected');
  showPage('register');
});

[els.agentName, els.agentDisplay, els.agentDesc, els.providerUrl, els.agentPrice, els.agentTrial].forEach((input) => {
  input.addEventListener('input', updatePreview);
});

els.capButtons.forEach((button) => {
  button.addEventListener('click', () => {
    button.classList.toggle('active');
    button.querySelector('span').textContent = button.classList.contains('active') ? 'OK' : '';
    updatePreview();
  });
});

els.registerButton.addEventListener('click', runDeployFlow);
els.healthButton.addEventListener('click', checkProvider);
els.callButton.addEventListener('click', sendCall);
els.copyJson.addEventListener('click', copyJson);

els.suggestChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    els.promptInput.value = chip.textContent.trim();
    els.promptInput.focus();
  });
});

els.promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    sendCall();
  }
});

updatePreview();
