# OpenClaw Hook Notes

See the consolidated design:
- [context-engine-design-v2.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/context-engine-design-v2.zh-CN.md)

## Summary

OpenClaw plugins can register hooks directly at runtime. For this project, the
important conclusion is:

`compact-context` should not be only a `context-engine` slot plugin. It should
also be hook-aware so the graph, checkpoints, and compressed context stay in
sync with OpenClaw lifecycle events.

## What I confirmed

From the local OpenClaw docs and SDK:

- Plugins can register hooks with `api.registerHook(...)`.
- Plugins can register typed lifecycle hooks with `api.on(...)`.
- Typed hook names include:
  - `before_compaction`
  - `after_compaction`
  - `tool_result_persist`
  - `before_prompt_build`
  - `session_start`
  - `session_end`
- Compaction hooks are first-class plugin lifecycle hooks in the SDK.
- `tool_result_persist` is synchronous and can transform the tool result message
  before it is written to the transcript.

## Why hooks matter for this plugin

This project is trying to do three things at once:

- turn raw context into graph memory
- generate compressed runtime context
- crystallize stable patterns into skill candidates

If we only implement the `context-engine` interface, the plugin knows what is
happening only when OpenClaw calls that interface directly.

Hooks close that gap.

They let us react when OpenClaw performs lifecycle work outside the direct
`assemble()` or `compact()` path.

## Hooks we wired in now

### `before_compaction`

Purpose:

- sync the latest session state into the graph before OpenClaw compacts history
- make sure pre-compaction evidence is already ingested

Behavior:

- prefer reading the OpenClaw JSONL transcript from `sessionFile`
- fall back to the in-memory message snapshot when needed
- ingest the parsed records into the context engine

### `after_compaction`

Purpose:

- re-read the compacted transcript
- refresh graph-backed checkpoint state
- re-run skill candidate crystallization after compaction

Behavior:

- sync the latest compacted transcript into the engine
- compile a fresh runtime context bundle
- create a checkpoint
- crystallize skill candidates
- skip duplicate work when the compaction was already handled by our own
  `compact()` implementation

## Hooks intentionally not wired yet

### `tool_result_persist`

This one is promising because it can reduce transcript bloat before oversized
tool results are persisted.

I did not wire it yet because it changes persisted transcript content and needs
a careful policy:

- what is safe to truncate
- what must stay lossless
- how to preserve provenance for later graph ingestion

That should be the next hook to design once we define a transcript-safe
truncation policy.

### `before_prompt_build`

Not wired yet on purpose.

Our selected `context-engine` already owns `assemble()`. Injecting prompt
context again via hook would risk duplicated context and conflicting budgets.

## Current plugin shape

The plugin now effectively behaves like this:

```text
OpenClaw
-> registerContextEngine("compact-context")
-> register lifecycle hooks
-> before_compaction: sync transcript to graph
-> compact()/core compaction
-> after_compaction: rebuild checkpoint + skill candidates
```

## Relevant files

- [index.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/index.ts)
- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [types.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/types.ts)

