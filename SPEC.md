# Spec: sultana-inter — Multi-Framework AI i18n Migration Tool

## Problem Statement

sultana-inter is an i18n migration CLI tool that currently only handles Chinese text extraction in React/JSX and Angular HTML templates, with translation done manually via terminal interaction (inquirer). It has no AI integration, no Vue support, no tests, and generates a non-standard call convention (`i18n_lang_package.xxx`). Meanwhile, ev-i18n (a sibling project) has Babel AST + Vue SFC support generating standard `$t()` calls, but lacks React/Angular support and has AI translation only as an unconnected demo script. Neither project produces migration output that can be directly compiled and run by the target framework. Users need a single tool that can migrate any React/Vue/Angular project to i18n with fully automated translation and zero manual post-editing.

## Solution

Rebuild sultana-inter as a **single-codebase, multi-framework i18n migration CLI** that merges ev-i18n's Babel/Vue capabilities with sultana-inter's TS AST/Angular/React support, adds a **dual-engine translation pipeline** (NLLB-200 offline model for translation + optional LLM for semantic key naming), generates **framework-native call sites** with **auto-generated i18n runtime initialization files**, and provides a **deterministic, E2E-testable pipeline** with structured NDJSON logging. The result is a zero-configuration, one-command migration that produces compilable, runnable code for any of the three major frontend frameworks, in any language pair.

## User Stories

