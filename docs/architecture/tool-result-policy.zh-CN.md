# Tool Result Policy：`tool_result_persist` 源头治理规则

## 1. 文档目标

这份文档对应 [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-execution-plan.zh-CN.md) 里的“迭代 2.1：定义源头治理规则”。

它要回答的不是“能不能压 tool result”，而是更关键的五个问题：

1. 哪些 tool result 可以安全裁剪
2. 哪些字段绝不能丢
3. 哪些内容只能摘要，不能粗暴截断
4. 被裁剪后的结果应该长成什么样
5. 后续 `explain` 要如何解释裁剪行为

一句话说：

`这份文档是后续实现 tool_result_persist 的边界合同。`

---

## 2. 背景与问题

当前系统已经能在 `assemble()` 和 compaction 链路里压缩会话上下文，但 transcript 的膨胀仍然发生在更早的位置：

`tool output -> 写入 transcript -> 后续 ingest/assemble/compact 再想办法消化`

这条路径的问题是：

- 膨胀已经发生，后续所有模块都要继续为它付成本
- 大量重复日志、长列表、原始文件内容会进入长期历史
- 即使最后 prompt 被压小了，图谱和 transcript 仍然被噪音污染
- 以后做 debug 时，又很难分清“这是原始 tool result”还是“已经被压过的版本”

因此阶段 2 需要把治理前移到：

`tool result 持久化之前`

OpenClaw 的 `tool_result_persist` hook 正好给了这个切入点。根据本地确认结果，它是同步 hook，并且允许在 tool result 写入 transcript 前改写结果对象，见：

- [openclaw-hook-findings.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-hook-findings.zh-CN.md)

---

## 3. 设计目标

`tool_result_persist` 的目标不是“尽可能压小”，而是同时满足四件事：

1. 减少 transcript 体积
2. 保留后续 graph ingest 真正需要的语义信号
3. 保留排障时真正需要的错误上下文
4. 保证裁剪行为可追溯、可解释、可重复

也就是说，这个 hook 不是单纯的字符串截断器，而是：

`带 provenance 的 tool output 编译器`

---

## 4. 总体原则

后续实现必须遵守下面这些原则。

### 原则 1：先分类，再裁剪

不同 tool result 的风险完全不同，不能用一个统一的 `slice(0, N)` 规则处理全部输出。

### 原则 2：先保结构，再压正文

优先保留：

- 工具身份
- 调用上下文
- 执行状态
- 关键结果
- 错误信息
- 来源引用

正文、日志、列表、文件块等才是压缩对象。

### 原则 3：失败结果默认比成功结果更保守

成功结果可以更积极裁剪，失败结果必须更保守地保留错误链路。

### 原则 4：可回查的内容才允许重压缩

如果大块内容后续还能通过文件路径、artifact、URL、hash 回查，就可以只保留摘要和引用。

如果不能回查，就不能把唯一证据直接裁没。

### 原则 5：裁剪产物必须显式标记 `compressed`

被 `tool_result_persist` 处理过的 transcript 项，不能再伪装成原始 tool output。

### 原则 6：deterministic 优先于“看起来更聪明”

阶段 2.1 和 2.2 默认优先本地规则式处理，不把外部 LLM 当主裁剪器。

---

## 5. 术语与对象边界

为了后续实现不混淆，这里先把几个对象定死。

### 5.1 原始 tool result

指 hook 拿到、尚未被本插件裁剪过的宿主工具结果对象。

建议统一视为：

- `originKind = raw`
- `sourceStage = tool_output_raw`

### 5.2 裁剪后 tool result

指经过 `tool_result_persist` 规则处理，最终真正写入 transcript 的对象。

建议统一视为：

- `originKind = compressed`
- `sourceStage = tool_result_persist`
- `producer = compact-context`

### 5.3 外部 artifact

指不再适合直接塞进 transcript 的大块内容，其正文可落到：

- 本地文件
- transcript 外部 sidecar
- 宿主可回查路径

transcript 里只保留摘要、引用和 hash。

当前仓库已经接入一版本地 sidecar artifact：

- 实现位置：
  [tool-result-artifact-store.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/tool-result-artifact-store.ts)
- 默认路径：
  `stateDir/plugins/compact-context/artifacts/tool-results/<hash-prefix>/<content-hash>.json`
- 如果当前运行环境拿不到 `stateDir`：
  - 先回退到 `resolvePath('.openclaw/plugins/compact-context/artifacts/tool-results')`
  - 再回退到当前工作目录下的 `.openclaw/plugins/compact-context/artifacts/tool-results`

