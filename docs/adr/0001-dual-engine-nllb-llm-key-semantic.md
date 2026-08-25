# ADR-0001: Dual-Engine Translation — NLLB for Translation + LLM for Semantic Key Naming

## Status

Accepted

## Context

sultana-inter needs to translate hardcoded Chinese text in a project and generate language files. The system must support any language pair, run offline, and produce semantically meaningful i18n keys.

Three engines were evaluated:

- **NLLB-200-distilled-600M**: A Meta multi-lingual translation model (200 languages). In Node.js, it runs via `@huggingface/transformers` with ONNX weights (`Xenova/nllb-200-distilled-600M`), requiring no GPU. It can translate any language pair by passing `{src_lang, tgt_lang}` in FLORES-200 codes. Offline-capable after initial model download.
- **LLM (OpenAI-compatible API)**: Can both translate and produce semantic key names. However, it requires network access, API credentials, and produces non-deterministic outputs. Translation quality varies by batch size and context window.
- **Dense local models (MiniCPM / m2m100_418M)**: Available via HuggingFace mirror, but inferior translation quality for multi-lingual pairs compared to NLLB-200.

## Decision

The system uses a **dual-engine architecture** with strict separation of concerns:

1. **NLLB-200** (offline, deterministic, multi-lingual) — responsible for **all translation** (zh→en, zh→ja, zh→fr, etc.). Node side uses `@huggingface/transformers` loading `Xenova/nllb-200-distilled-600M` ONNX weights. Model directory overridable via `SQUID_MODEL_DIR`. Downloads go through HF mirror (`HF_ENDPOINT=https://hf-mirror.com`).

2. **LLM adapter** (online, optional) — responsible **exclusively for semantic key naming**. It receives the intermediate source-language JSON (`{old_key: "src.Main.index.1", text: "项目设置"}`) and, via prompt constraints, outputs a mapping `{old_key → semantic_key}` (e.g., `"src.Main.index.1" → "home.title"`). It does NOT translate; it only renames keys.

The two engines are orthogonal: translation output is fully determined by NLLB; semantic key naming is a separate, cached, optional overlay. The intermediate JSON file is the handoff contract between them.

## Consequences

- The system can run fully offline (deterministic key + NLLB translation) with zero network access.
- Semantic key naming is an optional enrichment; turning it off produces valid, testable results.
- The translation step is reproducible and independently testable.
- LLM call volume is minimal (key mapping only, not full translation), keeping API costs low.
- Mapping results are cached to `.sultana/` to ensure idempotency across reruns.
