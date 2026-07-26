#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const languageNames = new Map([
  ['zh-CN', 'Simplified Chinese'], ['es', 'Spanish'], ['de', 'German'],
  ['fr', 'French'], ['ja', 'Japanese'], ['ko', 'Korean'], ['ar', 'Arabic'],
]);
const locale = process.argv[2];
const model = process.env.DEEPSEEK_TRANSLATION_MODEL || 'deepseek-chat';
if (!languageNames.has(locale)) throw new Error(`Usage: node scripts/i18n_translate_deepseek.mjs <${[...languageNames.keys()].join('|')}>`);

function apiKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;
  if (process.platform !== 'darwin') return null;
  try {
    return execFileSync('security', [
      'find-generic-password', '-a', os.userInfo().username,
      '-s', 'qinyi-deepseek-api', '-w',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const secret = apiKey();
if (!secret) throw new Error('Set DEEPSEEK_API_KEY or add the qinyi-deepseek-api entry to macOS Keychain.');

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const en = await readJson(path.join(root, 'locales/en.json'));
const glossary = await readJson(path.join(root, 'i18n/glossary.json'));
const targetPath = path.join(root, `locales/${locale}.json`);
let target = { locale, languageName: languageNames.get(locale), direction: locale === 'ar' ? 'rtl' : 'ltr', updatedAt: null, messages: {} };
try { target = await readJson(targetPath); } catch {}

const pending = Object.entries(en.messages)
  .filter(([key, source]) => {
    const current = target.messages[key];
    return !current || current.value === source.value || (current.sourceHash !== source.sourceHash && current.status !== 'reviewed');
  })
  .map(([key, source]) => ({ key, ...source }));
const batchSize = locale === 'ar' ? 10 : 30;
const batches = Array.from({ length: Math.ceil(pending.length / batchSize) }, (_, index) => pending.slice(index * batchSize, index * batchSize + batchSize));

async function request(messages) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages,
        }),
      });
      if (!response.ok) throw new Error(`DeepSeek API ${response.status}: ${await response.text()}`);
      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error('DeepSeek API returned no message content.');
      return JSON.parse(content.replace(/^```json\s*|\s*```$/g, ''));
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw new Error('DeepSeek translation failed after retries.');
}

for (let index = 0; index < batches.length; index += 1) {
  const batch = batches[index];
  const source = Object.fromEntries(batch.map((item) => [
    item.key,
    item.value.replace(/"([^"]+)"/g, '“$1”'),
  ]));
  const translations = await request([
    {
      role: 'system',
      content: `You translate professional B2B printing-manufacturing website copy into ${languageNames.get(locale)}. Return one JSON object with exactly the input keys and translated string values. Use natural market-ready language, not literal fragments. CRITICAL: whenever a source string contains Qinyi Printing, Coinshin, MOQ, RFQ, Roland, Heidelberg, an email address or a URL, copy that protected term byte-for-byte into the translated value; never translate, transliterate, expand, remove or replace it. Preserve factual quantities and every {placeholder}. Team size is staff count, never age. Never place an unescaped ASCII double-quote character inside a translated value; use locale-appropriate quotation marks such as “”, «» instead. Follow this glossary exactly: ${JSON.stringify(glossary)}`,
    },
    { role: 'user', content: `Translate this JSON and return JSON only: ${JSON.stringify(source)}` },
  ]);

  for (const item of batch) {
    let value = translations[item.key];
    if (typeof value !== 'string' || !value.trim()) {
      const retry = await request([
        {
          role: 'system',
          content: `Translate one B2B printing-manufacturing message into ${languageNames.get(locale)}. Preserve Qinyi Printing, Coinshin, MOQ, RFQ, facts and every {placeholder}. Return a JSON object with the exact key provided.`,
        },
        { role: 'user', content: JSON.stringify({ [item.key]: item.value }) },
      ]);
      value = retry[item.key] || Object.values(retry).find((entry) => typeof entry === 'string');
    }
    if (typeof value !== 'string' || !value.trim()) {
      console.warn(`${locale}: no usable DeepSeek draft for ${item.key}; keeping English for a later retry.`);
      value = item.value;
    }
    const sourcePlaceholders = [...item.value.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort().join('|');
    const targetPlaceholders = [...value.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort().join('|');
    if (sourcePlaceholders !== targetPlaceholders) {
      console.warn(`${locale}: placeholder mismatch for ${item.key}; keeping English for a later retry.`);
      value = item.value;
    }
    target.messages[item.key] = { value, status: 'needs_review', sourceHash: item.sourceHash };
  }
  target.updatedAt = new Date().toISOString().slice(0, 10);
  await fs.writeFile(targetPath, `${JSON.stringify(target, null, 2)}\n`);
  console.log(`${locale}: ${Math.min((index + 1) * batchSize, pending.length)}/${pending.length}`);
}

target.messages = Object.fromEntries(Object.entries(target.messages)
  .filter(([key]) => en.messages[key])
  .sort(([a], [b]) => a.localeCompare(b)));
await fs.writeFile(targetPath, `${JSON.stringify(target, null, 2)}\n`);
console.log(`${locale}: DeepSeek draft complete; human review is required.`);
