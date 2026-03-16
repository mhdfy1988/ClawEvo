# Prompt Assembly Contract

这份文档描述“我们把上下文处理完以后，究竟产出什么给宿主 adapter”。

相关代码：
- [types.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/types.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)
- [runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)

## 1. 一句话定义

`Prompt Assembly Contract` 描述的是：插件在 `assemble()` 阶段返回给宿主的 provider-neutral 结果，以及哪些工作继续留给宿主完成。

## 2. 我们负责什么

当前插件负责产出：
1. `messages`
2. `systemPromptAddition`
3. `estimatedTokens`

这三个字段在代码里固定成：
- `messages`
- `systemPromptAddition`
- `estimatedTokens`

## 3. 宿主负责什么

OpenClaw 或其他宿主 adapter 继续负责：
- 最终 provider payload 组装
- `system / instructions / messages / tools` 的 provider 适配
- provider-specific 参数

一句话说：

`我们不拼 OpenAI / Anthropic / Ollama 的最终请求，只交付 provider-neutral 结果。`

## 4. 顶层结构

当前 contract 对应：
- [OpenClawPromptAssemblyContract](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/types.ts)

```ts
type OpenClawPromptAssemblyContract = {
  version: string
  runtimeWindowVersion: string
  providerNeutralOutputs: readonly ("messages" | "systemPromptAddition" | "estimatedTokens")[]
  hostAssemblyResponsibilities: readonly string[]
  debugOnlyFields: readonly string[]
  finalMessageCount: number
  includesSystemPromptAddition: boolean
  estimatedTokens?: number
}
```

## 5. `systemPromptAddition` 放在哪

当前实现里：
- 它先放在 `assemble()` 返回值里
- 然后由宿主并入：
  - `system`
  - 或 `instructions`

它不应该被当成一条普通消息塞回 `messages`。

## 6. debug only 字段

当前会进入 debug / inspect、但不属于宿主送模责任的字段包括：
- `window`
- `latestPointers`
- `toolCallResultPairs`
- `counts`
- runtime snapshot 元信息

这些字段适合：
- `inspect_runtime_window`
- dashboard
- control plane

## 7. 最小示意

```json
{
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." },
    { "role": "tool", "content": "..." }
  ],
  "systemPromptAddition": "[Compact Context Engine]\\nGoal: ...\\nIntent: ...",
  "estimatedTokens": 1870
}
```

## 8. 关联文档

- [runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
- [runtime-snapshot-persistence.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-snapshot-persistence.zh-CN.md)
- [openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)
