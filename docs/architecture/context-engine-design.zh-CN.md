# OpenClaw Context Engine 详细设计文档

## 1. 文档目标

本文档定义一个面向 OpenClaw 的 Context Engine。该引擎的职责不是简单检索上下文，而是把原始上下文编译成三个可复用产物：

1. 知识图谱：把上下文中的事实、规则、流程、约束、状态和技能关系结构化。
2. 压缩上下文：把当前任务真正需要的最小上下文包编译出来，避免 token 爆炸。
3. Skill 候选：从重复出现且稳定有效的上下文模式中沉淀出可执行 Skill。

本文档重点解决以下问题：

- 如何让 OpenClaw 持续吸收上下文而不是只消费上下文。
- 如何降低长会话导致的 token 浪费和状态漂移。
- 如何让规则、流程、约束、技能成为一等公民。
- 如何把“临时经验”稳定地转化成可复用能力。

## 2. 背景与问题定义

OpenClaw 的运行并不只围绕代码。它还依赖：

- 规则
- 流程
- 约束
- 技能
- 运行模式
- 工具能力
- 当前任务状态
- 历史会话中的决策与结论

如果这些信息只以自然语言散落在上下文中，会产生以下问题：

- 会话越长，token 成本越高。
- 规则和建议容易混淆。
- 历史状态容易污染当前任务。
- 同类任务每次都要重新解释一遍。
- 技能沉淀依赖人工整理，成本高且容易出错。

因此需要一个 Context Engine，把原始上下文转换成机器可治理、可编译、可沉淀的结构化记忆。

## 3. 核心设计目标

### 3.1 目标

1. 让上下文不再只是原始文本，而是可计算的语义对象。
2. 让图谱承担组织、推导和复用的职责，而不是替代原始证据。
3. 让运行时上下文只包含当前真正需要的最小状态。
4. 让稳定模式能够自动沉淀成 Skill 候选。
5. 让每一条重要知识都可追溯、可裁决、可版本化。

### 3.2 非目标

1. 不在第一版追求全自动、无人工监督的完美知识抽取。
2. 不在第一版追求大规模分布式图数据库。
3. 不在第一版追求复杂图查询语言或全功能可视化平台。
4. 不让模型直接决定“真相”，而是让模型只提供候选结构。

## 4. 产品定位

Context Engine 的定位是：

`Context Compiler + Graph Memory + Skill Crystallizer`

其本质不是“检索插件”，而是“上下文治理与能力沉淀引擎”。

它有三条输出链路：

1. 面向长期复用的 `Graph Memory`
2. 面向当前请求的 `Runtime Context`
3. 面向能力沉淀的 `Skill Candidate`

## 5. 核心设计原则

### 5.1 证据优先

任何进入正式图谱的知识都必须尽可能绑定来源。没有来源的内容只能进入候选区，不能直接成为高优先级知识。

### 5.2 规范与事实分离

系统必须明确区分：

- `Fact`：事实
- `Norm`：规范
- `Process`：流程
- `State`：状态
- `Inference`：推断

否则查询时会把建议当规则，把历史状态当当前状态。

### 5.3 先裁决，后召回

查询上下文不能先搜文本再拼接，而应先判断当前场景，激活当前生效规则和流程，再召回支撑证据。

### 5.4 压缩不是总结，而是编译

压缩上下文不能只是生成一段摘要。它必须保留当前目标、规则、约束、流程位置和必要证据，并且丢弃闲聊和过时状态。

### 5.5 Skill 来自模式稳定化

Skill 不应完全依赖人工手写。系统应从重复出现、边界清晰、结果稳定的图谱子结构中发现并生成 Skill 候选。

## 6. 总体架构

整体架构如下：

```text
Raw Context Sources
  |- 对话
  |- 文档
  |- AGENTS / 规则文件
  |- 技能说明
  |- 工具输出
  |- 历史任务记录

        |
        v

Ingest Pipeline
  |- Parse
  |- Normalize
  |- Segment
  |- Classify

        |
        v

Atomic Memory Layer
  |- Fact
  |- Norm
  |- Process
  |- Constraint
  |- State
  |- Decision
  |- Outcome
  |- Evidence

        |
        v

Graph Builder
  |- Node/Edge Construction
  |- Dedup
  |- Conflict Detection
  |- Versioning
  |- Scope Assignment

        |
        +--------------------+
        |                    |
        v                    v

Graph Memory           Checkpoint Manager
  |- Global Graph        |- Session Checkpoint
  |- Workspace Graph     |- Delta
  |- Session Graph       |- Recent State

        |                    |
        +---------+----------+
                  |
                  v

Context Compiler
  |- Intent Resolution
  |- Rule Activation
  |- Conflict Resolution
  |- Procedure Selection
  |- Evidence Packing
  |- Token Budgeting

                  |
                  v

Runtime Context Bundle

                  |
                  v

Skill Crystallizer
  |- Pattern Mining
  |- Stability Check
  |- Candidate Scoring
  |- Skill Packaging
```