当前 sidecar 采用内容寻址策略：

- 用 `contentHash` 作为稳定文件名
- 命中同一份正文时优先复用，避免重复写入
- 文件内容保存为带元信息的 JSON envelope，便于 explain 和人工回查

### 5.4 explain 元信息

指后续为了回答“为什么这样裁”的辅助字段，不直接服务模型，但服务排障和审计。

---

## 6. 源头治理流程图

```text
OpenClaw tool result
-> normalize raw payload
-> classify result kind
-> assess risk / replayability / failure state
-> choose policy
-> keep must-have fields
-> compress oversized fields
-> attach provenance + compression meta
-> persist reduced transcript entry
-> ingest as compressed tool evidence later
```

更细一点的判断顺序建议是：

```text
收到 tool result
-> 是否失败/报错
  -> 是：进入保守策略
  -> 否：继续
-> 是否有稳定结构化字段
  -> 是：优先保结构化字段
  -> 否：继续
-> 是否有可回查 artifact
  -> 是：正文可重压缩
  -> 否：正文只可摘要，不可全部抹掉
-> 是否超过体积阈值
  -> 否：保留原样或轻量标准化
  -> 是：执行对应压缩策略
```

---

## 7. 分类维度

后续策略不要只按 tool name 分类，而要同时看四个维度。

## 7.1 结果形态

- `command_execution`
- `structured_query`
- `search_listing`
- `document_fetch`
- `file_read`
- `patch_apply`
- `test_run`
- `build_run`
- `unknown`

## 7.2 风险等级

- `high`
  - 失败结果
  - 包含错误栈
  - 无可回查来源
- `medium`
  - 成功但对后续决策有强影响
  - 包含结构化关键信号
- `low`
  - 成功且可重放
  - 明显是冗余日志或列表

## 7.3 可回查性

- `replayable`
  - 可通过命令、文件、query 重新得到
- `addressable`
  - 有 path / URL / artifact id 可回查
- `non_recoverable`
  - 当前 transcript 是唯一保留来源

## 7.4 输出状态

- `success`
- `empty`
- `partial`
- `failure`

---

## 8. 最小保留字段合同

无论哪类 tool result，只要发生裁剪，下面这些字段都应尽量保留。

## 8.1 必保留字段

- `toolName`
- `toolCallId`
- `status`
- `startedAt / finishedAt` 或可替代时序字段
- `durationMs` 或可替代耗时字段
- `summary`
- `keySignals`
- `contentHash`
- `truncation` 元信息
- `provenance`

## 8.2 失败时额外必保留

- `error.name`
- `error.message`
- `error.code`
- `exitCode`
- `stderr` 关键片段
- `failedCommand` 或核心请求参数

## 8.3 有回查来源时必保留

- `artifactPath` / `sourcePath` / `sourceUrl`
- `byteLength` / `lineCount` / `itemCount`
- `preview`
- `contentHash`

## 8.4 图谱 ingest 友好字段

为了后续 `ingest-pipeline` 不必硬啃大段正文，建议再保留：

- `resultKind`
- `keyEntities`
- `stateChanges`
- `affectedPaths`
- `riskSignals`
- `decisionSignals`

这些字段允许是轻量提取结果，不要求百分百完整，但要稳定。

---

## 9. 标准压缩产物结构

建议后续统一压缩后 transcript 里的 tool result 结构，不让每类工具各写各的。

```json
{
  "role": "tool",
  "content": {
    "toolName": "shell_command",
    "toolCallId": "call_123",
    "status": "failure",
    "resultKind": "command_execution",
    "summary": "pytest failed in 3 files with 2 assertion errors",
    "keySignals": [
      "exitCode=1",
      "2 assertion errors",
      "1 module import error"
    ],
    "preview": {
      "stdoutHead": "...",
      "stdoutTail": "...",
      "stderrHead": "...",
      "stderrTail": "..."
    },
    "affectedPaths": [
      "src/runtime/context-compiler.ts",
      "tests/context-compiler.test.ts"
    ],
    "error": {
      "name": "ProcessExitError",
      "code": "EXIT_NON_ZERO",
      "message": "pytest exited with code 1"
    },
    "artifact": {
      "path": ".openclaw/artifacts/tool-result/call_123.log",
      "contentHash": "sha256:...",
      "byteLength": 183420
    },
    "truncation": {
      "wasCompressed": true,
      "policyId": "command.failure.v1",
      "reason": "oversized stderr/stdout preserved as head-tail preview + artifact reference",
      "droppedSections": [
        "stdout.middle",
        "stderr.middle"
      ]
    },
    "provenance": {
      "originKind": "compressed",
      "sourceStage": "tool_result_persist",
      "producer": "compact-context",
      "rawSourceId": "call_123",
      "rawContentHash": "sha256:..."
    }
  }
}
```

