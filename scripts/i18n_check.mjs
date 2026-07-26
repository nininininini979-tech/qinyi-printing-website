#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseMode = process.argv.includes('--release');
const locales = ['en', 'zh-CN', 'es', 'de', 'fr', 'ja', 'ko', 'ar'];
const catalogs = Object.fromEntries(await Promise.all(locales.map(async (locale) => [
  locale, JSON.parse(await fs.readFile(path.join(root, `locales/${locale}.json`), 'utf8')),
])));
const glossary = JSON.parse(await fs.readFile(path.join(root, 'i18n/glossary.json'), 'utf8'));
const sourceKeys = Object.keys(catalogs.en.messages).sort();
const errors = [];

for (const locale of locales) {
  const catalog = catalogs[locale];
  const keys = Object.keys(catalog.messages).sort();
  const missing = sourceKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !sourceKeys.includes(key));
  if (missing.length) errors.push(`${locale}: ${missing.length} missing keys: ${missing.slice(0, 5).join(', ')}`);
  if (extra.length) errors.push(`${locale}: ${extra.length} extra keys: ${extra.slice(0, 5).join(', ')}`);
  for (const key of sourceKeys) {
    const source = catalogs.en.messages[key];
    const target = catalog.messages[key];
    if (!target?.value?.trim()) errors.push(`${locale}:${key}: empty value`);
    if (target?.sourceHash !== source.sourceHash) errors.push(`${locale}:${key}: stale sourceHash`);
    const sourcePlaceholders = [...source.value.matchAll(/\{[^}]+\}/g)].map((m) => m[0]).sort().join('|');
    const targetPlaceholders = [...(target?.value || '').matchAll(/\{[^}]+\}/g)].map((m) => m[0]).sort().join('|');
    if (sourcePlaceholders !== targetPlaceholders) errors.push(`${locale}:${key}: placeholder mismatch`);
    if (releaseMode && locale !== 'en' && target?.status !== 'reviewed') errors.push(`${locale}:${key}: not human-reviewed`);
    for (const term of glossary.preserveExactly) {
      if (source.value.includes(term) && !target?.value.includes(term)) {
        const chineseLegalName = locale === 'zh-CN'
          && source.value.includes(glossary.legalName.en)
          && target?.value.includes(glossary.legalName['zh-CN']);
        const chineseBrandName = locale === 'zh-CN'
          && term === glossary.brandName.en
          && target?.value.includes(glossary.brandName['zh-CN']);
        if (!chineseLegalName && !chineseBrandName) errors.push(`${locale}:${key}: protected term changed: ${term}`);
      }
    }
  }
}

const teamKey = 'stats.team_members';
const ageTerms = {
  'zh-CN': /岁/,
  es: /\baños?\b/i,
  de: /\bjahre?n?\b/i,
  fr: /\bans?\b/i,
  ja: /歳/,
  ko: /(?:^|\s)세(?:\s|$)/,
  ar: /(?:سنة|سنوات|عامًا|عاما)/,
};
for (const locale of locales) {
  const value = catalogs[locale].messages[teamKey]?.value || '';
  if (!value.includes('{count}')) errors.push(`${locale}:${teamKey}: missing {count}`);
  if (ageTerms[locale]?.test(value)) errors.push(`${locale}:${teamKey}: team size incorrectly refers to age`);
}

for (const locale of locales) {
  const index = await fs.readFile(path.join(root, locale, 'index.html'), 'utf8');
  if (!index.includes(`<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">`)) errors.push(`${locale}: incorrect html lang/dir`);
  if (index.includes('translate.google.com') || index.includes('googtrans')) errors.push(`${locale}: Google Translate residue`);
  if (!index.includes(`hreflang="${locale}"`)) errors.push(`${locale}: missing hreflang`);
  if (!index.includes(`${locale}/`)) errors.push(`${locale}: canonical route missing`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`i18n ${releaseMode ? 'release ' : ''}check passed: ${sourceKeys.length} keys across ${locales.length} locales.`);
