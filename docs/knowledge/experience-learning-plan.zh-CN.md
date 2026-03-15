# 试错学习与经验晋升方案

配套阅读：
- 阶段 4 第二轮增强 TODO：[stage-4-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-todo.zh-CN.md)
- 总体路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- 多层知识图谱架构：[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)
- Schema 治理方案：[schema-governance-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/schema-governance-plan.zh-CN.md)
- Traceability 方案：[traceability-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/traceability-plan.zh-CN.md)

## 1. 文档目标

这份文档专门回答一个问题：

`OpenClaw / Agent 在一步步试错学习时，如何把“做过的尝试”区分成噪音、失败经验、中间探索和可复用知识，并最终沉淀成规则、流程、步骤和技能。`

它重点回答：

1. 为什么不能把失败尝试直接删除
2. 什么样的过程对象需要被单独建模
3. 如何从 `Attempt` 逐步晋升到 `Skill / Rule / Process`
4. 这些对象在运行时 prompt 和长期记忆里分别怎么用
5. 这条线如何接进现有 `graph + compiler + checkpoint + skill` 主链

一句话结论：

`试错学习的正确做法不是“删掉错的”，而是把错误路径降级为负向知识，把成功路径收敛为流程知识，把重复稳定成功的模式晋升为长期技能。`

## 2. 核心原则

### 2.1 不直接删除失败

失败尝试通常至少还有三种价值：

- 作为 `FailureSignal`
  用来提醒当前任务哪些路径高风险
- 作为 `NegativePattern`
  用来沉淀“在条件 C 下，方法 A 常失败”
- 作为 explain 依据
  用来回答“为什么当前不建议继续走这条路”

所以失败路径的正确处理不是删除，而是：

- 从主 prompt 里降级或移除
- 从主 recall 里降权
- 在长期记忆里进入 decay / retire
- 但保留 traceability 和回查能力

### 2.2 知识晋升必须分层

不是所有执行过程都直接进知识库。必须经过：

```text
Trace -> Attempt -> Episode -> Pattern -> Skill / Rule / Process
```

也就是：

- 原始行为先保留为执行事实
- 多个步骤组成一次尝试
- 多次尝试围绕一个目标构成一个 episode
- 多个 episode 才能稳定提炼出 pattern
- 只有稳定 pattern 才晋升为长期知识

### 2.3 运行时上下文和长期知识必须分离

运行时 prompt 只需要：

- 当前最相关的成功路径
- 高价值失败警告
- 当前目标下的关键步骤和约束

长期记忆则保留：

- 全部尝试 lineage
- 失败经验
- 过程模式
- 晋升后的技能与规则

## 3. 对象模型

## 3.1 Trace

最底层对象仍然是已经存在的事实层：

- `Evidence`
- `Decision`
- `State`
- `Outcome`
- `Risk`
- `Tool`
- `Process`
- `Step`

它们负责描述：

- 做了什么
- 看到了什么
- 发生了什么

但它们还不足以表达“一次尝试是否成功、为什么失败、完整流程是哪条”。

## 3.2 Attempt

`Attempt` 表示围绕一个局部目标的单次尝试。

建议最小字段：

```ts
type Attempt = {
  id: string;
  sessionId: string;
  workspaceId?: string | null;
  goalLabel?: string | null;
  query?: string | null;
  startAt: string;
  endAt?: string | null;
  status: 'running' | 'success' | 'failure' | 'partial';
  stepNodeIds: string[];
  decisionNodeIds: string[];
  stateNodeIds: string[];
  outcomeNodeIds: string[];
  riskNodeIds: string[];
  evidenceNodeIds: string[];
  failedReason?: string | null;
  successSignals?: string[];
  failureSignals?: string[];
  provenance: ProvenanceRef;
};
```

语义上：

- 一次 `Attempt` 可以只有一步
- 也可以是多步连续动作
- 最终必须有状态判断：成功、失败或部分成功

## 3.3 Episode

