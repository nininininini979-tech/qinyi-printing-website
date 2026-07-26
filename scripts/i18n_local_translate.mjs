#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const languages = new Map([
  ['zh-CN', 'Simplified Chinese'], ['es', 'Spanish'], ['de', 'German'],
  ['fr', 'French'], ['ja', 'Japanese'], ['ko', 'Korean'], ['ar', 'Arabic'],
]);
const locale = process.argv[2];
if (!languages.has(locale)) throw new Error(`Usage: node scripts/i18n_local_translate.mjs <${[...languages.keys()].join('|')}>`);

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const en = await readJson(path.join(root, 'locales/en.json'));
const glossary = await readJson(path.join(root, 'i18n/glossary.json'));
const targetPath = path.join(root, `locales/${locale}.json`);
const target = await readJson(targetPath);
const pending = Object.entries(en.messages)
  .filter(([key, source]) => !target.messages[key] || target.messages[key].value === source.value)
  .map(([key, source]) => ({ key, ...source }));

const chunks = Array.from({ length: Math.ceil(pending.length / 10) }, (_, index) => pending.slice(index * 10, index * 10 + 10));
async function generate(prompt) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'qwen2.5:1.5b', prompt, stream: false, format: 'json', keep_alive: '60m', options: { temperature: 0.1 } }),
      });
      if (!response.ok) throw new Error(`Ollama ${response.status}: ${await response.text()}`);
      const payload = await response.json();
      return JSON.parse(payload.response);
    } catch (error) {
      if (attempt === 4) throw error;
      console.warn(`${locale}: local model request failed; retrying (${attempt}/4).`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw new Error('Local translation failed after retries.');
}

for (let index = 0; index < chunks.length; index += 1) {
  const batch = chunks[index];
  const input = Object.fromEntries(batch.map(({ key, value }) => [key, value]));
  const prompt = `Translate this JSON object's values from English into ${languages.get(locale)} for a professional B2B printing manufacturer website. Return one valid JSON object with exactly the same keys and translated string values. Preserve placeholders such as {count}, facts, dimensions, URLs, email addresses, Qinyi Printing, Coinshin, MOQ, RFQ, Roland and Heidelberg exactly. A team count is never an age. Follow this glossary: ${JSON.stringify(glossary)}. Input: ${JSON.stringify(input)}`;
  const generated = await generate(prompt);
  const translated = generated.translations || generated;
  for (const item of batch) {
    let value = translated[item.key];
    if (typeof value !== 'string' || !value.trim()) {
      const retry = await generate(`Translate the following text into ${languages.get(locale)} for a B2B printing manufacturer. Return exactly {"translation":"..."} as JSON. Preserve Qinyi Printing, Coinshin, MOQ, RFQ, all facts and placeholders. Text: ${JSON.stringify(item.value)}`);
      value = retry.translation || Object.values(retry).find((entry) => typeof entry === 'string');
    }
    if (typeof value !== 'string' || !value.trim()) {
      console.warn(`${locale}: no usable draft for ${item.key}; keeping English for a later retry.`);
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
  console.log(`${locale}: ${Math.min((index + 1) * 10, pending.length)}/${pending.length}`);
}

console.log(`${locale}: local draft complete; human review is required.`);
