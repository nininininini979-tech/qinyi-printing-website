# Qinyi Printing B2B Website

Static, dependency-free multilingual website for Qinyi Printing / Coinshin.

## Local Preview

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`.

## Localization workflow

English source pages live in `src/pages/`. The eight version-controlled catalogs
live in `locales/`, and generated static pages are written to `en/`, `zh-CN/`,
`es/`, `de/`, `fr/`, `ja/`, `ko/`, and `ar/`.

```bash
# Refresh the English source catalog after copy changes.
python3 scripts/i18n_extract.py
node scripts/i18n_sync.mjs

# Translate only new or changed messages. The API key stays in the environment.
OPENAI_API_KEY=... node scripts/i18n_translate.mjs de

# DeepSeek can read its key from DEEPSEEK_API_KEY or the macOS Keychain
# service named qinyi-deepseek-api.
node scripts/i18n_translate_deepseek.mjs de

# Optional offline draft fallback when the local Ollama model is installed.
node scripts/i18n_local_translate.mjs de

# After a human checks selected messages (or the complete catalog):
node scripts/i18n_review.mjs de common.nav.products common.nav.quote
node scripts/i18n_review.mjs de --all

# Generate static pages and run the release checks.
node scripts/i18n_build.mjs
node scripts/i18n_check.mjs
python3 scripts/site_smoke.py

# Required before a formal release; fails on any non-reviewed message.
node scripts/i18n_check.mjs --release
```

API translations are always saved as `needs_review`. A changed English source
hash invalidates the previous review status. `reviewed` is only set by the
explicit review command; the translation script never claims human approval.
Terminology and protected brand strings are maintained in `i18n/glossary.json`.

The browser never calls a translation API. GitHub Pages serves only static HTML,
CSS, JavaScript, images, and locale JSON files.

Production deployment is intentionally manual through
`.github/workflows/deploy-pages.yml`. Configure the repository's Pages source as
**GitHub Actions**; the workflow refuses to deploy while any non-English message
is not marked `reviewed`.

## Site Structure

- `index.html` - home
- `products.html` - product categories and specification guidance
- `solutions.html` - OEM and private-label workflow
- `industries.html` - buyer and application segments
- `manufacturing.html` - factory, process and quality planning
- `projects.html` - brochure-sourced product gallery
- `about.html` - company profile
- `insights.html` - sourcing content plan
- `faq.html` - buyer FAQ with matching FAQ schema
- `contact.html` - contact details and short enquiry form
- `quote.html` - detailed RFQ form

## Launch Checklist

1. Confirm the public English legal name and the relationship between Qinyi Printing and Coinshin.
2. Recheck the brochure-sourced address, telephone and email.
3. Verify current certificates, scope, certificate numbers and expiry dates from original documents before publishing claims.
4. Confirm display rights for all brochure-extracted product artwork.
5. Replace the current email-draft form behavior with the selected CRM, serverless form endpoint or company mail API if file uploads must be received directly.
6. Add the production GA4 measurement ID, Search Console verification and Bing Webmaster Tools verification.
7. Human-review every non-English catalog before the corresponding locale is treated as final copy.
8. The canonical host is currently the GitHub Pages project URL. Update the build script, `robots.txt` and `llms.txt` together if a custom domain is activated.

## Tracking Hooks

`assets/app.js` pushes these events to `window.dataLayer` for a future analytics container:

- `quote_submit`
- `contact_form_submit`
- `email_click`
- `phone_click`