`Episode` 表示围绕同一目标的一组尝试。

建议最小字段：

```ts
type Episode = {
  id: string;
  sessionId: string;
  workspaceId?: string | null;
  goalLabel?: string | null;
  query?: string | null;
  attemptIds: string[];
  winningAttemptId?: string | null;
  status: 'open' | 'resolved' | 'abandoned';
  successPathStepNodeIds: string[];
  failedAttemptIds: string[];
  keyFailureSignals: string[];
  keySuccessSignals: string[];
  provenance: ProvenanceRef;
};
```

它负责表达：

- 这个任务一共试了哪些路径
- 哪条最终成功
- 哪些失败路径值得保留为经验

## 3.4 FailureSignal / NegativePattern

`FailureSignal` 是就地的失败征兆，通常来自一次尝试。

例如：

- 命令报错
- 某步导致状态冲突
- 某路径被证明无效

`NegativePattern` 则是跨尝试或跨 episode 的提炼结果。

例如：

- “在条件 C 下，先改配置文件再启动服务通常失败”
- “直接跳过步骤 D 往往导致最终校验失败”

建议关系：

- `Attempt -> emits -> FailureSignal`
- `Episode / PatternMiner -> derives -> NegativePattern`

## 3.5 ProcedureCandidate / CriticalStep

`ProcedureCandidate` 表示候选成功流程。

例如：

```text
C -> D -> E
```

`CriticalStep` 表示关键步骤：

- 跳过它会失败
- 顺序不对会失败
- 它是从失败转向成功的转折点

建议最小字段：

```ts
type ProcedureCandidate = {
  id: string;
  episodeId?: string | null;
  attemptId?: string | null;
  stepNodeIds: string[];
  prerequisiteNodeIds: string[];
  successSignalIds: string[];
  failureIfSkipped: boolean;
  confidence: number;
  provenance: ProvenanceRef;
};
```

## 3.6 Pattern / Skill / Rule / Process

这是最终的知识晋升层。

建议职责分工：

- `Pattern`
  中间层，表达一个稳定可复用的经验模式
- `Process`
  强调完整流程
- `Step`
  强调流程中的单步职责
- `Rule / Constraint`
  强调应该做或不要做
- `Skill`
  强调在某类任务下可复用的复合能力

## 4. 试错学习主链

建议主链如下：

```text
Raw Context
-> Evidence / Semantic Nodes
-> Attempt Builder
-> Episode Grouper
-> Pattern Miner
-> Knowledge Promotion
-> Compiler / Checkpoint / Skill Persistence
```

分解如下。

### 4.1 Attempt Builder

从已有的 `Decision / State / Outcome / Risk / Step / Tool` 中组装单次尝试。

归组依据可以先从最小规则开始：

- 同一轮或连续若干轮消息
- 同一目标或 query
- 同一 process / current step
- 连续工具调用与状态变化

### 4.2 Episode Grouper

把围绕同一目标的多次尝试归到一个 episode。

最小归组依据：

- 同 `sessionId`
- goal / intent 高相似
- 时间上连续
- 同一 process lineage

### 4.3 Pattern Miner

从多个 attempt / episode 中提炼：

- `FailurePattern`
- `SuccessfulProcedure`
- `CriticalStep`
- `NegativeConstraintCandidate`

这里要特别强调：

- 一次成功不足以直接生成长期技能
- 一次失败也不足以生成硬约束

### 4.4 Knowledge Promotion

把 pattern 晋升为长期知识。

建议晋升链：

```text
Attempt
-> Episode
-> Pattern
-> Process / Rule / Constraint / Skill
```

## 5. 晋升规则

建议至少有 6 个判断维度：

1. `frequency`
   同类模式出现了多少次
2. `successRate`
   该模式成功率如何
3. `stability`
   不同 session / workspace 下是否稳定
4. `transferability`
   是否只在单次任务有效
5. `evidenceCount`
   证据是否足够
