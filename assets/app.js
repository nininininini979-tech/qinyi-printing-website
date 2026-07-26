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
    ['quote.html', 'common.nav.quote'],
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

if (currentPage !== 'quote.html') {
  const mobileQuote = document.createElement('a');
  mobileQuote.className = 'mobile-rfq';
  mobileQuote.href = 'quote.html';
  mobileQuote.textContent = t('common.nav.quote');
  document.body.appendChild(mobileQuote);
}
