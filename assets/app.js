document.documentElement.classList.add('js');

const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (navLinks && !navLinks.querySelector('.mobile-nav-only')) {
  navLinks.insertAdjacentHTML(
    'beforeend',
    '<a class="mobile-nav-only" href="contact.html">Contact</a><a class="mobile-nav-only" href="quote.html">Request a quote</a>',
  );
}

if (menuButton) {
  menuButton.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  document.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', () => {
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  });
}

document.querySelectorAll('[data-year]').forEach((node) => {
  node.textContent = new Date().getFullYear();
});

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 })
  : null;

document.querySelectorAll('.reveal').forEach((node) => {
  if (observer) observer.observe(node);
  else node.classList.add('visible');
});

document.querySelectorAll('[data-enquiry-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const lines = [
      'Qinyi Printing project enquiry',
      '',
      ...Array.from(data.entries())
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([key, value]) => `${key}: ${value}`),
    ];
    const subject = encodeURIComponent(`Project enquiry: ${data.get('product') || 'Custom paper product'}`);
    const body = encodeURIComponent(lines.join('\n'));
    const status = form.querySelector('.form-status');

    if (status) {
      status.textContent = 'Your enquiry draft is ready. Your email application will open so you can review and send it.';
      status.classList.add('visible');
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: form.dataset.enquiryForm === 'quote' ? 'quote_submit' : 'contact_form_submit',
      product_type: data.get('product') || 'not specified',
    });

    window.location.href = `mailto:phello@qinyiprinting.com?subject=${subject}&body=${body}`;
  });
});

document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
  link.addEventListener('click', () => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'email_click' });
  });
});

document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
  link.addEventListener('click', () => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'phone_click' });
  });
});

document.querySelectorAll('[data-language]').forEach((select) => {
  select.addEventListener('change', () => {
    if (select.value !== 'en') {
      select.value = 'en';
      window.alert('This language edition is reserved for localized content and is not published yet.');
    }
  });
});

const SUPPORT_API = 'https://qinyi-ai-support-private-api.vercel.app';
const supportQuestions = [
  ['Product range', 'What products can Qinyi manufacture?'],
  ['Puzzle formats', 'Which puzzle sizes and piece counts are available?'],
  ['Materials', 'Which materials and thicknesses suit a premium puzzle?'],
  ['Packaging', 'What packaging options are available for gift puzzles?'],
  ['Games & cards', 'Can you manufacture custom board games and card decks?'],
  ['Artwork files', 'What artwork and dieline files should I prepare?'],
  ['Order quantity', 'What is the typical minimum order quantity?'],
  ['Samples & timing', 'How do samples and production lead times work?'],
  ['Print finishes', 'Which printing and surface finishes are available?'],
  ['Quote checklist', 'What details do you need to prepare a quote?'],
];

function supportId() {
  const key = 'qinyi-support-client-id';
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const value = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
      const random = Math.floor(Math.random() * 16);
      return (token === 'x' ? random : (random & 3) | 8).toString(16);
    });
    localStorage.setItem(key, value);
    return value;
  } catch (_error) {
    return `web-${Date.now()}`;
  }
}

const supportRoot = document.createElement('div');
supportRoot.className = 'ai-support';
supportRoot.innerHTML = `
  <button class="ai-support-launcher" type="button" aria-expanded="false" aria-controls="ai-support-panel">
    <span class="ai-support-launcher-mark" aria-hidden="true"></span>
    <span><strong>Ask Qinyi AI</strong><small>Product support</small></span>
  </button>
  <button class="ai-support-backdrop" type="button" aria-label="Close product support" tabindex="-1"></button>
  <section class="ai-support-panel" id="ai-support-panel" role="dialog" aria-label="Qinyi product support" aria-hidden="true">
    <header class="ai-support-header">
      <div><p>Qinyi product desk</p><h2>Ask about your project</h2><span class="ai-support-status"><i></i><span>Connecting</span></span></div>
      <div class="ai-support-header-actions">
        <button class="ai-support-new" type="button" title="Start a new conversation">New</button>
        <button class="ai-support-close" type="button" aria-label="Close product support" title="Close">&times;</button>
      </div>
    </header>
    <div class="ai-support-feed" role="log" aria-live="polite">
      <div class="ai-support-welcome">
        <p class="ai-support-kicker">Common product questions</p>
        <h3>What would you like to make?</h3>
        <p>Choose a topic or describe your product, quantity, market and required date.</p>
        <div class="ai-support-prompts"></div>
      </div>
    </div>
    <div class="ai-support-error" role="alert" hidden><span></span><button type="button">Retry</button></div>
    <form class="ai-support-composer">
      <label class="sr-only" for="ai-support-input">Ask a product question</label>
      <textarea id="ai-support-input" rows="1" maxlength="2000" placeholder="Ask about products, materials or packaging..." required></textarea>
      <button type="submit" aria-label="Send message" title="Send">&#8593;</button>
    </form>
    <p class="ai-support-note">Specifications, prices and lead times remain subject to project review.</p>
  </section>`;
document.body.appendChild(supportRoot);

const localSupportPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
if (localSupportPreview) {
  const frame = document.createElement('iframe');
  frame.className = 'ai-support-frame';
  frame.title = 'Qinyi AI product support';
  frame.src = 'https://nininininini979-tech.github.io/qinyi-ai-support-web/';
  frame.loading = 'eager';
  supportRoot.classList.add('uses-frame');
  supportRoot.querySelector('.ai-support-panel').appendChild(frame);
}