1. As a Vue developer, I want to run `su-inter migrate -p ./my-vue-app` and have all hardcoded Chinese text in my `.vue` files replaced with `$t('key')` calls, so that my app supports internationalization without manual code changes.
2. As a React developer, I want to run `su-inter migrate -p ./my-react-app` and have all hardcoded Chinese text in my `.tsx/.jsx` files replaced with `t('key')` calls, so that my app supports internationalization without manual code changes.
3. As an Angular developer, I want to run `su-inter migrate -p ./my-angular-app` and have all hardcoded Chinese text in my `.html` templates replaced with `{{ 'key' | translate }}` pipes, so that my app supports internationalization without manual code changes.
4. As a developer, I want the tool to automatically generate a runtime initialization file (e.g., `src/i18n/index.ts`) that wires up the i18n library for my framework, so that the migrated code compiles and runs immediately.
5. As a developer, I want to specify multiple target languages in one command (e.g., `--to en --to ja --to fr`), so that I can generate all locale files in a single pass.
6. As a developer, I want the tool to use human-friendly language codes (`zh`, `en`, `ja`) in the CLI, which are automatically mapped to NLLB's FLORES-200 codes internally, so that I don't need to know model-specific encoding.
7. As a developer in a restricted network environment, I want the tool to work fully offline after the initial model download, so that I can run migrations without internet access.
8. As a developer, I want the tool to generate one JSON file per language (e.g., `src/i18n/en.json`, `src/i18n/ja.json`), so that my locale files are clean and standard.
9. As a developer, I want the tool to perform incremental merge on existing locale files, so that re-running migration does not overwrite translations I have already made.
10. As a developer, I want the tool to produce structured NDJSON logs to stdout for each pipeline stage, so that I can programmatically verify what the tool did.
11. As a developer, I want human-readable progress messages on stderr, so that I can watch the migration in real time.
12. As a developer, I want to run `su-inter migrate -p . --stage translate --from-json ./intermediate.json` to resume from a specific stage, so that I don't have to redo work when a stage fails.
13. As a developer, I want `--dry-run` to produce only the intermediate JSON files without modifying any source code, so that I can review the extraction before committing to changes.
14. As a developer, I want the tool to detect ambiguous files (`.ts/.js/.html` without framework indicators) and skip them with a warning, rather than silently producing incorrect output.
15. As a developer, I want to set `"framework": "vue"` in `i18n.json` as a project-level default, so that ambiguous files are correctly handled without per-file configuration.
16. As a developer, I want the tool to support an `"exclude"` list in `i18n.json` to skip certain files/directories, so that I can avoid migrating vendor code, tests, or auto-generated files.
17. As a developer, I want the tool to support an `"include"` list in `i18n.json` to narrow the scope of files to process, so that I can migrate incrementally.
18. As a developer, I want the CLI to support `--source zh` to declare the source language, so that the tool knows what language to extract and translate from.
19. As a developer, I want the tool to produce a `--source` default of `zh`, so that the most common use case works without extra flags.
20. As a developer, I want the semantic key naming feature to be automatic when an LLM API key is available, so that I get human-readable keys without extra configuration.
21. As a developer, I want `--no-semantic` to explicitly disable semantic key naming, so that I can force deterministic keys for reproducibility.
22. As a developer, I want the LLM adapter to accept credentials via `SQUID_LLM_API_KEY` + `SQUID_LLM_API` (or fall back to `OPENAI_API_KEY` + `OPENAI_BASE_URL`), so that I can use any OpenAI-compatible API.
23. As a developer, I want the LLM to receive the intermediate JSON and return only a `{old_key → semantic_key}` mapping via prompt constraints, so that the translation output remains deterministic (owned by NLLB).
24. As a developer, I want semantic key mapping results cached to `.sultana/keymap.json`, so that reruns are idempotent and keys don't drift.
25. As a developer, I want `--batch 200` to control how many keys are sent to the LLM per request, so that large projects don't exceed API context limits.
26. As a developer, I want the tool to print a clear warning when no LLM credentials are found and fall back to deterministic keys, so that I know why semantic keys are not being generated.
27. As a developer, I want the tool to support `--model-dir /path/to/models` to override the NLLB model location, so that I can use a pre-downloaded model without re-downloading.
28. As a developer, I want the tool to download the NLLB ONNX model via HF mirror (`HF_ENDPOINT`), so that downloads are fast in China.
29. As a developer, I want the tool to support `--model-code zho_Hans` to pass a raw FLORES code for an unsupported language, so that I can use NLLB for any of its 200 languages.
30. As a developer, I want the built-in language code mapping table to cover at least 40 common languages (zh, en, ja, ko, fr, de, es, pt, ru, ar, etc.), so that most users never need `--model-code`.
31. As a developer, I want the tool to add `import` statements for the i18n runtime into each migrated source file, so that the migrated code compiles without manual import wiring.
32. As a developer, I want the tool to handle template literal strings with embedded variables (e.g., `` `Hello ${name}` ``) by converting them to parameterized i18n calls (e.g., `t('key', { name })`), so that dynamic content is preserved.
33. As a developer, I want the tool to skip Chinese text inside `import`/`require`/`import()` statements, so that module paths are never accidentally translated.
34. As a developer, I want the tool to skip text that is already wrapped in an i18n call (`$t()`, `t()`, `$t()`), so that double-wrapping never occurs.
35. As a developer, I want a full `vite build` verification for Vue and React fixtures in E2E tests, so that I can be confident the migration produces compilable code.
36. As a developer, I want a full `ng build` verification for the Angular fixture in E2E tests, so that I can be confident the Angular migration produces compilable code.
37. As a developer, I want E2E tests to use a stub translator (no model download) by default, so that CI runs are fast and deterministic.
38. As a developer, I want a `SQUID_E2E_REAL=1` gate that enables real NLLB translation in E2E tests, so that I can verify actual translation quality when needed.
39. As a developer, I want E2E tests to assert that no Chinese text remains in migrated source files, so that I can verify completeness.
40. As a developer, I want E2E tests to assert that the generated language files contain all expected keys and translations, so that I can verify correctness.
41. As a developer, I want E2E tests to assert that NDJSON log output contains expected stage records with correct counts, so that I can verify pipeline execution.
42. As a developer, I want the tool to be installed as a global CLI (`npm install -g sultana-inter`) with a `su-inter` command, so that I can use it from any project directory.
43. As a developer, I want bilingual documentation (Chinese README.md + English README-en.md), so that both Chinese-speaking and international developers can use the tool.
44. As a contributor, I want architecture decision records (ADRs) documenting the dual-engine design and framework-native call site decisions, so that future maintainers understand the rationale.
45. As a developer, I want the tool to produce a migration summary (files processed, keys extracted, translations generated, files written) at the end of a successful run, so that I can quickly verify scope.
46. As a developer, I want the tool to handle `.vue` SFC files with `<script>`, `<script setup>`, `<template>`, and `<style>` blocks correctly, so that Vue projects with modern composition API work.
47. As a developer, I want the tool to handle React props with Chinese text (e.g., `<Component title="标题" />`) by converting to dynamic binding (e.g., `<Component title={t('key')} />`), so that component props are not missed.
48. As a developer, I want the tool to handle Angular `@Component` decorator metadata (e.g., `templateUrl`, `template`) and HTML template files, so that Angular projects are fully covered.
49. As a developer, I want the tool to generate keys that are valid JavaScript identifiers or quoted strings, so that they work in all call site contexts without escaping issues.
50. As a developer, I want the tool to be testable via Vitest with a clean separation between pipeline stages, so that unit tests can target individual stages and E2E tests can drive the full pipeline.

