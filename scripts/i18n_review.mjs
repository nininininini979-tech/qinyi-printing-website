#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [locale, ...keys] = process.argv.slice(2);
if (!locale || keys.length === 0) {
  throw new Error('Usage: node scripts/i18n_review.mjs <locale> <message-key...|--all>');
}
const file = path.join(root, `locales/${locale}.json`);
const catalog = JSON.parse(await fs.readFile(file, 'utf8'));
const selected = keys.includes('--all') ? Object.keys(catalog.messages) : keys;
for (const key of selected) {
  if (!catalog.messages[key]) throw new Error(`Unknown key: ${key}`);
  catalog.messages[key].status = 'reviewed';
}
catalog.updatedAt = new Date().toISOString().slice(0, 10);
await fs.writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`${locale}: marked ${selected.length} messages reviewed.`);
