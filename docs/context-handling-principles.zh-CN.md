# 上下文处理原则整理：压缩、证据、图谱与溯源

## 1. 文档目标

这份文档整理本轮关于“上下文处理”的讨论结论，重点回答下面几个问题：

1. 上下文应该怎么压缩，才不容易影响 LLM 对需求的理解
2. 原文证据应该存在哪里
3. 图谱应该用原文建，还是用压缩后的历史建
4. 怎么系统性地区分“原文”和“已经压缩过的内容”
5. 当前仓库后续实现时，应该坚持哪些设计原则

这份文档不是新的总体架构稿，而是当前实现阶段的设计基线。

---

## 2. 核心结论

本轮讨论最终收敛成下面五条核心原则：

1. `上下文压缩和知识沉淀应该走同一条链路，而不是两套系统`
2. `图谱主干应优先来自原文，而不是来自压缩摘要`
3. `LLM 看到的最终上下文不应该是“全量摘要”，而应该是 structured bundle + recent raw tail`
4. `原文、压缩内容、派生产物必须在数据模型里显式区分`
5. `外部 API 只适合做增强层，不适合接管主链路`

---

## 3. 为什么不能把所有上下文一起压缩

如果把所有上下文一起压成一段摘要，LLM 对需求的理解很容易发生偏移。

最常见的问题有：

- 需求被概括对了，但关键边界丢了
- 硬约束被弱化，模型开始自作主张
- 之前已经排除的方案又被重新提出
- 多阶段任务里，模型忘记当前所处步骤
- 最近几轮上下文衔接被破坏，回答开始“像重新开题”

因此，不能把“压缩”理解成“写一段更短的话”。

更稳的理解应该是：

`压缩 = 把旧历史编译成结构化状态，同时保留最近仍然重要的原始对话尾部。`

---

## 4. 推荐的压缩策略

当前最推荐的策略不是“纯摘要替换历史”，而是：

```text
older history
-> 图谱入库
-> 编译 RuntimeContextBundle
-> prompt 中仅保留 structured bundle + recent raw tail
```

也就是：

- 最近几轮 `raw` 对话不压，直接保留
- 当前目标、约束、流程位置、风险等关键信息结构化保留
- 更早历史不再原样进入 prompt，而由 bundle / checkpoint 代表

### 4.1 不建议重压的上下文

下面这些内容一旦压狠了，最容易影响模型理解：

- 当前用户目标
- 明确要求和交付边界
- 硬约束与禁止项
- 当前所处流程步骤
- 最近关键决策
- 尚未解决的分歧、风险和 blocker
- 极少量但关键的原文证据

### 4.2 可以优先压缩的上下文

下面这些通常可以 aggressively 压缩：

- 礼貌性往返
- 重复确认
- 已过期状态
- 长工具输出原文
- 已被图谱吸收的历史闲聊
- 重复出现、无新增信息的说明

### 4.3 推荐的 prompt 形态

最稳的 prompt 形态应是：

```text
system / policy / rules
+ structured runtime bundle
+ recent raw conversation tail
```

而不是：

```text
一大段对全历史的自由摘要
```

---

## 5. 原文证据应该存在哪里

原文证据不应该只存一处，最好按“原始事实源 + 图谱副本 + 来源索引”分层保存。

### 5.1 当前仓库里已经存在的三层

#### 第一层：原始事实源

主要是 OpenClaw transcript JSONL。

特点：

- 保留最接近宿主真相的原始记录
- 包含 `message / custom_message / compaction` 等原始 entry
- 是恢复历史和审计时的第一来源

#### 第二层：图谱中的证据副本

当前仓库会把每条上下文先转成 `Evidence` 节点。

特点：

- 在 `payload.content` 中保留证据内容
- 便于图谱内统一查询、编译和解释
- 适合中短文本证据

#### 第三层：来源索引

当前仓库已有 `sources` 表。

特点：

- 保存 `sourceType / sourcePath / sourceSpan / contentHash / extractor`
- 负责定位与校验
- 不承担全文正文仓库职责

### 5.2 推荐的证据分层方案

后续建议正式收敛为三种存法：

#### 小文本证据

例如：

- 用户消息
- 助手短决策
- 规则短句

建议：

- 直接落在 `Evidence.payload.content`

#### 中等文本证据

例如：

- 较长说明
- 一段工具结果摘要
- 一段流程文档

建议：

- SQLite 里存 `preview + sourceRef`
- 全文仍可从 transcript 或原文件回查

#### 超长证据

例如：

- 很长的工具输出
- 大段日志
- 大型文档片段

建议：

- 正文落本地 `artifacts/` 文件
- SQLite 只存：
  - `artifactPath`
  - `contentHash`
  - `preview`
  - `sourceRef`

---

## 6. 图谱应该用原文还是压缩历史来构建

结论非常明确：

`图谱主干优先用原文构建，压缩历史只做辅助层，不做唯一事实源。`

### 6.1 为什么图谱主干必须来自原文

原因有四个：

1. 原文保留了真实细节和边界
2. 原文更容易做来源追踪
3. 压缩结果往往混合了事实、推断和总结
4. 如果反复用摘要入图，会逐轮放大误差

### 6.2 压缩历史适合扮演什么角色

压缩历史不是没用，而是定位要更保守。

更适合的角色是：

- `Checkpoint`
- `Delta`
- `Derived State`
- `Summary Node`
- `Skill Candidate`

也就是说：

- 原文负责“证据与事实输入”
- 压缩结果负责“恢复和加速”

### 6.3 最不推荐的路径

最危险的链路是：

