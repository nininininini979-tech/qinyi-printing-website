document.documentElement.classList.add('js');

const menuButton = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

const primaryNavigation = [
  ['products.html', 'Products'],
  ['trade.html', 'OEM & Trade Partnership'],
  ['manufacturing.html', 'Manufacturing & Quality'],
  ['projects.html', 'Case Studies'],
  ['about.html', 'Company'],
];

if (navLinks) {
  navLinks.id = 'primary-navigation';
  navLinks.innerHTML = primaryNavigation.map(([href, label]) => {
    const current = currentPage === href ? ' aria-current="page"' : '';
    return `<a href="${href}"${current}>${label}</a>`;
  }).join('');
  navLinks.insertAdjacentHTML(
    'beforeend',
    '<a class="mobile-nav-only" href="contact.html">Contact</a><a class="mobile-nav-only" href="privacy.html">Privacy & file security</a><a class="mobile-nav-only" href="quote.html">Request a quote</a>',
  );
}

if (menuButton) {
  menuButton.setAttribute('aria-controls', 'primary-navigation');
  menuButton.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });

  document.querySelectorAll('.nav-links a').forEach((link) => {
    link.addEventListener('click', () => {
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open menu');
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

const languages = [
  ['en', 'English'],
  ['zh-CN', '中文'],
  ['es', 'Español'],
  ['de', 'Deutsch'],
  ['fr', 'Français'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['ar', 'العربية'],
];

function selectedTranslationLanguage() {
  const match = document.cookie.match(/(?:^|; )googtrans=\/en\/([^;]+)/);
  return match ? decodeURIComponent(match[1]) : 'en';
}

function buildLanguageControl() {
  const existing = document.querySelector('[data-language]');
  if (!existing) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'language-control notranslate';
  wrapper.innerHTML = `
    <label class="sr-only" for="site-language">Website language</label>
    <select id="site-language" aria-label="Website language" disabled>
      ${languages.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
    </select>
    <div id="google_translate_element" hidden></div>`;
  existing.replaceWith(wrapper);

  const select = wrapper.querySelector('select');
  select.value = selectedTranslationLanguage();
  select.addEventListener('change', () => {
    const combo = document.querySelector('.goog-te-combo');
    if (!combo) return;
    combo.value = select.value;
    combo.dispatchEvent(new Event('change'));
    document.documentElement.dir = select.value === 'ar' ? 'rtl' : 'ltr';
  });
}

buildLanguageControl();

window.googleTranslateElementInit = function googleTranslateElementInit() {
  if (!window.google || !window.google.translate) return;
  new window.google.translate.TranslateElement({
    pageLanguage: 'en',
    includedLanguages: languages.map(([code]) => code).join(','),
    autoDisplay: false,
  }, 'google_translate_element');
  const select = document.getElementById('site-language');
  if (select) select.disabled = false;
};

if (document.querySelector('#google_translate_element')) {
  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  script.referrerPolicy = 'no-referrer-when-downgrade';
  document.head.appendChild(script);
}

document.querySelectorAll('[data-enquiry-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const reference = `QY-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const lines = [
      `Qinyi Printing enquiry ${reference}`,
      '',
      ...Array.from(data.entries())
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([key, value]) => `${key}: ${value}`),
    ];
    const subject = encodeURIComponent(`${reference}: ${data.get('product') || 'Custom paper product'}`);
    const body = encodeURIComponent(lines.join('\n'));
    const status = form.querySelector('.form-status');

    if (status) {
      status.textContent = `Reference ${reference} created. Your email application will open next; the enquiry is only submitted after you send it.`;
      status.classList.add('visible');
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: form.dataset.enquiryForm === 'quote' ? 'quote_email_handoff' : 'contact_email_handoff',
      product_type: data.get('product') || 'not specified',
    });

    window.location.href = `mailto:hello@qinyiprinting.com?subject=${subject}&body=${body}`;
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

if (currentPage !== 'quote.html') {
  const mobileQuote = document.createElement('a');
  mobileQuote.className = 'mobile-rfq';
  mobileQuote.href = 'quote.html';
  mobileQuote.textContent = 'Request a quote';
  document.body.appendChild(mobileQuote);
}
