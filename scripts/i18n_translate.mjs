#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supported = new Map([
  ['zh-CN', 'Simplified Chinese'], ['es', 'Spanish'], ['de', 'German'],
  ['fr', 'French'], ['ja', 'Japanese'], ['ko', 'Korean'], ['ar', 'Arabic'],
]);
const locale = process.argv[2];
const forceReviewed = process.argv.includes('--force-reviewed');
const model = process.env.OPENAI_TRANSLATION_MODEL || 'gpt-5.6';

if (!supported.has(locale)) {
  throw new Error(`Usage: node scripts/i18n_translate.mjs <${[...supported.keys()].join('|')}> [--force-reviewed]`);
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required. Keep it in the environment, never in this repository.');
}

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const en = await readJson(path.join(root, 'locales/en.json'));
const glossary = await readJson(path.join(root, 'i18n/glossary.json'));
const targetPath = path.join(root, `locales/${locale}.json`);
let target = { locale, languageName: supported.get(locale), direction: locale === 'ar' ? 'rtl' : 'ltr', updatedAt: null, messages: {} };
try { target = await readJson(targetPath); } catch {}

const pending = [];
for (const [key, source] of Object.entries(en.messages)) {
  const current = target.messages[key];
  if (!current) pending.push({ key, source: source.value, sourceHash: source.sourceHash });
  else if (current.sourceHash !== source.sourceHash && (forceReviewed || current.status !== 'reviewed')) {
    pending.push({ key, source: source.value, sourceHash: source.sourceHash });
  } else if (current.sourceHash !== source.sourceHash) {
    current.status = 'needs_review';
  }
}

const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
for (const batch of chunk(pending, 35)) {
  const keys = batch.map((item) => item.key);
  const schema = {
    type: 'object', additionalProperties: false,
    properties: Object.fromEntries(keys.map((key) => [key, { type: 'string' }])),
    required: keys,
  };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      instructions: `Translate B2B printing-manufacturing website copy into ${supported.get(locale)}. Return natural market-ready copy, not literal fragments. Follow this glossary exactly: ${JSON.stringify(glossary)}. Preserve every {placeholder}. Keep concise UI labels concise. Return JSON only.`,
      input: JSON.stringify(Object.fromEntries(batch.map(({ key, source }) => [key, source]))),
      text: { format: { type: 'json_schema', name: 'translations', strict: true, schema } },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const outputText = payload.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
  if (!outputText) throw new Error('OpenAI API returned no output_text.');
  const translations = JSON.parse(outputText);
  for (const item of batch) {
    const value = translations[item.key];
    const sourcePlaceholders = [...item.source.matchAll(/\{[^}]+\}/g)].map((m) => m[0]).sort();
    const targetPlaceholders = [...value.matchAll(/\{[^}]+\}/g)].map((m) => m[0]).sort();
    if (JSON.stringify(sourcePlaceholders) !== JSON.stringify(targetPlaceholders)) {
      throw new Error(`Placeholder mismatch for ${item.key}`);
    }
    target.messages[item.key] = { value, status: 'needs_review', sourceHash: item.sourceHash };
  }
  await fs.writeFile(targetPath, `${JSON.stringify(target, null, 2)}\n`);
}

target.updatedAt = new Date().toISOString().slice(0, 10);
target.messages = Object.fromEntries(Object.entries(target.messages)
  .filter(([key]) => en.messages[key])
  .sort(([a], [b]) => a.localeCompare(b)));
await fs.writeFile(targetPath, `${JSON.stringify(target, null, 2)}\n`);
console.log(`${locale}: ${pending.length} messages translated with ${model}; review is required.`);