## Implementation Decisions

### Architecture: Single codebase, merged capabilities

sultana-inter becomes the sole codebase. ev-i18n's Babel AST + Vue SFC processing logic is ported into sultana-inter's `src/` directory as framework-specific adapter modules. The CLI, configuration, and logging infrastructure remain in sultana-inter.

### Modules (pipeline stages as seams)

Each pipeline stage is a separate module, testable independently. The pipeline runs sequentially:

1. **Scanner** (`src/scanner.ts`): Reads `i18n.json` config, walks the project tree, applies include/exclude glob patterns via micromatch, classifies files by framework (Vue `.vue`, React `.tsx/.jsx`, Angular `.html` + module detection, ambiguous `.ts/.js` → project default), emits `scan` stage NDJSON.
2. **Extractor** (`src/extractor.ts`): Dispatches to framework-specific extractors (Vue SFC parser using `@vue/compiler-sfc` + Babel, React/TS using TypeScript AST, Angular using `@angular/compiler` parseTemplate). Each extractor produces a list of `ExtractedEntry { file, originalKey, text, callSiteType, framework }`. Emits `extract` stage NDJSON.
3. **Keyer** (`src/keyer.ts`): Generates deterministic path-based keys (e.g., `src.Main.index.1`). If semantic keying is enabled, calls LLM adapter to produce `{old_key → semantic_key}` mapping. Caches mapping to `.sultana/keymap.json`. Emits `keying` stage NDJSON.
4. **Annotator** (`src/annotator.ts`): Uses the key mapping and framework-specific AST transformers to rewrite source files: replaces Chinese text with framework-native call sites, inserts import statements for the i18n runtime. Handles template literals → parameterized calls. Emits `annotate` stage NDJSON.
5. **Translator** (`src/translator.ts`): Feeds the intermediate source-language JSON (key → text) to the NLLB model for each target language. Generates per-language JSON files. Emits `translate` stage NDJSON.
6. **Writer** (`src/writer.ts`): Writes language files to `src/i18n/{lang}.json`, generates the framework-specific runtime init file at `src/i18n/index.{ts,tsx,vue}`, performs incremental merge on existing files. Emits `write` stage NDJSON.

### Dual-engine interface

```
interface TranslatorEngine {
  translate(text: string, from: string, to: string): Promise<string>;
}

class NLLBTranslator implements TranslatorEngine { ... }  // ONNX via @huggingface/transformers
class StubTranslator implements TranslatorEngine { ... }  // for E2E tests, returns fixed translations

interface SemanticKeyer {
  mapKeys(entries: Array<{oldKey: string, text: string}>): Promise<Map<string, string>>;
}

class LLMSemanticKeyer implements SemanticKeyer { ... }  // OpenAI-compatible API
class DeterministicKeyer implements SemanticKeyer { ... }  // no-op, returns old keys unchanged
```

### CLI interface

- **Default**: `su-inter migrate -p <project-path>` — full pipeline, all stages.
- **Source/target**: `--source zh --to en --to ja --to fr` — source language + one or more targets.
- **Framework**: `"framework"` field in `i18n.json`; ambiguous files skip if unset.
- **Stage control**: `--stage {extract,key,translate,write}` — run only one stage.
- **Resume**: `--from-json <path>` — skip scan/extract, start from keying with existing intermediate JSON.
- **Dry run**: `--dry-run` — produce intermediate files only, no source modification.
- **Semantic keys**: auto-enabled when LLM credentials present; `--no-semantic` disables; `--semantic-keys` forces enable (errors if no credentials).
- **Batch size**: `--batch 200` — keys per LLM request.
- **Model override**: `--model-dir <path>` — local NLLB model directory.
- **Model code**: `--model-code <flores_code>` — raw FLORES code for unknown languages.
- **Log file**: `--log-file <path>` — optional file mirror of NDJSON output.
- **Config file**: `--config <path>` — override default `i18n.json` location.

