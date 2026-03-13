# 阶段 3 第二轮总结

## 1. 目标

这份文档用于总结阶段 3 第二轮的实际交付结果。

它关注的不是第一轮已经完成的 `Schema / Conflict / Trace` 主链，而是第二轮围绕下面三条增强线做出的收口：

- `persistence trace` 深化
- `relation-aware recall` 第一轮
- `memory lineage` 与沉淀追踪

---

## 2. 这轮到底完成了什么

阶段 3 第二轮完成的不是“再加一层图谱”，而是把治理主线后的增强能力真正接进主链。

这轮核心完成了三件事：

1. `persistence trace` 深化
   - explain 能明确看到节点是否进入 `checkpoint / delta / skill candidate`
   - 能解释“为什么被历史保留，但这轮没进当前 bundle”
2. `relation-aware recall` 第一轮
   - compiler 开始正式消费一跳 `supported_by`
   - diagnostics / explain 能说明 relation 对入选的贡献
3. `memory lineage` 闭环
   - `bundle -> checkpoint / delta / skill candidate` 可追
   - `skill candidate` 能回指 `sourceBundleId / sourceCheckpointId / sourceNodeIds`

一句话概括：

`阶段 3 第二轮完成的是“关系与记忆增强的一跳闭环”，而不是长期记忆平台本身。`

---

## 3. 主要交付

### 3.1 Persistence Trace 深化

交付点：

- explain 返回 `checkpoint / delta / skill candidate` 的 persistence trace
- retention reason 能解释“已保留到历史，但未进入当前 runtime bundle”
- `query_nodes + explain` 与 `inspect_bundle` 透出同一份 persistence 视图

直接效果：

- 调试时不再只能看到“这条节点当前有没有进 prompt”
- 还能看到它是否已经进入历史沉淀层，以及为什么会留在那里

### 3.2 Relation-aware Recall 第一轮

交付点：

- compiler 第一轮正式消费 `supported_by`
- `relevantEvidence` 会被当前 `Rule / Constraint / Risk / Process / Decision / State` 的一跳支持边增强召回
- `ContextSelection.reason` 和 diagnostics 保留 relation 贡献

直接效果：

- bundle 不再只靠纯文本匹配挑 evidence
- evidence 开始真正受图关系影响

### 3.3 Memory Lineage 闭环

交付点：

- `checkpoint / delta / skill candidate` 显式带 `sourceBundleId`
- `skill candidate` 显式带 `sourceCheckpointId / sourceNodeIds`
- trace 会暴露：
  - `checkpointSourceBundleId`
  - `deltaSourceBundleId`
  - `skillCandidateSourceBundleId`
- SQLite 已能 round-trip 这些 lineage 字段

直接效果：

- 记忆沉淀不再只是“有对象”，而是开始具备来源链
- skill candidate 不再只是单次 bundle 的黑盒镜像

---

## 4. 验证结果

这轮已经完成的验证包括：

- `.\node_modules\.bin\tsc.cmd --noEmit`
- `.\node_modules\.bin\tsc.cmd -p tsconfig.json`
- 全量 `node --test --test-isolation=none ...`

当前结果：

- `47` 个测试通过
- 新增覆盖：
  - memory lineage smoke
  - SQLite lineage round-trip
  - gateway persistence lineage explain
  - skill candidate source bundle / checkpoint / node lineage

---

## 5. 第二轮出口条件

建议把阶段 3 第二轮出口收敛成下面三组。

### 5.1 Persistence 出口

- explain 能稳定返回 `checkpoint / delta / skill candidate` 的 persistence trace
- retention reason 能解释“为什么没进当前 bundle，但被历史保留”
- gateway 调试入口不再绕开 persistence explain 主链

当前判断：

`已满足`

### 5.2 Relation 出口

- compiler 至少有一类稳定关系边进入 recall 主链
- diagnostics / explain 能解释 relation contribution
- relation-aware 回归进入主测试链

当前判断：

`已满足`

### 5.3 Memory Lineage 出口

- `bundle -> checkpoint / delta / skill candidate` 的来源链可追
- `skill candidate` 能回指 bundle / checkpoint / source node
- SQLite / InMemory 都能稳定 round-trip 这些字段

当前判断：

`已满足`

---

## 6. 这轮最重要的收益

第二轮最重要的收益，不是“又多了几个字段”，而是系统开始具备了更完整的关系和记忆可追查性：

- 更能解释历史保留
- 更能说明关系为什么影响召回
- 更能把记忆沉淀和当前 bundle 选择连起来

也就是说，系统已经从：

`能治理、能裁决、能追查`

推进到了：

`能解释关系、能追踪沉淀、能把记忆链和运行时链连起来`

---

## 7. 仍然不应高估的地方

虽然第二轮已经完成，但现在还不能把系统描述成“长期记忆平台”。

当前仍要明确这些边界：

- relation-aware recall 还停留在一跳 `supported_by`
- 长期记忆评分、聚合、淘汰策略还没进入主链
- 主题层、长期记忆层还没有正式进入 compiler / recall 主路径
- skill candidate 还不是跨多轮稳定能力，只是已具备来源链

所以更准确的定义仍然是：

`它已经具备关系增强与记忆来源链，但还没有进入长期记忆平台阶段。`

---

## 8. 阶段 4 前的建议

第二轮完成之后，更建议先进入阶段 4 前置准备，而不是马上扩很多新层。

建议顺序：

1. 先整理阶段 4 前置事项
2. 明确 recall 扩边策略和优先级
3. 明确长期记忆评分 / 聚合 / 淘汰最小方案
4. 再决定主题层和长期记忆层的主链接入方式

对应清单见：
[stage-4-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stage-4-prework.zh-CN.md)

---

## 9. 一句话结论

`阶段 3 第二轮的价值，是把“关系增强”和“记忆沉淀追踪”真正接进主链，让系统从治理与裁决，继续推进到可追溯的关系与记忆增强。`
