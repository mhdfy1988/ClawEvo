# Prompt Compression Notes

See the consolidated design:
- [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-engine-design-v2.zh-CN.md)

## Summary

The prompt path now compresses earlier history and keeps only the latest raw
turns in the final message list.

The flow is:

```text
full session messages
-> ingest to graph
-> compile graph-backed runtime context
-> persist checkpoint / skill candidates when history was compressed
-> keep only recent raw non-system messages
-> send compressed context + recent raw tail to the model
```

## New config

- `recentRawMessageCount`
  - default: `8`
  - meaning: how many recent non-system messages remain uncompressed in the
    final prompt

## Current behavior

- `assemble()` ingests the full current message list into graph memory
- if the session has more than `recentRawMessageCount` non-system messages:
  - older history is represented by the compiled structured context
  - only the recent raw tail remains in the prompt message list
  - checkpoint / skill crystallization are updated when the compiled summary
    changed
- if the session is still short, the plugin falls back to the normal budget
  trimming path

## Why this matters

This makes compression and knowledge crystallization happen in one pass instead
of two separate passes:

- older history is not repeatedly re-summarized as plain text
- graph / checkpoint memory stays up to date
- prompt token usage drops because the raw prefix is removed
- repeated stable patterns can continue to grow into skill candidates

## Relevant files

- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [openclaw.plugin.json](/d:/C_Project/openclaw_compact_context/openclaw.plugin.json)
