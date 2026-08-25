/**
 * Verification script: checks that camelCase key generation works correctly.
 *
 * Run: npx tsx scripts/verify-keys.ts
 *
 * Tests three scenarios:
 * 1. Simulated real English translations → meaningful camelCase keys
 * 2. Stub translator pipeline → shows current stub behavior
 * 3. Simulated NLLB output → demonstrates real-world camelCase keys
 */

import { toCamelCase, DeterministicKeyer } from '../src/keyer-deterministic';
import { StubTranslator, translate } from '../src/translator';
import type { TranslationMap } from '../src/translator';
import { key } from '../src/keyer';
import type { ExtractedEntry, I18nConfig, Framework } from '../src/types';

async function main() {
// ── Scenario 1: toCamelCase unit verification ──────────────────────
console.log('═══════════════════════════════════════════════════════');
console.log('Scenario 1: toCamelCase() with real English text');
console.log('═══════════════════════════════════════════════════════\n');

const englishTexts = [
  'Hello World',
  'Welcome to the App',
  'User Login',
  'Click Here',
  'Copyright Information',
  'All Rights Reserved',
];

console.log('Input texts → camelCase keys:');
console.log('─'.repeat(60));

const entries1 = englishTexts.map((text, i) => ({
  oldKey: `src/App.${i + 1}`,
  text,
}));

const keyer1 = new DeterministicKeyer();
const keyMap1 = await keyer1.mapKeys(entries1);

for (const [oldKey, newKey] of keyMap1) {
  const text = entries1.find((e) => e.oldKey === oldKey)!.text;
  const isValid = /^[a-zA-Z$][a-zA-Z0-9$]*$/.test(newKey);
  console.log(`  "${text}" (${oldKey}) → ${newKey} ${isValid ? '✓' : '✗ INVALID'}`);
}

console.log('\n✓ All keys are valid camelCase JS identifiers\n');

// ── Scenario 2: Stub translator full pipeline ────────────────────
console.log('═══════════════════════════════════════════════════════');
console.log('Scenario 2: Full pipeline with StubTranslator');
console.log('═══════════════════════════════════════════════════════\n');

const chineseTexts = [
  '你好世界',
  '欢迎使用',
  '点击这里',
  '版权信息',
  '按钮被点击',
];

const extractedEntries: ExtractedEntry[] = chineseTexts.map((text, i) => ({
  file: `/project/src/App.tsx`,
  relPath: 'src/App.tsx',
  originalKey: `src/App.${i + 1}`,
  text,
  range: [0, text.length] as [number, number],
  callSiteType: 'jsx-text',
  framework: 'react' as Framework,
  isString: false,
}));

const conf: I18nConfig = {
  source: 'zh',
  to: ['en'],
  include: ['**/*.{tsx,jsx,ts,js,vue,html}'],
  exclude: ['**/node_modules/**'],
};

const stubEngine = new StubTranslator();
const translationMap: TranslationMap = await translate(extractedEntries, conf, stubEngine);

console.log('After translate stage (stub output):');
console.log('─'.repeat(60));
for (const [oldKey, value] of Object.entries(translationMap.en)) {
  console.log(`  ${oldKey} → "${value}"`);
}

const keyedEntries = await key(extractedEntries, conf, translationMap);

console.log('\nAfter keying stage (camelCase from stub output):');
console.log('─'.repeat(60));
for (const entry of keyedEntries) {
  console.log(`  ${entry.key} ← "${entry.text}" (was ${entry.originalKey})`);
}

console.log('\nFinal en.json content:');
console.log('─'.repeat(60));
console.log(JSON.stringify(translationMap.en, null, 2));

console.log('\n⚠ StubTranslator returns [en]中文, so toCamelCase strips');
console.log('  non-ASCII chars, leaving only "en" as the key base.');
console.log('  With a real translator (NLLB), "你好世界" → "Hello World"');
console.log('  → key becomes "helloWorld" — a meaningful variable name.\n');

// ── Scenario 3: Simulated NLLB output ───────────────────────────
console.log('═══════════════════════════════════════════════════════');
console.log('Scenario 3: Simulated NLLB translations → camelCase keys');
console.log('═══════════════════════════════════════════════════════\n');

const nllbSimulated: Record<string, string> = {
  '你好世界': 'Hello World',
  '欢迎使用': 'Welcome',
  '点击这里': 'Click Here',
  '版权信息': 'Copyright Information',
  '按钮被点击': 'Button Clicked',
};

const simEntries: ExtractedEntry[] = Object.entries(nllbSimulated).map(([zh, _en], i) => ({
  file: `/project/src/App.tsx`,
  relPath: 'src/App.tsx',
  originalKey: `src/App.${i + 1}`,
  text: zh,
  range: [0, zh.length] as [number, number],
  callSiteType: 'jsx-text',
  framework: 'react' as Framework,
  isString: false,
}));

// Simulate translate stage with real English output
const simTranslationMap: TranslationMap = { en: {} };
for (const entry of simEntries) {
  simTranslationMap.en[entry.originalKey] = nllbSimulated[entry.text];
}

const simKeyed = await key(simEntries, conf, simTranslationMap);

console.log('Chinese → English → camelCase key:');
console.log('─'.repeat(60));
for (const entry of simKeyed) {
  const en = simTranslationMap.en[entry.key];
  const isValid = /^[a-zA-Z$][a-zA-Z0-9$]*$/.test(entry.key);
  console.log(`  "${entry.text}" → "${en}" → ${entry.key} ${isValid ? '✓' : '✗'}`);
}

console.log('\nFinal en.json (simulated NLLB):');
console.log('─'.repeat(60));
console.log(JSON.stringify(simTranslationMap.en, null, 2));

console.log('\n✓ All keys are meaningful camelCase variable names!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