## 7. 关键概念模型

### 7.1 原始上下文

原始上下文包括所有未加工输入：

- 用户对话
- 助手回答
- 工具执行结果
- 文档原文
- 本地规则文件
- 技能说明文件
- 历史 checkpoint

原始上下文用于归档和审计，不直接完整进入运行 prompt。

### 7.2 原子记忆

原子记忆是对原始上下文进行最小语义切分后的结果。第一版建议支持以下类型：

- `Fact`
- `Norm`
- `Process`
- `Constraint`
- `State`
- `Decision`
- `Outcome`
- `Evidence`

这些对象是图谱构建和上下文压缩的共同输入。

### 7.3 图谱记忆

图谱记忆承担长期语义组织职责。它不负责存储所有细节文本，而负责：

- 节点化
- 关系化
- 优先级和作用域表达
- 冲突显式表示
- 版本与时效表达

### 7.4 运行时上下文

运行时上下文不是历史摘要，而是为当前任务编译出的最小行动包。其内容应该足以支持当前决策，但不能无限膨胀。

### 7.5 Skill 候选

Skill 候选是一种来自图谱模式挖掘的半结构化产物。它不是“任何模式”，而是满足稳定性和适用性要求的可复用能力结构。

## 8. 数据作用域设计

为了防止知识污染和状态混乱，所有知识必须带 `scope`：

- `global`
- `workspace`
- `session`

### 8.1 Global

存放跨项目稳定知识，例如：

- OpenClaw 的通用规则
- 模式限制
- 已安装技能定义
- 通用流程模板
- 工具能力声明

### 8.2 Workspace

存放某个工作区或项目特有知识，例如：

- 项目规则
- AGENTS.md 派生知识
- 团队流程
- 项目术语
- 项目特定约束

### 8.3 Session

存放本轮或近期运行时知识，例如：

- 当前目标
- 激活规则
- 当前流程节点
- 最近决策
- 最近错误
- 最新 checkpoint 和 delta

## 9. 节点与边模型

### 9.1 节点类型

第一版建议节点类型限制在以下范围：

- `Rule`
- `Constraint`
- `Process`
- `Step`
- `Skill`
- `State`
- `Decision`
- `Outcome`
- `Evidence`
- `Goal`
- `Intent`
- `Tool`
- `Mode`

### 9.2 边类型

第一版建议边类型限制在以下范围：

- `applies_when`
- `requires`
- `forbids`
- `permits`
- `overrides`
- `next_step`
- `uses_skill`
- `supported_by`
- `derived_from`
- `conflicts_with`
- `supersedes`
- `produces`

### 9.3 节点必填字段

每个节点至少包含：

```json
{
  "id": "node_xxx",
  "type": "Rule",
  "scope": "global",
  "kind": "norm",
  "label": "Default mode forbids request_user_input",
  "payload": {},
  "strength": "hard",
  "confidence": 1.0,
  "source_ref": {
    "source_type": "instruction",
    "source_path": "developer_message",
    "span": "..."
  },
  "version": "v1",
  "valid_from": "2026-03-13T00:00:00Z",
  "valid_to": null,
  "updated_at": "2026-03-13T00:00:00Z"
}
```

### 9.4 边必填字段

每条边至少包含：

```json
{
  "id": "edge_xxx",
  "from_id": "node_a",
  "to_id": "node_b",
  "type": "forbids",
  "scope": "global",
  "strength": "hard",
  "confidence": 1.0,
  "source_ref": {
    "source_type": "instruction"
  },
  "version": "v1",
  "valid_from": "2026-03-13T00:00:00Z",
  "valid_to": null,
  "updated_at": "2026-03-13T00:00:00Z"
}
```

## 10. 语义标签体系

每条知识至少带以下语义标签：

- `kind`
  - `fact`
  - `norm`
  - `process`
  - `state`
  - `inference`

