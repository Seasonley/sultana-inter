# sultana-inter

[中文](#中文文档) | [English](#english-documentation)

[![NPM](https://nodei.co/npm/sultana-inter.png)](https://npmjs.org/package/sultana-inter)
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]

---

## 中文文档

### 简介

**sultana-inter** 是一款多框架 AI 国际化迁移 CLI 工具，能够自动扫描项目中的硬编码中文文本，提取并替换为框架原生的 i18n 调用，同时生成对应的语言包文件。

### 支持框架

| 框架 | 模板类型 | 调用点示例 |
|------|----------|-----------|
| **Vue** | SFC `<template>` / `<script>` | `$t('key')` / `{{ $t('key') }}` |
| **React** | JSX / TSX | `t('key')` / `{t('key')}` |
| **Angular** | HTML 模板 / 内联模板 | `{{ 'key' \| translate }}` |

### 核心特性

- **6 阶段 Pipeline**: `scan → extract → translate → keying → annotate → write`
- **NLLB-200 翻译引擎**: 基于 Meta NLLB-200-distilled-600M 模型，支持 200+ 语言离线翻译
- **camelCase key 生成**: 从英文翻译自动生成合法变量名（如 `helloWorld`、`welcomeToApp`），支持 LLM 语义化命名
- **框架原生调用点**: 自动插入 `$t()` / `t()` / `| translate` 等框架原生 i18n 调用
- **自动初始化文件**: 生成 Vue `createI18n`、React `I18nextProvider`、Angular `TranslateModule.forRoot()` 初始化代码
- **阶段控制**: 支持 `--stage` 指定运行阶段，`--from-json` 续跑，`--dry-run` 预览
- **NDJSON 日志**: 结构化日志输出到 stdout，进度信息输出到 stderr

### 安装

```bash
npm install sultana-inter
```

### 快速开始

1. 在项目根目录创建 `i18n.json` 配置文件：

```json
{
  "framework": "vue",
  "source": "zh",
  "to": ["en"],
  "include": ["src/**/*.{vue,ts,tsx,js,jsx,html}"],
  "exclude": ["**/node_modules/**", "**/dist/**"]
}
```

2. 运行迁移命令：

```bash
su-inter migrate -p /path/to/your/project --to en
```

3. 工具会自动完成以下操作：
   - 扫描项目文件并分类框架
   - 提取硬编码中文文本
   - 翻译为英文（NLLB-200）
   - 从英文翻译生成 camelCase key
   - 替换源码中的中文为 i18n 调用
   - 生成语言包文件和 i18n 初始化文件

### CLI 命令

```bash
su-inter migrate [选项]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-p, --path <path>` | 项目根目录路径 | **必填** |
| `-s, --source <lang>` | 源语言代码 | `zh` |
| `-t, --to <lang>` | 目标语言代码（可多次指定） | `en` |
| `-f, --framework <fw>` | 强制指定框架 (vue/react/angular) | 自动探测 |
| `-c, --config <path>` | 配置文件路径 | `./i18n.json` |
| `--stage <stage>` | 只运行指定阶段 | 全部阶段 |
| `--from-json <path>` | 从中间 JSON 续跑 | 无 |
| `--dry-run` | 只生成中间文件，不修改源码 | `false` |
| `--log-file <path>` | NDJSON 日志输出到文件 | 无 |

**阶段控制示例：**

```bash
# 只扫描不翻译
su-inter migrate -p ./my-app --stage scan

# 从中间 JSON 续跑翻译阶段
su-inter migrate -p ./my-app --from-json .sultana/intermediate.json --stage translate

# 预览模式（不修改源码）
su-inter migrate -p ./my-app --dry-run
```

### 配置文件 (i18n.json)

```json
{
  "framework": "vue",
  "source": "zh",
  "to": ["en", "ja"],
  "include": ["src/**/*.{vue,ts,tsx}"],
  "exclude": ["**/node_modules/**", "**/*.test.*"],
  "semanticKeys": true,
  "noSemantic": false
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `framework` | `string` | 框架类型: `vue` / `react` / `angular` |
| `source` | `string` | 源语言代码 (如 `zh`) |
| `to` | `string[]` | 目标语言代码数组 |
| `include` | `string[]` | 包含文件的 glob 模式 |
| `exclude` | `string[]` | 排除文件的 glob 模式 |
| `semanticKeys` | `boolean` | 启用 LLM 语义化 key 命名 |
| `noSemantic` | `boolean` | 强制使用确定性 key（忽略 semanticKeys） |

### 环境变量

| 变量 | 说明 |
|------|------|
| `SQUID_E2E_REAL=1` | 使用真实 NLLB 翻译（默认使用 stub） |
| `SQUID_MODEL_DIR` | NLLB 模型本地缓存目录 |
| `HF_ENDPOINT` | HuggingFace 镜像地址 |
| `SQUID_LLM_API_KEY` | LLM API Key |
| `SQUID_LLM_API` | LLM API 地址（OpenAI 兼容） |
| `SQUID_LLM_MODEL` | LLM 模型名（默认 `gpt-4o-mini`） |

### Pipeline 架构

```
┌─────────┐    ┌──────────┐    ┌────────────┐    ┌─────────┐    ┌──────────┐    ┌───────┐
│  Scan   │───▶│ Extract  │───▶│ Translate  │───▶│ Keying  │───▶│ Annotate │───▶│ Write │
│         │    │          │    │            │    │         │    │          │    │       │
│ 分类文件 │    │ 提取中文  │    │ NLLB翻译   │    │camelCase│    │ 替换源码  │    │ 写文件 │
│         │    │          │    │ 为英文     │    │ 生成key │    │          │    │       │
└─────────┘    └──────────┘    └────────────┘    └─────────┘    └──────────┘    └───────┘
```

### Key 生成策略

翻译先于 keying 阶段执行，这样 keyer 可以从英文翻译结果生成有意义的 camelCase 变量名：

| 中文原文 | NLLB 英文翻译 | 生成的 key |
|---------|--------------|-----------|
| 你好世界 | Hello World | `helloWorld` |
| 欢迎使用 | Welcome | `welcome` |
| 点击这里 | Click Here | `clickHere` |
| 版权信息 | Copyright Information | `copyrightInformation` |

- **确定性模式（默认）**: `toCamelCase()` 将英文翻译转换为合法 JS 标识符，自动去重（`_2`、`_3` 后缀）
- **LLM 语义模式** (`semanticKeys: true`): 通过 OpenAI 兼容 API 生成更语义化的 key

### 测试

```bash
# 运行所有测试
npm test

# 运行 E2E 测试（含构建验证）
SQUID_E2E_BUILD=1 npm test

# 使用真实 NLLB 翻译的 E2E 测试
SQUID_E2E_REAL=1 npm test
```

### 示例

**迁移前 (Vue):**
```vue
<template>
  <div>
    <h1>你好世界</h1>
    <p>欢迎使用本应用</p>
  </div>
</template>
```

**迁移后 (Vue):**
```vue
<template>
  <div>
    <h1>{{ $t('helloWorld') }}</h1>
    <p>{{ $t('welcomeToApp') }}</p>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
</script>
```

**生成的语言包 (en.json):**
```json
{
  "helloWorld": "Hello World",
  "welcomeToApp": "Welcome to the application"
}
```

### 许可证

MIT

---

## English Documentation

### Overview

**sultana-inter** is a multi-framework AI i18n migration CLI tool that automatically scans projects for hardcoded Chinese text, extracts it, and replaces it with framework-native i18n call sites while generating corresponding locale files.

### Supported Frameworks

| Framework | Template Type | Call Site Example |
|-----------|--------------|-------------------|
| **Vue** | SFC `<template>` / `<script>` | `$t('key')` / `{{ $t('key') }}` |
| **React** | JSX / TSX | `t('key')` / `{t('key')}` |
| **Angular** | HTML template / inline template | `{{ 'key' \| translate }}` |

### Key Features

- **6-Stage Pipeline**: `scan → extract → translate → keying → annotate → write`
- **NLLB-200 Translation Engine**: Meta's NLLB-200-distilled-600M model supporting 200+ languages for offline translation
- **camelCase Key Generation**: Auto-generates valid variable names from English translations (e.g., `helloWorld`, `welcomeToApp`), with optional LLM semantic naming
- **Framework-Native Call Sites**: Automatically inserts `$t()` / `t()` / `| translate` and other framework-native i18n calls
- **Auto-Generated Init Files**: Generates Vue `createI18n`, React `I18nextProvider`, Angular `TranslateModule.forRoot()` initialization code
- **Stage Control**: Supports `--stage` to run specific stages, `--from-json` for resume, `--dry-run` for preview
- **NDJSON Logging**: Structured logs to stdout, human-readable progress to stderr

### Installation

```bash
npm install sultana-inter
```

### Quick Start

1. Create `i18n.json` in your project root:

```json
{
  "framework": "vue",
  "source": "zh",
  "to": ["en"],
  "include": ["src/**/*.{vue,ts,tsx,js,jsx,html}"],
  "exclude": ["**/node_modules/**", "**/dist/**"]
}
```

2. Run the migration:

```bash
su-inter migrate -p /path/to/your/project --to en
```

3. The tool automatically:
   - Scans and classifies project files by framework
   - Extracts hardcoded Chinese text
   - Translates to English (NLLB-200)
   - Generates camelCase keys from English translations
   - Replaces Chinese in source with i18n call sites
   - Generates locale files and i18n initialization files

### CLI Options

```bash
su-inter migrate [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --path <path>` | Project root path | **Required** |
| `-s, --source <lang>` | Source language code | `zh` |
| `-t, --to <lang>` | Target language code (repeatable) | `en` |
| `-f, --framework <fw>` | Force framework (vue/react/angular) | Auto-detect |
| `-c, --config <path>` | Config file path | `./i18n.json` |
| `--stage <stage>` | Run only a specific stage | All stages |
| `--from-json <path>` | Resume from intermediate JSON | None |
| `--dry-run` | Produce intermediate files only, no source modification | `false` |
| `--log-file <path>` | Mirror NDJSON output to file | None |

**Stage control examples:**

```bash
# Scan only, no translation
su-inter migrate -p ./my-app --stage scan

# Resume from intermediate JSON at the translate stage
su-inter migrate -p ./my-app --from-json .sultana/intermediate.json --stage translate

# Preview mode (no source modification)
su-inter migrate -p ./my-app --dry-run
```

### Configuration (i18n.json)

```json
{
  "framework": "vue",
  "source": "zh",
  "to": ["en", "ja"],
  "include": ["src/**/*.{vue,ts,tsx}"],
  "exclude": ["**/node_modules/**", "**/*.test.*"],
  "semanticKeys": true,
  "noSemantic": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `framework` | `string` | Framework type: `vue` / `react` / `angular` |
| `source` | `string` | Source language code (e.g., `zh`) |
| `to` | `string[]` | Target language codes |
| `include` | `string[]` | Glob patterns for files to include |
| `exclude` | `string[]` | Glob patterns for files to exclude |
| `semanticKeys` | `boolean` | Enable LLM semantic key naming |
| `noSemantic` | `boolean` | Force deterministic keys (overrides semanticKeys) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SQUID_E2E_REAL=1` | Use real NLLB translation (default: stub) |
| `SQUID_MODEL_DIR` | Local cache directory for NLLB model |
| `HF_ENDPOINT` | HuggingFace mirror URL |
| `SQUID_LLM_API_KEY` | LLM API Key |
| `SQUID_LLM_API` | LLM API URL (OpenAI-compatible) |
| `SQUID_LLM_MODEL` | LLM model name (default: `gpt-4o-mini`) |

### Pipeline Architecture

```
┌─────────┐    ┌──────────┐    ┌────────────┐    ┌─────────┐    ┌──────────┐    ┌───────┐
│  Scan   │───▶│ Extract  │───▶│ Translate  │───▶│ Keying  │───▶│ Annotate │───▶│ Write │
│         │    │          │    │            │    │         │    │          │    │       │
│ Classify│    │ Extract  │    │   NLLB     │    │camelCase│    │ Replace  │    │ Write │
│  Files  │    │ Chinese  │    │ Translate  │    │  Keys   │    │ Source   │    │ Files │
└─────────┘    └──────────┘    └────────────┘    └─────────┘    └──────────┘    └───────┘
```

### Key Generation Strategy

Translation runs before keying so the keyer can generate meaningful camelCase variable names from English text:

| Chinese Source | NLLB English | Generated Key |
|---------------|--------------|---------------|
| 你好世界 | Hello World | `helloWorld` |
| 欢迎使用 | Welcome | `welcome` |
| 点击这里 | Click Here | `clickHere` |
| 版权信息 | Copyright Information | `copyrightInformation` |

- **Deterministic mode (default)**: `toCamelCase()` converts English translations to valid JS identifiers with auto-deduplication (`_2`, `_3` suffixes)
- **LLM semantic mode** (`semanticKeys: true`): Uses OpenAI-compatible API for more semantic key names

### Testing

```bash
# Run all tests
npm test

# Run E2E tests with build verification
SQUID_E2E_BUILD=1 npm test

# Run E2E tests with real NLLB translation
SQUID_E2E_REAL=1 npm test
```

### Example

**Before (Vue):**
```vue
<template>
  <div>
    <h1>你好世界</h1>
    <p>欢迎使用本应用</p>
  </div>
</template>
```

**After (Vue):**
```vue
<template>
  <div>
    <h1>{{ $t('helloWorld') }}</h1>
    <p>{{ $t('welcomeToApp') }}</p>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
</script>
```

**Generated locale (en.json):**
```json
{
  "helloWorld": "Hello World",
  "welcomeToApp": "Welcome to the application"
}
```

### License

MIT

---

[downloads-image]: http://img.shields.io/npm/dm/sultana-inter.svg
[npm-url]: https://npmjs.org/package/sultana-inter
[npm-image]: http://img.shields.io/npm/v/sultana-inter.svg
