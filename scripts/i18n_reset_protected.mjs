#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['zh-CN', 'es', 'de', 'fr', 'ja', 'ko', 'ar'];
const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const en = await readJson(path.join(root, 'locales/en.json'));
const glossary = await readJson(path.join(root, 'i18n/glossary.json'));

for (const locale of locales) {
  const file = path.join(root, `locales/${locale}.json`);
  const target = await readJson(file);
  let reset = 0;
  for (const [key, source] of Object.entries(en.messages)) {
    const entry = target.messages[key];
    if (!entry) continue;
    const missing = glossary.preserveExactly.filter((term) => source.value.includes(term) && !entry.value.includes(term));
    const chineseLegalName = locale === 'zh-CN'
      && source.value.includes(glossary.legalName.en)
      && entry.value.includes(glossary.legalName['zh-CN']);
    if (missing.length && !chineseLegalName) {
      entry.value = source.value;
      entry.status = 'needs_review';
      entry.sourceHash = source.sourceHash;
      reset += 1;
    }
  }
  await fs.writeFile(file, `${JSON.stringify(target, null, 2)}\n`);
  console.log(`${locale}: reset ${reset} protected-term messages for retranslation.`);
}