- `strength`
  - `hard`
  - `soft`
  - `heuristic`

- `scope`
  - `global`
  - `workspace`
  - `session`

- `freshness`
  - `active`
  - `stale`
  - `superseded`

这个标签体系用于：

- 查询裁决
- 冲突处理
- 上下文打包
- Skill 升格判断

## 11. 存储设计

### 11.1 总体策略

第一版建议使用本地轻量存储：

- `global.sqlite`
- `workspace.sqlite`
- `session` 以内存为主，可定期 snapshot

这样既方便插件集成，又能保持后续升级空间。

### 11.2 为什么首选 SQLite

原因包括：

- 部署简单
- 适合本地插件
- 支持事务
- 易于版本迁移
- 配合 FTS5 可满足第一版检索需求
- 便于把图谱结构映射到关系表

### 11.3 逻辑表设计

建议至少有以下逻辑表：

- `nodes`
- `edges`
- `sources`
- `node_props`
- `edge_props`
- `checkpoints`
- `deltas`
- `skill_candidates`
- `fts_chunks`

### 11.4 表结构草案

#### nodes

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  strength TEXT NOT NULL,
  confidence REAL NOT NULL,
  source_id TEXT,
  version TEXT,
  freshness TEXT DEFAULT 'active',
  valid_from TEXT,
  valid_to TEXT,
  updated_at TEXT NOT NULL
);
```

#### edges

```sql
CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  strength TEXT NOT NULL,
  confidence REAL NOT NULL,
  source_id TEXT,
  version TEXT,
  valid_from TEXT,
  valid_to TEXT,
  updated_at TEXT NOT NULL
);
```

#### sources

```sql
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_path TEXT,
  source_span TEXT,
  content_hash TEXT,
  created_at TEXT NOT NULL
);
```

#### checkpoints

```sql
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  token_estimate INTEGER,
  created_at TEXT NOT NULL
);
```

#### deltas

```sql
CREATE TABLE deltas (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  checkpoint_id TEXT,
  delta_json TEXT NOT NULL,
  token_estimate INTEGER,
  created_at TEXT NOT NULL
);
```

#### skill_candidates

```sql
CREATE TABLE skill_candidates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_json TEXT NOT NULL,
  graph_pattern_json TEXT NOT NULL,
  stability_score REAL NOT NULL,
  success_score REAL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 12. 输入源设计

系统支持的输入源可分为五类：

### 12.1 会话源

- 用户消息
- 助手消息
- 工具调用摘要
- 工具输出摘要

### 12.2 规则源

- AGENTS.md
- 系统/开发者指令
- 模式说明
- 本地策略文件

### 12.3 流程源

- 项目工作流文档
- 技能说明文档
- 操作步骤模板

### 12.4 状态源

- 当前模式
- 工作目录
- 权限状态
- 可用工具
- 文件系统扫描结果

### 12.5 结果源

- 执行成功/失败记录
- 用户反馈
- 验证结果
- 测试结果

## 13. 上下文摄取与原子化流程

### 13.1 流程概览

```text
Input
-> Parse
-> Segment
-> Classify
-> Extract
-> Validate
-> Candidate Memory
-> Graph Write
```

### 13.2 Parse

负责把不同输入源解析为统一文档片段：

- 文本段
- 结构化字段
- 元数据

### 13.3 Segment

按语义边界切分，而不是纯 token 长度切分。例如：

- 一条规则是一段
- 一个流程步骤是一段
- 一个状态变化是一段
- 一次失败结论是一段

### 13.4 Classify

将片段分类为原子记忆类型：

- Fact
- Norm
- Process
- Constraint
- State
- Decision
- Outcome
- Evidence

### 13.5 Extract

抽取时必须输出结构化对象，不能自由生成无约束文本。建议抽取器只输出白名单字段。

### 13.6 Validate

校验包括：

- schema 校验
- 节点类型合法性
- 边类型合法性
- scope 合法性
- strength 合法性
- 来源完整性

### 13.7 Candidate Memory

抽取结果先进入候选区，避免直接污染正式图谱。

### 13.8 Graph Write

正式入图前执行：

- 去重
- 冲突检测
- 版本比较
- 作用域判定
- 时效判定

## 14. 准确性控制设计

### 14.1 知识分级

按可信度分为四级：

1. 硬知识
   - 系统规则
   - 模式限制
   - 明确结构化配置

2. 项目知识
   - AGENTS.md
   - 团队流程文档
   - 项目约束

