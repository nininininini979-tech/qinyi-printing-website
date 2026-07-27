document.documentElement.classList.add('js');

const i18n = window.QINYI_I18N || { locale: 'en', messages: {}, rootAlias: false };
const t = (key, variables = {}) => {
  const template = i18n.messages[key] || key;
  return Object.entries(variables).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, replacement),
    template,
  );
};
const languages = [
  ['en', 'English'], ['zh-CN', '中文'], ['es', 'Español'], ['de', 'Deutsch'],
  ['fr', 'Français'], ['ja', '日本語'], ['ko', '한국어'], ['ar', 'العربية'],
];
const currentPage = window.location.pathname.split('/').filter(Boolean).pop()?.endsWith('.html')
  ? window.location.pathname.split('/').pop()
  : 'index.html';
const scriptUrl = new URL(document.currentScript.src);
const siteRoot = new URL('../', scriptUrl);

function bestInitialLocale() {
  const stored = window.localStorage.getItem('qinyi-locale');
  if (languages.some(([code]) => code === stored)) return stored;
  const browserLanguages = navigator.languages || [navigator.language || 'en'];
  return languages.find(([code]) => browserLanguages.some((item) => (
    item.toLowerCase() === code.toLowerCase()
    || item.toLowerCase().split('-')[0] === code.toLowerCase().split('-')[0]
  )))?.[0] || 'en';
}

function localeUrl(locale) {
  const page = currentPage === 'index.html' ? '' : currentPage;
  const url = new URL(`${locale}/${page}`, siteRoot);
  url.search = window.location.search;
  url.hash = window.location.hash;
  return url;
}

if (i18n.rootAlias) {
  window.location.replace(localeUrl(bestInitialLocale()));
}

document.documentElement.lang = i18n.locale;
document.documentElement.dir = i18n.locale === 'ar' ? 'rtl' : 'ltr';
document.documentElement.style.setProperty('--rfq-production-brief', JSON.stringify(t('common.rfq.production_brief')));

if (currentPage === 'quote.html') {
  document.title = `${t('customizer.page.title')} | Qinyi Printing`;
}

document.querySelectorAll('.nav-actions a[href="quote.html"]').forEach((link) => {
  link.textContent = t('common.nav.custom_quote');
});

const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const primaryNavigation = [
  ['products.html', 'common.nav.products'],
  ['trade.html', 'common.nav.trade'],
  ['manufacturing.html', 'common.nav.manufacturing'],
  ['projects.html', 'common.nav.projects'],
  ['about.html', 'common.nav.company'],
];

if (navLinks) {
  navLinks.id = 'primary-navigation';
  navLinks.innerHTML = primaryNavigation.map(([href, key]) => {
    const current = currentPage === href ? ' aria-current="page"' : '';
    return `<a href="${href}"${current}>${t(key)}</a>`;
  }).join('');
  navLinks.insertAdjacentHTML('beforeend', [
    ['contact.html', 'common.nav.contact'],
    ['privacy.html', 'common.nav.privacy'],
    ['quote.html', 'common.nav.custom_quote'],
  ].map(([href, key]) => `<a class="mobile-nav-only" href="${href}">${t(key)}</a>`).join(''));
}

if (menuButton) {
  menuButton.setAttribute('aria-controls', 'primary-navigation');
  menuButton.setAttribute('aria-label', t('common.menu.open'));
  menuButton.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', t(isOpen ? 'common.menu.close' : 'common.menu.open'));
  });
  document.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', () => {
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', t('common.menu.open'));
    });
  });
}

document.querySelectorAll('[data-year]').forEach((node) => {
  node.textContent = new Intl.NumberFormat(i18n.locale, { useGrouping: false }).format(new Date().getFullYear());
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
document.querySelectorAll('.reveal').forEach((node) => observer ? observer.observe(node) : node.classList.add('visible'));

function buildLanguageControl() {
  const existing = document.querySelector('[data-language]');
  if (!existing) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'language-control';
  wrapper.innerHTML = `<label class="sr-only" for="site-language">${t('common.language.label')}</label>
    <select id="site-language" aria-label="${t('common.language.label')}">
      ${languages.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
    </select>`;
  existing.replaceWith(wrapper);
  const select = wrapper.querySelector('select');
  select.value = i18n.locale;
  select.addEventListener('change', () => {
    window.localStorage.setItem('qinyi-locale', select.value);
    window.location.assign(localeUrl(select.value));
  });
}
buildLanguageControl();

function localizedFieldValue(field) {
  if (field instanceof HTMLSelectElement) return field.selectedOptions[0]?.textContent?.trim() || field.value;
  return field.value;
}

document.querySelectorAll('[data-enquiry-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const reference = `QY-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const lines = [t('common.form.enquiry_title', { reference }), ''];
    Array.from(form.elements).filter((field) => field.name && localizedFieldValue(field).trim()).forEach((field) => {
      const label = form.querySelector(`label[for="${CSS.escape(field.id)}"]`)?.textContent?.trim() || field.name;
      lines.push(`${label}: ${localizedFieldValue(field)}`);
    });
    const product = form.elements.namedItem('product');
    const productValue = product ? localizedFieldValue(product) : t('common.form.default_product');
    const subject = encodeURIComponent(`${reference}: ${productValue || t('common.form.default_product')}`);
    const body = encodeURIComponent(lines.join('\n'));
    const status = form.querySelector('.form-status');
    if (status) {
      status.textContent = t('common.form.reference_created', { reference });
      status.classList.add('visible');
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: form.dataset.enquiryForm === 'quote' ? 'quote_email_handoff' : 'contact_email_handoff',
      product_type: product?.value || t('common.form.not_specified'),
    });
    window.location.href = `mailto:hello@qinyiprinting.com?subject=${subject}&body=${body}`;
  });
});

