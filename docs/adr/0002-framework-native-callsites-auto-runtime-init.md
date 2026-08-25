# ADR-0002: Framework-Native Call Sites + Auto-Generated i18n Runtime Init

## Status

Accepted

## Context

sultana-inter supports three frontend frameworks (React, Vue, Angular). Each has its own idiomatic way to reference translated text and initialize its i18n runtime library. The tool must produce migration output that compiles and runs without manual post-editing.

The alternative of using a single custom call convention (e.g., `i18n_lang_package.xxx`) across all frameworks was considered but rejected because it would require a custom runtime shim and would not integrate with the ecosystem of existing i18n libraries (vue-i18n, react-i18next, @ngx-translate).

## Decision

Each framework gets its own **native call site** and an **auto-generated runtime init file** at a conventional path (`src/i18n/index.{vue,tsx,ts}`):

| Framework | Call Site | Init File |
|---|---|---|
| Vue | `$t('key')` / `{{ $t('key') }}` in templates | `createI18n({ ... })` + locale imports |
| React | `t('key')` via `useTranslation()` hook | `I18nextProvider` + locale imports |
| Angular | `{{ 'key' \| translate }}` in templates | `TranslateModule.forRoot()` + locale imports |

**Language file layout**: One file per language at `src/i18n/{lang}.json` (e.g., `zh.json`, `en.json`, `ja.json`). Content is `{ "key": "translated text" }`. The init file imports all available locale files and exports the configured i18n instance.

**Key convention**: Keys are flat strings (e.g., `"home.title"`, `"settings.save"`), shared across all language files. The same key appears in every locale file with its translated value for that language.

**File merging**: The tool performs incremental merge — existing language files are read, only new/changed keys are written, existing keys are preserved.

**Project-level framework declaration**: `i18n.json` includes `"framework": "react" | "vue" | "angular"` to resolve ambiguous file types (`.ts`, `.js`, `.html` that are not SFC). Files that cannot be resolved are skipped with a warning in NDJSON logs.

## Consequences

- Migrated projects compile and run immediately after migration without manual i18n wiring.
- Each framework's init file is generated with framework-appropriate imports, making the output idiomatic.
- Incremental merge prevents data loss when re-running migration on a project that already has partial locale files.
- The project-level `framework` field handles the ambiguity of plain `.ts/.js/.html` files cleanly.