3. 运行态事实
   - 当前环境
   - 当前目录
   - 当前会话状态

4. 推断知识
   - 摘要
   - 模式归纳
   - 软性建议

只有前三级可以默认参与高优先级裁决。第四级必须标注 `confidence`，且不能覆盖硬知识。

### 14.2 冲突检测

冲突类型包括：

- 同对象同类型规则冲突
- 作用域冲突
- 时间冲突
- 优先级冲突
- 建议与硬规则冲突

冲突不能静默覆盖，应显式记录：

- `conflicts_with`
- `supersedes`
- `overridden_by`

### 14.3 版本控制

每条正式知识都应具备：

- `version`
- `valid_from`
- `valid_to`
- `freshness`

### 14.4 审计能力

系统至少支持追问：

- 这条知识来自哪里
- 为什么它被认为生效
- 为什么它优先于另一条知识
- 它影响了哪次上下文编译

## 15. Checkpoint 与 Delta 机制

### 15.1 设计目的

Checkpoint 与 Delta 用于控制上下文膨胀，并降低重复总结带来的漂移。

### 15.2 Checkpoint

Checkpoint 记录某一时刻的稳定状态，建议包含：

- 当前目标
- 当前已知约束
- 已激活规则
- 当前流程节点
- 最近重要决策
- 已确认的失败教训
- 当前开放风险

### 15.3 Delta

Delta 记录从最近一次 checkpoint 之后新增的变化：

- 新状态
- 新规则激活
- 新决策
- 新风险
- 新证据
- 新结果

### 15.4 生成策略

可按以下时机生成 checkpoint：

- 每 N 轮对话
- 进入新任务阶段时
- 重大决策后
- token 使用接近阈值时

### 15.5 优势

- 避免每次重做全历史总结
- 提高会话稳定性
- 便于回滚与审计
- 便于图谱增量更新

## 16. Context Compiler 设计

### 16.1 职责

Context Compiler 的职责是把长期记忆、短期状态和当前问题编译成最小运行上下文包。

### 16.2 输入

输入包括：

- 当前用户请求
- 当前 session state
- 最近 checkpoint
- 最近 delta
- 当前生效图谱节点与边
- token budget

### 16.3 输出

输出为 `RuntimeContextBundle`，建议结构如下：

```json
{
  "goal": {},
  "intent": {},
  "active_rules": [],
  "active_constraints": [],
  "current_process": {},
  "recent_decisions": [],
  "recent_state_changes": [],
  "relevant_evidence": [],
  "candidate_skills": [],
  "open_risks": [],
  "token_budget": {
    "total": 12000,
    "used": 6800,
    "reserved": 5200
  }
}
```

### 16.4 编译流程

编译流程建议如下：

1. 解析当前意图
2. 识别当前状态
3. 激活生效规则
4. 收集当前约束
5. 定位当前流程节点
6. 查找相关技能和可复用模式
7. 召回必要证据
8. 应用 token 预算裁剪
9. 输出结构化上下文包

### 16.5 关键原则

- 优先保留当前状态，不保留完整历史。
- 优先保留硬规则和冲突信息，不保留闲聊。
- 保留证据引用，不保留冗长原文。
- 尽量输出结构化字段，而不是长摘要。

## 17. Token 控制与压缩策略

### 17.1 目标

在不损失关键语义的前提下，把运行 prompt 控制在预算内。

### 17.2 压缩等级

建议支持四级压缩：

1. `Lossless Reference`
   - 只保留结构和引用，不复制原文

2. `Structured Compression`
   - 把规则、约束、流程表示为结构化对象

3. `Semantic Compression`
   - 把多段重复信息合并成一个状态条目

4. `Aggressive Pruning`
   - 丢弃低优先级历史闲聊和过时状态

### 17.3 优先保留顺序

编译上下文时建议按以下优先级保留：

1. 当前目标
2. 硬规则
3. 当前约束
4. 当前流程位置
5. 最近关键决策
6. 支撑性证据
7. 候选技能
8. 低价值历史

### 17.4 可丢弃内容

以下内容默认可丢弃或极限压缩：

- 礼貌性对话
- 重复确认
- 已失效状态
- 长工具输出原文
- 已被吸收进图谱的冗余历史

### 17.5 触发策略

触发压缩的条件可包括：

- token 达到阈值
- 轮次达到阈值
- 进入新阶段
- 成功生成 checkpoint 后