这不是要求宿主 hook payload 必须长这样，而是要求：

`进入 transcript 的结果，语义上要能稳定映射到这类结构。`

---

## 10. 各类 tool result 的处理策略

这里给出阶段 2.1 推荐的第一版策略矩阵。阶段 2.2 代码实现应严格对齐这张表。

## 10.1 命令执行类：`command_execution`

典型例子：

- shell 命令输出
- git / rg / ls / build / test 结果

### 成功结果

建议保留：

- `toolName`
- `toolCallId`
- `status`
- `command`
- `exitCode`
- `summary`
- `keySignals`
- `affectedPaths`
- `stdout` 的头尾预览
- `stderr` 的头尾预览
- `artifactPath / contentHash`

建议裁掉：

- 大段重复 stdout 中间内容
- 无错误的长 stderr 噪音
- 超长目录列表正文

适合的策略：

- `head + tail + count + hash`

### 失败结果

建议保留：

- 上面成功结果的全部关键字段
- 完整错误消息
- 首个错误块
- 最后一个错误块
- exit code
- 失败命令

不建议：

- 直接只留一句 summary

适合的策略：

- `error-first preserve`

## 10.2 结构化查询类：`structured_query`

典型例子：

- 查询节点
- 查询边
- API 返回 JSON
- 数据库查询

### 成功结果

建议保留：

- 查询参数摘要
- `itemCount`
- 排名前若干条
- 聚合统计
- 去重后的关键字段
- `contentHash`

建议裁掉：

- 超大重复对象数组的完整正文

适合的策略：

- `schema-preserve + top-k + aggregate`

### 失败结果

建议保留：

- 查询参数
- 错误码
- 错误消息
- 关键响应头或失败上下文

## 10.3 搜索列表类：`search_listing`

典型例子：

- 文件列表
- grep/search 命中列表
- web search 标题列表

### 成功结果

建议保留：

- `query`
- `totalHits`
- 前 `N` 条命中
- 去重路径/URL
- 统计信息

建议裁掉：

- 上百条重复命中
- 长片段重复 preview

适合的策略：

- `dedupe + top-k + totals`

## 10.4 文档/文件读取类：`document_fetch` / `file_read`

典型例子：

- 读取源码文件
- 打开长文档
- 拉取超长网页正文

### 成功结果

如果后续可通过 path/url 回查，建议保留：

- `sourcePath` / `sourceUrl`
- `lineRange` / `byteLength`
- `previewHead`
- `previewTail`
- `sectionSummary`
- `contentHash`

如果当前 transcript 是唯一来源，建议保留：

- 更多 preview
- 更完整 section 级摘要

不建议：

- 对不可回查正文直接清空，只留一句总结

适合的策略：

- `source-ref + section-summary + preview`

## 10.5 补丁应用类：`patch_apply`

典型例子：

- apply_patch
- 编辑器批量写入结果

建议保留：

- 目标文件列表
- 变更类型
- 成功/失败状态
- 失败原因
- patch hash

如果补丁正文很长：

- transcript 只保留 patch 摘要与 hash
- 正文存 artifact 或直接回查文件 diff

## 10.6 构建/测试类：`build_run` / `test_run`

这两类本质上还是命令执行，但值得单独保守处理，因为它们常承载关键信号。

建议保留：

- 执行命令
- 用例数 / 通过数 / 失败数
- 首个失败
- 最后失败
- 失败文件
- 栈信息摘要
- exit code
- artifact 引用

适合的策略：

- `result-summary + failure-slices + artifact-ref`

## 10.7 未知类型：`unknown`

当无法可靠分类时，不要激进裁剪。

建议策略：

- 轻度标准化
- 超阈值时只做头尾预览
- 必保 provenance 和 hash

一句话说：

`unknown 默认保守，不默认重压缩。`

---

## 11. 哪些内容绝不能直接裁没

下面这些内容一旦存在，就不能在第一版策略里直接抹掉。

- 错误码和错误消息
- exit code
- 工具调用标识
- 执行命令或核心请求参数
- 受影响文件路径
- 可回查 artifact 的定位信息
- 原始内容 hash
- 告诉 explain “裁掉了什么”的元信息

对于失败结果，再额外加上：

- 第一处失败现场
- 最后一处失败现场
- 关键异常类型

---

