#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localeInfo = new Map([
  ['zh-CN', ['简体中文', 'ltr']], ['es', ['Español', 'ltr']], ['de', ['Deutsch', 'ltr']],
  ['fr', ['Français', 'ltr']], ['ja', ['日本語', 'ltr']], ['ko', ['한국어', 'ltr']], ['ar', ['العربية', 'rtl']],
]);
const requested = process.argv.slice(2);
const locales = requested.length ? requested : [...localeInfo.keys()];
const en = JSON.parse(await fs.readFile(path.join(root, 'locales/en.json'), 'utf8'));

for (const locale of locales) {
  if (!localeInfo.has(locale)) throw new Error(`Unsupported locale: ${locale}`);
  const file = path.join(root, `locales/${locale}.json`);
  let catalog = { locale, languageName: localeInfo.get(locale)[0], direction: localeInfo.get(locale)[1], updatedAt: null, messages: {} };
  try { catalog = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  const messages = {};
  for (const [key, source] of Object.entries(en.messages)) {
    messages[key] = catalog.messages[key] || {
      value: source.value,
      status: 'needs_review',
      sourceHash: source.sourceHash,
    };
  }
  catalog = { ...catalog, locale, languageName: localeInfo.get(locale)[0], direction: localeInfo.get(locale)[1], messages };
  await fs.writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`${locale}: synchronized ${Object.keys(messages).length} keys.`);
}