## 18. 查询与裁决流程

### 18.1 查询目标

查询不是“找相关文本”，而是“找到当前真正生效的知识和必要证据”。

### 18.2 流程

```text
User Request
-> Intent Resolution
-> Session State Resolution
-> Active Norm Selection
-> Constraint Resolution
-> Conflict Resolution
-> Process Step Resolution
-> Skill Lookup
-> Evidence Retrieval
-> Context Compilation
```

### 18.3 先裁决后召回

核心策略是：

- 先判断当前适用哪些规则和流程
- 再找支撑证据
- 最后打包为上下文

而不是先搜一堆文本再靠模型自行归纳。

## 19. Skill Crystallizer 设计

### 19.1 定位

Skill Crystallizer 用于从图谱中识别稳定、重复且可执行的模式，并生成 Skill 候选。

### 19.2 Skill 的最小定义

一个 Skill 至少应包含：

- `name`
- `trigger`
- `applicable_when`
- `required_rules`
- `required_constraints`
- `workflow_steps`
- `expected_outcome`
- `failure_signals`
- `evidence_refs`

### 19.3 升格条件

一个图谱模式可以升格为 Skill 候选，当它满足：

1. 出现频率达到阈值
2. 触发条件较稳定
3. 规则组合较稳定
4. 流程路径较稳定
5. 结果成功率达到阈值
6. 冲突率较低
7. 适用边界可表达

### 19.4 Skill 候选评分

候选评分可综合以下因子：

- `frequency_score`
- `stability_score`
- `success_score`
- `clarity_score`
- `conflict_penalty`

### 19.5 Skill 生成结果

建议输出如下结构：

```json
{
  "id": "skill_candidate_xxx",
  "name": "Design Document Drafting",
  "trigger": {
    "intent": "design_request"
  },
  "applicable_when": [
    "workspace_known",
    "user_requests_detailed_design"
  ],
  "required_rules": [],
  "required_constraints": [],
  "workflow_steps": [],
  "expected_outcome": {},
  "failure_signals": [],
  "evidence_refs": [],
  "scores": {
    "frequency": 0.8,
    "stability": 0.9,
    "success": 0.75,
    "clarity": 0.88
  }
}
```

## 20. 模块拆分建议

第一版建议拆成以下核心模块：

### 20.1 `memory_schema`

职责：

- 定义原子记忆结构
- 定义节点和边结构
- 定义 checkpoint、delta、runtime context、skill candidate 结构

### 20.2 `ingest_pipeline`

职责：

- 统一输入格式
- 分段
- 分类
- 抽取
- 候选写入

### 20.3 `graph_store`

职责：

- 节点边存储
- 去重
- 冲突显式化
- 版本更新
- 作用域隔离

### 20.4 `checkpoint_manager`

职责：

- 生成 checkpoint
- 维护 delta
- 清理过时上下文

### 20.5 `context_compiler`

职责：

- 规则激活
- 约束裁决
- 流程选择
- 证据打包
- token 控制

### 20.6 `skill_crystallizer`

职责：

- 模式发现
- 候选打分
- Skill 候选生成

### 20.7 `audit_explainer`

职责：

- 回答“为什么这条知识生效”
- 回答“为什么这个上下文被打包进去”
- 输出可审计解释

## 21. API 草案

建议对宿主暴露以下接口：

### 21.1 摄取接口

```ts
ingest(input: RawContextInput): Promise<IngestResult>
```

### 21.2 图谱查询接口

```ts
queryGraph(request: GraphQueryRequest): Promise<GraphQueryResult>
```

### 21.3 上下文编译接口

```ts
compileContext(request: CompileContextRequest): Promise<RuntimeContextBundle>
```

### 21.4 Checkpoint 接口

```ts
createCheckpoint(request: CheckpointRequest): Promise<CheckpointResult>
```

### 21.5 Skill 候选生成接口

```ts
crystallizeSkills(request: SkillMiningRequest): Promise<SkillCandidateResult>
```

### 21.6 审计接口

```ts
explain(request: ExplainRequest): Promise<ExplainResult>
```

## 22. 示例运行流程

以下是一次典型请求的高层流程：