### NDJSON log schema

Each pipeline stage emits one or more JSON lines to stdout:

```json
{"stage":"extract","file":"src/views/Home.vue","framework":"vue","count":5,"ms":120}
{"stage":"translate","lang":"en","total":847,"batch":1,"model":"Xenova/nllb-200-distilled-600M","ms":3400}
```

Human-readable progress goes to stderr.

### Language code mapping

Built-in table of 40+ common language short codes to FLORES-200 codes (e.g., `zh` → `zho_Hans`, `en` → `eng_Latn`, `ja` → `jpn_Jpan`). Unknown codes pass through `--model-code`.

### E2E test structure

- Framework: Vitest
- Fixture location: `test/fixtures/{react,vue,angular}`
- Each fixture: minimal buildable app with hardcoded Chinese + pre-configured i18n dependencies
- **Stub mode** (default): `StubTranslator` returns `[lang]原文` — fast, deterministic, no network
- **Real mode** (`SQUID_E2E_REAL=1`): `NLLBTranslator` with real model — slow, network-dependent
- Assertions: (a) no Chinese characters remain in migrated source (grep), (b) language files contain expected keys, (c) NDJSON stdout contains expected stage records, (d) framework build exits with code 0 (Vue/React via `vite build`, Angular via `ng build`)
- LLM semantic keying also stubbed in E2E (fixed mapping), real LLM tested via separate integration gate

## Testing Decisions

- **Unit tests per stage**: Each pipeline module (scanner, extractor, keyer, translator, writer) has independent unit tests using Vitest. Fixtures are small code snippets, not full apps. Each test exercises external behavior (input → output) without mocking internals.
- **Integration tests for AST transformers**: Verify that Vue SFC, React TSX, and Angular template transformers produce correct call sites from representative code samples (template literals, props, `*ngIf`, `{{}}`, etc.).
- **E2E tests for full pipeline**: Drive the complete `su-inter migrate` command as a child process against three fixture projects. Assert on NDJSON output, file system artifacts, and build exit codes.
- **E2E dual-mode**: Stub translator for fast CI; real NLLB for optional quality verification gated behind `SQUID_E2E_REAL`.
- **Prior art**: The project currently has zero tests. Vitest is chosen because it's already in the user's proficient tech stack and integrates well with TypeScript.

## Out of Scope

- **Real-time IDE plugins** (VS Code, JetBrains) — this is a CLI tool, not an IDE extension.
- **Bidirectional migration** (i18n → hardcoded) — only one-way migration is supported.
- **Runtime i18n library bundling** — the tool generates the init file and locale files but does not bundle the i18n runtime library; the target project must have the appropriate i18n library installed (vue-i18n, react-i18next, @ngx-translate/core).
- **Image/SVG/PDF translation** — only source code text is extracted and translated.
- **Comment translation** — comments inside source code are skipped (following ev-i18n's approach).
- **CSS/SCSS/Less text extraction** — style files are not scanned for hardcoded text.
- **Non-OpenAI-compatible LLM APIs** — only OpenAI-compatible endpoints are supported; other providers must expose a compatible interface.
- **GPU acceleration** — ONNX inference runs on CPU only via transformers.js; GPU support would require onnxruntime-node GPU build, which is out of scope.
- **Support for i18n libraries other than vue-i18n, react-i18next, and @ngx-translate/core** — the generated init files target these three specifically.
- **AST transformation of third-party library internals** — only the project's own source files under the configured include/exclude patterns are processed.

## Further Notes

- The project name "sultana-inter" is retained as the CLI package name.
- The `su-inter` CLI command is retained.
- `CONTEXT.md` (domain glossary) is maintained alongside the spec and ADRs.
- The `i18n.json` configuration format is backwards-compatible with ev-i18n's existing format, with new fields added as optional extensions (`framework`, `semanticKeys`, `source`).
- NLLB model download happens on first use with progress indicator; subsequent runs use cached model from `SQUID_MODEL_DIR` or default cache location.
- The 200-line batch limit for LLM key mapping follows ev-i18n's documented experience with AI output limits.
