# 阶段 5 预研总结

## 本轮目标

阶段 5 这一轮不是做代码扩张，而是把长期方向收敛成可执行的进入条件：

- 多跳 relation recall
- 跨任务记忆复用
- 知识晋升合同
- Topic / Concept / Skill 融合
- 观测、人工校正和可选 LLM extractor 边界

## 本轮交付

已输出的专项方案：

- [multi-hop-recall-and-path-explain-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/multi-hop-recall-and-path-explain-plan.zh-CN.md)
- [cross-task-memory-reuse-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/cross-task-memory-reuse-plan.zh-CN.md)
- [knowledge-promotion-contract.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge-promotion-contract.zh-CN.md)
- [topic-concept-skill-fusion-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/topic-concept-skill-fusion-plan.zh-CN.md)
- [observability-human-in-the-loop-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/observability-human-in-the-loop-plan.zh-CN.md)

## 最重要的收敛

### 1. 多跳 recall 先做 explain 和预算，不先做主 bundle 放量

### 2. 高 scope 记忆必须先有 promotion、隔离和退役合同

### 3. 知识晋升必须支持降级，而不是只支持升级

### 4. Topic / Concept 不替代 Skill，三者职责继续分离

### 5. 人工和 LLM 增强不能越过 Evidence-first

## 阶段 5 正式实现的进入条件

建议至少满足：

1. 第二轮 context-processing contract 保持稳定
2. evaluation harness 的现有阈值长期稳定
3. Topic / Concept 仍保持受控 hint
4. experience learning 不反向污染主 bundle
5. 阶段 5 预研文档不再频繁改动

## 建议下一步

建议直接新起阶段 5 正式实现 TODO，先从下面两条里二选一：

- 多跳 recall / path explain 第一轮主链实现
- 高 scope 记忆复用与治理第一轮主链实现

## 一句话结论

`阶段 5 预研的价值，是把长期方向从“很多想法”收敛成“几条可按顺序落地的主线”。`
