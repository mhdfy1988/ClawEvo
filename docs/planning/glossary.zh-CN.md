# Glossary

这份文档统一项目里高频术语的含义，减少不同文档之间的表达漂移。

## A

### `assemble()`
运行时主压缩点。宿主当前真正送模前的消息窗口在这里收敛，插件也在这里返回：
- `messages`
- `systemPromptAddition`
- `estimatedTokens`

## B

### `bundle`
通常指 `RuntimeContextBundle`。它是图谱编译后的结构化运行时上下文，不是最终 provider payload。

## C

### `control plane`
治理、观测、导入这类“控制面”能力所在层，不直接替代 runtime plane。

### `correction proposal`
人工治理闭环里的提案对象，遵循：
- submit
- review
- apply
- rollback

## G

### `governance`
对知识系统进行人工审查、批准、应用、回滚的治理能力。

## I

### `import job`
多来源知识导入平台里的任务对象，遵循：
- `parse`
- `normalize`
- `materialize`

## L

### `live_runtime`
当前进程内 `assemble()` 最近一次真实看到的运行时窗口来源。

## P

### `persisted_snapshot`
`assemble()` 落盘后的运行时快照来源。

### `provider-neutral runtime context result`
我们项目最终产出的中立运行时结果。它不等于 OpenAI / Anthropic / Ollama 的最终请求格式。

### `prompt assembly`
把 runtime window 和压缩后的结构化上下文拼成宿主可继续组装的结果。

## R

### `runtime plane`
在线上下文处理、入图、编译、送模前拼装这条主链所在层。

### `runtime snapshot`
对 `assemble()` 运行时窗口的持久化快照，用于 debug / dashboard / control plane。

### `runtime window`
宿主当前这一轮真正送模前的消息窗口视图，包括：
- inbound
- preferred
- final

## S

### `scope`
知识或治理动作作用范围，当前常见有：
- `session`
- `workspace`
- `global`

### `systemPromptAddition`
插件生成的结构化上下文摘要，放在 `assemble()` 返回值里，由宿主并入 `system` 或 `instructions`。

## T

### `toolCallResultPair`
assistant tool call 和 tool result 之间的配对关系，用于 runtime window 调试与 transcript repair。

### `transcript_fallback`
根据 session transcript 重建出来的回退窗口来源，不是送模前真相源。
