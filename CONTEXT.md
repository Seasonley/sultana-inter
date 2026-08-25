# CONTEXT.md — sultana-inter 领域术语表

> 本文件仅收录领域词汇，不含实现细节。随设计讨论持续增补与矫正。

## 核心概念

- **原文项目 / 迁移目标（migration target）**：被 sultana-inter 处理、需要做国际化的源码项目。sultana-inter 本身不持有业务代码，只对目标项目做一次性迁移。
- **迁移管道（pipeline）**：一次完整迁移所经历的有序阶段：`scan → extract → keying → annotate → translate → write`。每一阶段输出机器可读日志（NDJSON）。
- **硬编码文案（hardcoded text / 中文文案）**：散落在目标项目源码/模板里的面向用户的中文文本，是迁移的对象。
- **语言包 / 语言文件（language bundle / locale file）**：把 key 映射到某语言文本的产物文件。按"每语言一个文件"组织（如 `src/i18n/zh.json`、`src/i18n/en.json`）。
- **调用点（call site）**：迁移后源码里用来取翻译文本的位置，按框架原生习惯生成——Vue `$t('key')` / `{{ $t('key') }}`，React `t('key')`，Angular `{{ 'key' | translate }}`。
- **i18n 运行时初始化文件（runtime init file）**：迁移时在每个框架里自动生成的、能把语言包 activate 起来的引导文件（如 vue-i18n 的 `createI18n`、react-i18next 的 `I18nextProvider`、Angular 的 `TranslateModule`）。目标是迁移后代码可直接运行并切换语言。

## key 与中间产物

- **key**：语言包里全局唯一的键，对应一段文案。默认由工具确定性生成；开启语义化后可经 AI 改写为可读语义。
- **中间文件（intermediate JSON / 源语言索引）**：提取阶段产出的、以【源语言 key → 源语言原文】组织的 JSON，是后续 AI 与翻译阶段的输入，也是"交给 LLM 直接转换"的对象。
- **语义化 key 命名（semantic keying）**：把生成的确定性 key 改写成语义可读 key（如 `home.title`）的过程。由 LLM 通过提示词约束完成；无 LLM 可用时降级为确定性命名。
- **语言对（language pair）**：一次迁移中"源语言 → 目标语言"的一组转换方向。NLLB 支持 200 种语言两两互转。

## 语言标识

- **语言码（language code）**：CLI/config 里用的人类友好短码（`zh`/`en`/`ja`/`fr`）。
- **flores 语言码（flores / model code）**：NLLB 模型内部使用的 `语言_文字` 编码（`zho_Hans`/`eng_Latn`/`jpn_Jpan`/`fra_Latn`）。短码与 flores 码通过内置映射表对应；未知语言可用 `--model-code` 直接透传。

## 引擎与职责

- **提取/转换引擎**：确定性的 AST 解析与代码改写部分（对应框架的解析器：Vue = compiler-sfc + Babel、React/JSX = TS AST、Angular = Angular Compiler）。永远保持确定性，保证可测。
- **翻译引擎（NLLB）**：模型 `facebook/nllb-200-distilled-600M`（Node 侧用 ONNX 权重），负责任意语言对的译文生成，离线可运行。
- **语义化引擎（LLM adapter）**：可选的外部大模型适配器，负责语义化 key 命名。无凭证时跳过。

## 验证

- **产物级验证（E2E）**：对 React/Vue/Angular 三个 fixture 跑完整迁移，断言（a）中文被替换成调用点、（b）语言文件生成正确、（c）迁移后的目标项目能被对应框架真实构建通过。运行三框架真实构建。
- **中间步骤日志（NDJSON）**：管道每阶段向 stdout 输出一行结构化 JSON，供自动化测试与无人值守消费；人类可读进度走 stderr。