## 12. 哪些内容可以积极裁剪

这些内容在满足可回查或可统计前提下，可以第一版就积极裁剪。

- 大段重复日志
- 超长列表正文
- 结构化对象数组中的重复字段
- 可通过路径回看的长文件正文
- 可通过 artifact 回看的长 stdout/stderr 中段
- 无错误的成功命令详细噪音

---

## 13. Explain 合同

后续 `explain` 不只要能解释“这条 node 来自哪里”，还要能解释“为什么这个 tool result 被压成这样”。

因此压缩元信息至少要支持下面这些问题：

1. 这条 tool result 是否被压缩过
2. 使用的是哪条 policy
3. 为什么适用这条 policy
4. 裁掉了哪些 section
5. 哪些 section 被保留为 preview
6. 是否存在 artifact / sourceRef 可回查
7. 原始内容 hash 是什么

建议 explain 可依赖的最小字段：

- `truncation.wasCompressed`
- `truncation.policyId`
- `truncation.reason`
- `truncation.droppedSections`
- `artifact.path`
- `provenance.rawSourceId`
- `provenance.rawContentHash`

---

## 14. 推荐实现方式

阶段 2.1 先把实现方式也收敛清楚，避免阶段 2.2 重新分叉。

## 14.1 方式 A：纯本地规则引擎

做法：

- 按 tool name / payload shape 分类
- 按状态、大小、是否可回查选择 policy
- 本地完成裁剪和标准化

优点：

- 可控
- 可测试
- 可重复
- explain 容易做

缺点：

- 初期覆盖面有限

结论：

- 阶段 2.2 的默认实现方式

## 14.2 方式 B：source-specific normalizer

做法：

- 为不同 tool 类型单独实现 normalizer
- 例如：
  - `shell`
  - `file_read`
  - `search`
  - `json_query`

优点：

- 表达力更强
- 便于逐类提升质量

缺点：

- 文件数会增加
- 需要统一抽象层

结论：

- 推荐作为阶段 2.2 的代码组织方式

## 14.3 方式 C：规则引擎 + artifact sidecar

做法：

- transcript 里只放压缩结果
- 超长正文另存 sidecar artifact

优点：

- transcript 瘦身效果最好
- 排障仍可回查

缺点：

- 需要管理 artifact 路径和清理策略

结论：

- 推荐作为阶段 2.2 的增强方案

## 14.4 方式 D：外部 LLM 参与摘要

做法：

- 对无法规则化处理的超长结果调用 LLM 生成摘要

优点：

- 某些复杂文本可读性更好

缺点：

- 成本高
- 可重复性差
- 容易把错误现场摘要坏
- explain 复杂

结论：

- 阶段 2 不作为主链依赖
- 最多做后续可选增强层

---

## 15. 对当前仓库的落点建议

结合当前仓库结构，推荐后续代码落点如下。

## 15.1 新增模块

- `packages/openclaw-adapter/src/openclaw/tool-result-policy.ts`
  - 分类
  - policy 选择
  - 保留字段合同
- `packages/openclaw-adapter/src/openclaw/tool-result-normalizer.ts`
  - 归一化不同 payload 形态
- 可选：`packages/openclaw-adapter/src/openclaw/tool-result-artifact-store.ts`
  - sidecar artifact 落盘

## 15.2 现有模块修改

- [types.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/types.ts)
  - 补 `tool_result_persist` hook 类型
- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/hook-coordinator.ts)
  - 注册并处理 `tool_result_persist`
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)
  - 识别压缩后 tool result 的 provenance 和 metadata
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
  - 优先消费压缩后结构化字段，而不是只吃长正文
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
  - 输出 tool result 裁剪原因

## 15.3 后续阶段衔接

这份 policy 文档完成后，阶段 2 的推进顺序就变成：

1. 依据本文件实现 `tool_result_persist`
2. 让 ingest 利用压缩产物里的结构化字段
3. 让 explain 输出裁剪原因

---

## 16. 验收条件

如果后续实现符合下面这些条件，就可以认为这份 policy 被正确执行了。

1. 超大 tool result 不再完整写入 transcript
2. 同一类 tool result 的压缩结果稳定一致
3. 失败结果仍能支撑 debug
4. graph ingest 仍能拿到关键状态和证据信号
5. explain 能回答“为什么压了、压掉了什么、去哪回查”

---

## 17. 一句话总结

`tool_result_persist` 的核心不是“把工具输出变短”，而是“在不丢关键语义、错误现场和来源追溯的前提下，把大 tool result 编译成可持久化、可入图、可解释的压缩对象”。`