6. `contradictionCount`
   是否存在相反成功案例

建议最小策略：

- 低频成功
  只生成 `ProcedureCandidate`
- 高频成功
  才考虑晋升 `Process / Skill`
- 低频失败
  只生成 `FailureSignal`
- 高频失败
  才考虑晋升 `NegativePattern / Constraint`

## 6. 运行时如何消费

## 6.1 主 prompt

运行时 bundle 只优先带：

- 当前目标下的成功路径
- 必须遵守的关键步骤
- 高置信失败警告
- 与当前任务最相关的负向约束

不建议直接把完整 attempt history 送进 prompt。

## 6.2 explain / debug

完整的尝试过程、失败链和 episode lineage 更适合在 explain 里看。

建议 explain 至少回答：

- 这条规则来自哪个 pattern
- 这个 pattern 来自哪些 episode
- 有没有失败反例
- 当前为什么压过了另一条路径

## 6.3 checkpoint / skill persistence

建议：

- `Attempt / Episode`
  更偏 trace / persistence 对象
- `Pattern / SuccessfulProcedure / FailurePattern`
  更偏长期沉淀候选
- `Skill / Rule / Process`
  只有晋升后才进入更高权重的 recall

## 7. 例子

假设有一个任务：

1. 先试 `A`，失败
2. 再试 `B`，失败
3. 最后 `C -> D -> E` 成功

建议系统这样表示。

### 7.1 Attempt 层

- `Attempt 1`
  - steps: `A`
  - status: `failure`
  - failureSignals: `signal:a_invalid`

- `Attempt 2`
  - steps: `B`
  - status: `failure`
  - failureSignals: `signal:b_invalid`

- `Attempt 3`
  - steps: `C -> D -> E`
  - status: `success`
  - successSignals: `signal:task_completed`

### 7.2 Episode 层

- `Episode X`
  - attemptIds: `[1, 2, 3]`
  - winningAttemptId: `3`
  - successPathStepNodeIds: `[C, D, E]`
  - keyFailureSignals: `[signal:a_invalid, signal:b_invalid]`

### 7.3 Pattern 层

- `NegativePattern`
  - 在条件 X 下，`A` 常失败
- `NegativePattern`
  - 在条件 X 下，`B` 常失败
- `ProcedureCandidate`
  - 在条件 X 下，`C -> D -> E` 是成功路径
- `CriticalStep`
  - `D` 是关键步骤

### 7.4 晋升层

如果多个 episode 都重复验证：

- `Constraint`
  - 不要使用 `A`
- `Constraint`
  - 不要使用 `B`
- `Process`
  - 标准流程为 `C -> D -> E`
- `Skill`
  - 在条件 X 下完成任务 T 的稳定技能

## 8. 与现有代码主链的接缝

建议分阶段接入。

### 8.1 阶段 4 第二轮

优先接：

- `Attempt`
- `Episode`
- `FailureSignal`
- `ProcedureCandidate`
- `CriticalStep`

对应任务已排进：
- [stage-4-second-pass-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-second-pass-todo.zh-CN.md)

### 8.2 阶段 5

再做：

- `FailurePattern`
- `SuccessfulProcedure`
- `Attempt -> Episode -> Pattern -> Skill / Rule / Process` 晋升合同
- 跨任务与高 scope 的长期治理

## 9. 推荐实现顺序

1. 在阶段 4 第二轮落 `Attempt / Episode` schema
2. 让语义抽取层能识别失败信号、成功信号、关键步骤
3. 让 ingest 把这些对象写进统一图谱主链
4. 让 compiler 学会消费“成功路径 + 失败警告”
5. 让 evaluation harness 评估这条学习链
6. 再进入阶段 5 的 pattern miner 和知识晋升

## 10. 一句话总结

`我们要做的不是把试错过程压扁成一段总结，而是把它分层沉淀成“尝试、任务周期、失败经验、成功流程和长期技能”这套经验学习体系。`

