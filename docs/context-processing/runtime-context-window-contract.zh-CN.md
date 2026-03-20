# Runtime Context Window Contract

这份文档把当前运行时窗口 contract 单独收出来，避免它只散落在策略文档和类型定义里。

相关代码：
- [types.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/types.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)
- [openclaw-runtime-context-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/openclaw-runtime-context-strategy.zh-CN.md)

## 1. 一句话定义

`Runtime Context Window Contract` 描述的是：插件在送模前真正看到的消息窗口、压缩结果、最新消息指针和 tool call / result 配对信息。

它是：
- provider-neutral
- runtime-oriented
- debug / dashboard / control-plane 都能消费的统一视图

它不是：
- transcript 原文
- 最终 provider payload
- 图谱节点的直接镜像

## 2. 来源优先级

当前窗口 contract 的来源顺序是：

1. `live_runtime`
2. `persisted_snapshot`
3. `transcript_fallback`

这三个来源分别代表：
- 真相源
- 持久化观察源
- 恢复源

## 3. 顶层结构

当前 contract 对应代码类型：
- [OpenClawRuntimeContextWindowContract](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/types.ts)

```ts
type OpenClawRuntimeContextWindowContract = {
  version: string
  source: "live_runtime" | "persisted_snapshot" | "transcript_fallback"
  sessionId: string
  query: string
  capturedAt?: string
  totalBudget: number
  compression: {
    recentRawMessageCount: number
    recentRawTurnCount?: number
    compressedCount: number
    preservedConversationCount: number
    compressionMode?: "none" | "incremental" | "full"
    compressionReason?: string
    policy?: {
      rawTailTurnCount: number
      fullCompactionThresholdRatio: number
      maxBaselineCount: number
      maxBaselineRollupRatio: number
    }
  }
  latestPointers: OpenClawRuntimeWindowLatestPointers
  toolCallResultPairs: OpenClawToolCallResultPair[]
  inbound: OpenClawRuntimeWindowLayer
  preferred: OpenClawRuntimeWindowLayer
  final: OpenClawRuntimeWindowLayer
}
```

## 4. 三层窗口

### `inbound`
- 宿主交给 `assemble()` 的原始消息窗口

### `preferred`
- `planPromptMessages()` 计算出的优先保留窗口

### `final`
- 预算再裁一轮之后的最终窗口
- 这层最接近宿主真正继续送模的 `messages`

## 5. 最新性指针

`latestPointers` 用来显式回答“当前最新消息是谁”。

字段包括：
- `latestUserMessageId`
- `latestAssistantMessageId`
- `latestToolResultIds`
- `latestUserInFinalWindow`
- `latestAssistantInFinalWindow`
- `latestToolResultIdsInFinalWindow`

## 6. Tool 配对

`toolCallResultPairs` 表达：
- assistant 发起了什么 tool call
- 哪个 tool result 和它配对
- 配对是严格 `tool_call_id`，还是顺序回退

当前 `matchKind` 有：
- `tool_call_id`
- `sequence_fallback`
- `tool_call_only`
- `tool_result_only`

## 7. 单层窗口结构

```ts
type OpenClawRuntimeWindowLayer = {
  messages: AgentMessageLike[]
  summary: OpenClawRuntimeMessageSummary[]
  counts: {
    total: number
    system: number
    conversation: number
  }
}
```

其中：
- `messages` 保留原始块
- `summary` 给 inspect / dashboard 用
- `counts` 给统计和阈值判断用

## 8. 最小示意

```json
{
  "source": "live_runtime",
  "sessionId": "agent:main:...",
  "query": "帮我分析这轮构建失败",
  "compression": {
    "recentRawMessageCount": 8,
    "recentRawTurnCount": 2,
    "compressedCount": 12,
    "preservedConversationCount": 7,
    "compressionMode": "incremental",
    "policy": {
      "rawTailTurnCount": 2,
      "fullCompactionThresholdRatio": 0.5,
      "maxBaselineCount": 4,
      "maxBaselineRollupRatio": 0.2
    }
  },
  "latestPointers": {
    "latestUserMessageId": "msg_u_1",
    "latestAssistantMessageId": "msg_a_2",
    "latestToolResultIds": ["msg_t_3"],
    "latestUserInFinalWindow": true,
    "latestAssistantInFinalWindow": true,
    "latestToolResultIdsInFinalWindow": ["msg_t_3"]
  }
}
```

## 9. 关联文档

- [prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
- [runtime-snapshot-persistence.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-snapshot-persistence.zh-CN.md)
