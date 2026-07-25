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
