# Runtime Snapshot Persistence

这份文档描述运行时窗口快照如何落盘、如何查询，以及它和 `live_runtime / transcript_fallback` 的关系。

相关代码：
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)
- [runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)

## 1. 一句话定义

`Runtime Snapshot Persistence` 是把 `assemble()` 看到的真实运行时窗口保存成可回放、可调试、可被 control-plane 读取的持久化快照。

## 2. 为什么需要它

如果只有：
- live 内存快照

那重启后上下文观察能力就丢了。

如果只有：
- transcript fallback

那又拿不到“这一轮真正送模前最终窗口”的真相。

所以需要中间层：

`assemble() 真相 -> persisted snapshot -> debug / dashboard / control plane`

## 3. 当前落盘位置

当前实现里，快照目录固定为：

`runtime-window-snapshots`

并按 `sessionId` 落单文件：

`runtime-window-snapshots/<sessionId>.json`

## 4. 何时落盘

当前时机是：
- `assemble()` 成功收敛出运行时窗口之后

因此 persisted snapshot 记录的是：
- 真正参与这一轮 prompt 组装的窗口结果

## 5. 快照至少包含什么

当前快照会保留：
- `sessionId`
- `capturedAt`
- `query`
- `totalBudget`
- `recentRawMessageCount`
- `compressedCount`
- `preservedConversationCount`
- `inboundMessages`
- `preferredMessages`
- `finalMessages`
- `systemPromptAddition`
- `estimatedTokens`

## 6. 查询优先级

当前 `inspect_runtime_window` 的查询优先级是：
1. `live_runtime`
2. `persisted_snapshot`
3. `transcript_fallback`

## 7. 当前不做什么

这一层当前还不负责：
- 长期历史聚合
- 多版本 diff
- retention policy

这些更适合放到阶段 6 第二轮或后续 control plane 深化里。

## 8. 关联文档

- [runtime-context-window-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/runtime-context-window-contract.zh-CN.md)
- [prompt-assembly-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/prompt-assembly-contract.zh-CN.md)