1. 用户发起新请求。
2. 系统读取最近 checkpoint 和 delta。
3. Intent Resolver 识别任务类型。
4. Rule Activator 激活生效规则。
5. Constraint Resolver 收集当前约束。
6. Process Resolver 判断当前流程节点。
7. Evidence Retriever 找支撑证据。
8. Context Compiler 组装最小上下文包。
9. 助手基于运行时上下文生成响应。
10. 本轮对话与结果被重新摄取。
11. 若满足条件，生成新 checkpoint。
12. 若发现稳定模式，写入 skill candidate。

## 23. 错误与风险控制

### 23.1 主要风险

- 抽取幻觉导致错误知识入图
- 规则与建议混淆
- session 状态误写入长期图谱
- 过时知识污染当前查询
- 过度压缩导致关键约束丢失
- Skill 升格过早导致错误固化

### 23.2 控制手段

- 候选区与正式图区分离
- 严格 schema 校验
- 作用域强约束
- 版本和时态控制
- 审计可解释
- Skill 升格阈值控制
- 上下文预算回退机制

## 24. 评测设计

为了验证引擎是否真的有效，建议至少准备三类评测：

### 24.1 规则激活评测

验证是否能在给定场景下正确激活当前生效规则。

### 24.2 流程编排评测

验证是否能识别当前任务所处流程节点，并给出合理下一步。

### 24.3 压缩有效性评测

验证在压缩后是否仍保留关键目标、规则、约束和流程状态。

### 24.4 Skill 发现评测

验证系统是否能从重复任务中发现稳定模式，并生成合理 Skill 候选。

### 24.5 关键指标

可追踪指标包括：

- 规则激活准确率
- 约束遗漏率
- 冲突识别率
- 上下文 token 压缩率
- 压缩后任务成功率
- Skill 候选采纳率

## 25. MVP 范围

第一版建议严格收敛到以下能力：

1. 支持会话、规则文件、技能说明三个输入源。
2. 支持原子记忆抽取。
3. 支持基础图谱写入和查询。
4. 支持 checkpoint 和 delta。
5. 支持编译最小运行上下文。
6. 支持基础 Skill 候选生成。

第一版暂不做：

- 大规模图可视化
- 复杂多用户同步
- 自动发布 Skill 市场
- 高级图算法平台化

## 26. 推荐实现顺序

建议按以下顺序推进：

### 阶段 1：Schema 与存储

- 定义所有核心结构
- 建立 SQLite 表
- 建立 source 和审计链路

### 阶段 2：摄取与原子化

- 打通输入解析
- 建立分类和抽取
- 写入 candidate 区和正式图谱

### 阶段 3：Checkpoint 与压缩

- 建立 checkpoint 生成器
- 建立 delta 管理
- 建立 token 预算模型

### 阶段 4：Context Compiler

- 实现规则激活
- 实现约束裁决
- 实现上下文编译

### 阶段 5：Skill Crystallizer

- 发现稳定模式
- 输出 skill candidate
- 建立反馈闭环

## 27. 后续演进方向

在 MVP 稳定后，可以考虑以下方向：

- 引入更强的图查询能力
- 引入向量索引作为证据召回补充层
- 提供图谱可视化
- 支持多人共享工作区图谱
- 增加 Skill 自动评估与淘汰机制
- 增加策略学习和更细粒度的上下文治理

## 28. 结论

这个 Context Engine 不应被理解为一个“更聪明的上下文检索器”，而应被理解为 OpenClaw 的语义记忆和上下文编译层。

它的核心职责有三项：

1. 把原始上下文整理成带来源、可裁决、可版本化的知识图谱。
2. 把长会话压缩成面向当前任务的最小可执行上下文。
3. 把稳定重复的上下文模式沉淀为可复用 Skill。

如果按照本文档的分层方式实现，系统会形成一个闭环：

`会话吸收 -> 图谱沉淀 -> 上下文压缩 -> 模式发现 -> Skill 结晶 -> 再反哺后续会话`

这条闭环才是 OpenClaw Context Engine 的真正产品价值。
> Implementation note
>
> The repository has moved beyond the original draft in three important ways:
>
> 1. The main integration path is now the native OpenClaw plugin path, not `stdio`.
> 2. Compaction lifecycle hooks are part of the active design:
>    `before_compaction` and `after_compaction`.
> 3. Prompt token reduction is now primarily implemented inside `assemble()`,
>    where older history is compressed, persisted into graph/checkpoint/skill
>    state, and only the recent raw tail is kept.
>
> See also:
> - [openclaw-hook-findings.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/integrations/openclaw-hook-findings.zh-CN.md)
> - [prompt-compression.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/prompt-compression.zh-CN.md)