const support = {
  root: supportRoot,
  launcher: supportRoot.querySelector('.ai-support-launcher'),
  backdrop: supportRoot.querySelector('.ai-support-backdrop'),
  panel: supportRoot.querySelector('.ai-support-panel'),
  close: supportRoot.querySelector('.ai-support-close'),
  fresh: supportRoot.querySelector('.ai-support-new'),
  status: supportRoot.querySelector('.ai-support-status'),
  feed: supportRoot.querySelector('.ai-support-feed'),
  welcome: supportRoot.querySelector('.ai-support-welcome'),
  prompts: supportRoot.querySelector('.ai-support-prompts'),
  form: supportRoot.querySelector('.ai-support-composer'),
  input: supportRoot.querySelector('.ai-support-composer textarea'),
  send: supportRoot.querySelector('.ai-support-composer button'),
  error: supportRoot.querySelector('.ai-support-error'),
  retry: supportRoot.querySelector('.ai-support-error button'),
  frame: supportRoot.querySelector('.ai-support-frame'),
  pending: false,
  lastMessage: '',
  controller: null,
  sessionId: sessionStorage.getItem('qinyi-support-session-id'),
};

supportQuestions.forEach(([label, question]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = `<span>${label}</span><strong>${question}</strong>`;
  button.addEventListener('click', () => sendSupportMessage(question));
  support.prompts.appendChild(button);
});

function setSupportOpen(open) {
  support.root.classList.toggle('is-open', open);
  support.launcher.setAttribute('aria-expanded', String(open));
  support.panel.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('ai-support-open', open);
  if (open) {
    document.body.classList.remove('menu-open');
    if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
    window.setTimeout(() => support.input.focus(), 180);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'ai_support_open' });
  } else {
    support.launcher.focus();
  }
}

function createSupportMessage(role, text, data = {}) {
  const message = document.createElement('article');
  message.className = `ai-support-message ${role}`;
  const meta = document.createElement('span');
  meta.textContent = role === 'user' ? 'You' : 'Qinyi AI';
  const bubble = document.createElement('div');
  const copy = document.createElement('p');
  copy.textContent = text;
  bubble.appendChild(copy);
  if (Array.isArray(data.citations) && data.citations.length) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `Sources (${Math.min(data.citations.length, 5)})`;
    details.appendChild(summary);
    data.citations.slice(0, 5).forEach((citation) => {
      const item = document.createElement('p');
      item.textContent = typeof citation === 'string' ? citation : citation.title || citation.filename || citation.source || 'Qinyi product knowledge';
      details.appendChild(item);
    });
    bubble.appendChild(details);
  }
  message.append(meta, bubble);
  support.feed.appendChild(message);
  support.feed.scrollTop = support.feed.scrollHeight;
  return message;
}

function setSupportPending(pending) {
  support.pending = pending;
  support.input.disabled = pending;
  support.send.disabled = pending;
}

async function sendSupportMessage(rawMessage, appendUser = true) {
  const message = String(rawMessage || '').trim();
  if (!message || support.pending) return;
  support.lastMessage = message;
  support.error.hidden = true;
  support.welcome.hidden = true;
  if (appendUser) createSupportMessage('user', message);
  support.input.value = '';
  setSupportPending(true);
  const typing = createSupportMessage('assistant typing', 'Checking Qinyi product information...');
  support.controller = new AbortController();
  const timeout = window.setTimeout(() => support.controller.abort(), 45000);

  try {
    const payload = { message };
    if (support.sessionId) payload.sessionId = support.sessionId;
    const response = await fetch(`${SUPPORT_API}/api/support/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': supportId(), 'X-Demo-User-Id': 'demo-user-1', 'X-Tenant-Id': 'demo-tenant' },
      body: JSON.stringify(payload),
      signal: support.controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || 'Product support is temporarily unavailable.');
    if (data.sessionId) {
      support.sessionId = String(data.sessionId);
      sessionStorage.setItem('qinyi-support-session-id', support.sessionId);
    }
    typing.remove();
    createSupportMessage('assistant', data.answer || 'Please contact our team so we can confirm this detail.', data);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'ai_support_message' });
  } catch (error) {
    typing.remove();
    support.error.querySelector('span').textContent = error.name === 'AbortError' ? 'The response took too long. Please try again.' : error.message;
    support.error.hidden = false;
  } finally {
    window.clearTimeout(timeout);
    support.controller = null;
    setSupportPending(false);
    support.input.focus();
  }
}

function resetSupport() {
  if (support.controller) support.controller.abort();
  support.sessionId = null;
  sessionStorage.removeItem('qinyi-support-session-id');
  support.feed.querySelectorAll('.ai-support-message').forEach((node) => node.remove());
  support.welcome.hidden = false;
  support.error.hidden = true;
  setSupportPending(false);
  support.input.focus();
}

support.launcher.addEventListener('click', () => setSupportOpen(true));
support.close.addEventListener('click', () => setSupportOpen(false));
support.backdrop.addEventListener('click', () => setSupportOpen(false));
support.fresh.addEventListener('click', resetSupport);
support.fresh.addEventListener('click', () => {
  if (support.frame) support.frame.src = support.frame.src;
});
support.retry.addEventListener('click', () => sendSupportMessage(support.lastMessage, false));
support.form.addEventListener('submit', (event) => { event.preventDefault(); sendSupportMessage(support.input.value); });
support.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    support.form.requestSubmit();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && support.root.classList.contains('is-open')) setSupportOpen(false);
});

fetch(`${SUPPORT_API}/api/support/status`, { headers: { 'X-Client-Id': supportId(), 'X-Demo-User-Id': 'demo-user-1', 'X-Tenant-Id': 'demo-tenant' } })
  .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
  .then((data) => {
    support.status.classList.add(data.aiEnabled === false ? 'is-limited' : 'is-online');
    support.status.querySelector('span').textContent = data.aiEnabled === false ? 'Human support mode' : 'Online';
  })
  .catch(() => { support.status.querySelector('span').textContent = 'Status unavailable'; });
