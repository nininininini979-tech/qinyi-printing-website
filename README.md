# Qinyi Printing B2B Website

Static, dependency-free English website for Qinyi Printing / Coinshin.

## Local Preview

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`.

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
7. Publish substantive `/zh/`, `/de/` and `/fr/` editions before adding their hreflang links. The language selector currently marks these editions as reserved.
8. Update the canonical domain in HTML, `sitemap.xml`, `robots.txt` and `llms.txt` if the production hostname changes.

## Tracking Hooks

`assets/app.js` pushes these events to `window.dataLayer` for a future analytics container:

- `quote_submit`
- `contact_form_submit`
- `email_click`
- `phone_click`