document.querySelectorAll('a[href^="mailto:"]').forEach((link) => link.addEventListener('click', () => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'email_click' });
}));
document.querySelectorAll('a[href^="tel:"]').forEach((link) => link.addEventListener('click', () => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'phone_click' });
}));

const mobileQuote = document.createElement('a');
mobileQuote.className = 'mobile-rfq';
mobileQuote.href = currentPage === 'quote.html' ? '#rfq' : 'quote.html#rfq';
mobileQuote.textContent = t('common.floating.quote');
document.body.appendChild(mobileQuote);

const supportLabels = {
  en: { open: 'Open Qinyi AI Support', title: 'Qinyi AI Support', close: 'Close support', full: 'Open full page' },
  'zh-CN': { open: '打开勤益智能客服', title: '勤益智能客服', close: '关闭客服', full: '打开完整页面' },
  es: { open: 'Abrir asistencia de Qinyi', title: 'Asistencia de Qinyi', close: 'Cerrar asistencia', full: 'Abrir página completa' },
  de: { open: 'Qinyi-Support öffnen', title: 'Qinyi AI Support', close: 'Support schließen', full: 'Ganze Seite öffnen' },
  fr: { open: "Ouvrir l'assistance Qinyi", title: 'Assistance Qinyi', close: "Fermer l'assistance", full: 'Ouvrir la page complète' },
  ja: { open: 'Qinyi AIサポートを開く', title: 'Qinyi AIサポート', close: 'サポートを閉じる', full: '全画面で開く' },
  ko: { open: 'Qinyi AI 지원 열기', title: 'Qinyi AI 지원', close: '지원 닫기', full: '전체 페이지 열기' },
  ar: { open: 'فتح دعم Qinyi الذكي', title: 'دعم Qinyi الذكي', close: 'إغلاق الدعم', full: 'فتح الصفحة الكاملة' },
};

function installSupportWidget() {
  const copy = supportLabels[i18n.locale] || supportLabels.en;
  const embeddedUrl = new URL('ai-support.html', siteRoot);
  embeddedUrl.searchParams.set('locale', i18n.locale);
  embeddedUrl.searchParams.set('embed', '1');
  const fullUrl = new URL('ai-support.html', siteRoot);
  fullUrl.searchParams.set('locale', i18n.locale);

  const launcher = document.createElement('button');
  launcher.className = 'qinyi-support-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', copy.open);
  launcher.setAttribute('title', copy.open);
  launcher.setAttribute('aria-expanded', 'false');
  launcher.innerHTML = '<span class="qinyi-support-icon" aria-hidden="true"><i></i><i></i><i></i></span>';

  const layer = document.createElement('div');
  layer.className = 'qinyi-support-layer';
  layer.hidden = true;
  layer.innerHTML = `<button class="qinyi-support-scrim" type="button" aria-label="${copy.close}"></button>
    <section class="qinyi-support-dialog" role="dialog" aria-modal="true" aria-label="${copy.title}">
      <header class="qinyi-support-dialog__header">
        <strong>${copy.title}</strong>
        <div>
          <a class="qinyi-support-expand" href="${fullUrl.href}" title="${copy.full}" aria-label="${copy.full}">↗</a>
          <button class="qinyi-support-close" type="button" title="${copy.close}" aria-label="${copy.close}">×</button>
        </div>
      </header>
      <iframe class="qinyi-support-frame" title="${copy.title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </section>`;

  const frame = layer.querySelector('.qinyi-support-frame');
  const closeButton = layer.querySelector('.qinyi-support-close');
  const scrim = layer.querySelector('.qinyi-support-scrim');

  function closeSupport() {
    layer.hidden = true;
    document.body.classList.remove('support-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  function openSupport(event) {
    const ticketId = event?.detail?.ticketId;
    if (ticketId) {
      const ticketUrl = new URL(embeddedUrl);
      ticketUrl.searchParams.set('ticket', ticketId);
      frame.src = ticketUrl.href;
    } else if (!frame.src) {
      frame.src = embeddedUrl.href;
    }
    layer.hidden = false;
    document.body.classList.add('support-open');
    launcher.setAttribute('aria-expanded', 'true');
    closeButton.focus();
  }

  document.addEventListener('qinyi:open-support', openSupport);

  launcher.addEventListener('click', () => openSupport());
  closeButton.addEventListener('click', closeSupport);
  scrim.addEventListener('click', closeSupport);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !layer.hidden) closeSupport();
  });
  document.body.append(layer, launcher);
}

installSupportWidget();