```text
原文
-> 摘要
-> 再拿摘要入图
-> 下次再对摘要做摘要
-> 再继续入图
```

这会让图谱逐渐远离原始事实。

### 6.4 推荐原则

建议坚持：

```text
图谱主干来自原文
压缩结果来自图谱
不要反过来让压缩结果成为图谱真相
```

---

## 7. 如何确保系统能区分“原文”和“压缩过的内容”

这件事不能靠后期猜文本风格，必须在数据进入系统的第一跳就显式打标签。

### 7.1 当前仓库已经有的基础

当前仓库已经能部分区分来源：

- transcript 有不同 `type`
  - `message`
  - `custom_message`
  - `compaction`
- loader 会把 `compaction` 单独识别出来
- ingest 时会保留 `sourceType` 和 `sourceRef`

这说明系统已经具备“初步可分”的能力。

### 7.2 仍然缺少的关键能力

目前还缺一个统一的 provenance 模型。

也就是说，现在是：

- 某些地方能看出来

但还不是：

- 所有上下文对象都能系统性、稳定地分清 `raw / compressed / derived`

### 7.3 推荐增加的 provenance 字段

建议在 `RawContextRecord.metadata` 和 `GraphNode.payload` 中都统一加入：

```ts
{
  provenance: {
    originKind: "raw" | "compressed" | "derived",
    sourceStage:
      | "transcript_message"
      | "transcript_custom"
      | "transcript_compaction"
      | "checkpoint"
      | "skill_candidate"
      | "tool_summary"
      | "document_extract",
    producer: "openclaw" | "compact-context" | "user" | "assistant" | "system" | "tool",
    rawSourceId?: string,
    rawContentHash?: string,
    derivedFromIds?: string[],
    compressionRunId?: string
  }
}
```

### 7.4 推荐的判定规则

建议把判定规则写死，不要靠运行时推理：

| 输入来源 | originKind | 说明 |
| --- | --- | --- |
| `transcript.message` | `raw` | 原始消息 |
| 原始规则文件 / 原始文档 | `raw` | 原始事实输入 |
| 工具原始输出 | `raw` | 原始运行证据 |
| `transcript.compaction` | `compressed` | 宿主或插件做过压缩后的摘要 |
| `systemPromptAddition` | `compressed` 或不入图 | 运行时压缩上下文，不应当成原文 |
| `checkpoint` | `derived` | 从 bundle 派生的稳定快照 |
| `skill_candidate` | `derived` | 模式结晶结果 |

### 7.5 查询时的优先级

查询图谱时建议采用以下优先级：

1. 优先召回 `raw`
2. 若 `raw` 不足，再补少量 `compressed`
3. `derived` 主要用于恢复、加速和候选提示

进一步说：

- 高可信规则不应只从 `compressed` 中提升
- 关键回答应尽量能追溯到 `raw evidence`

---

## 8. 当前仓库实现的建议边界

当前仓库后续实现时，建议坚持下面这些边界。

### 8.1 主链必须自己实现

这些部分不建议依赖外部 API：

- hook 接入
- transcript 读取与 branch 恢复
- `RawContextRecord` 标准化
- `Evidence` / `Semantic Node` 建模
- SQLite 图谱持久化
- `RuntimeContextBundle` 编译
- `assemble()` 压缩
- checkpoint / delta / skill candidate

原因：

- 这是系统主干
- 需要稳定、可调试、可审计
- 不应被外部服务可用性绑架

### 8.2 外部 API 只做增强层

后续可选接入的部分：

- 复杂规则 / 约束 / 流程抽取
- 超长工具输出压缩
- embedding / rerank
- skill 命名与边界润色

原则是：

`API 只增强抽取和排序，不接管存储、裁决和压缩主链。`

---

## 9. 当前仓库最值得继续补强的点

基于本轮讨论，当前最值得继续做的不是推翻现有链路，而是补强下面几项：

### 9.1 统一 provenance 模型

目标：

- 系统性区分 `raw / compressed / derived`

价值：

- 为后续 explain、冲突裁决、证据回查打基础

### 9.2 更细粒度的本地抽取

目标：

- 不只按角色映射 `Intent / Decision / State`
- 还要识别：
  - `Constraint`
  - `Process / Step`
  - `Risk`

### 9.3 `tool_result_persist`

目标：

- 在工具结果进入 transcript 之前就做瘦身

价值：

- 从源头减轻后续上下文膨胀

### 9.4 bundle 级 explain

目标：

- 解释：
  - 为什么某条知识被选入 bundle
  - 为什么某条历史被压掉
  - 为什么某个风险仍然是 open

### 9.5 FTS / 检索增强

目标：

- 提升本地召回能力

价值：

- 在不引入外部向量服务的情况下，先把本地能力做扎实

---

## 10. 最终设计基线

这一轮讨论后，建议把下面这些话当作后续实现时的设计基线：

### 基线 1

`压缩不是总结，而是编译。`

### 基线 2

`图谱主干来自原文，压缩结果来自图谱。`

### 基线 3

`原文、压缩内容、派生产物必须显式区分。`

### 基线 4

`最终 prompt 不应是全历史摘要，而应是 structured bundle + recent raw tail。`

### 基线 5

`外部 API 只做增强层，不做主链依赖。`

---

## 11. 一句话总结

对这个项目来说，正确的上下文处理方式不是“把所有历史压成一段摘要”，而是：

`保留原文证据、把旧历史编译成结构化状态、明确区分 raw/compressed/derived，并让图谱、压缩、checkpoint、skill 沉淀始终围绕同一条主链闭环运行。`
