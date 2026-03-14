# 攻坚总路线图
这份路线图用于把当前项目后续的两条攻坚主线收敛到同一张执行图里：

- `主线 A`：上下文处理攻坚
- `主线 B`：其他专项攻坚

它不替代原有专项 TODO，而是负责回答三件事：
1. 先做什么
2. 哪些可以并行
3. 哪些必须等前置能力稳定后再做

相关文档：
- 上下文处理专项：[context-processing-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-hardening-todo.zh-CN.md)
- 其他专项攻坚：[other-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/other-hardening-todo.zh-CN.md)
- 项目阶段路线图：[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-roadmap.zh-CN.md)

## 当前判断
当前最合理的节奏不是多线平均推进，而是：

`先把上下文处理做成独立子系统，再把长期记忆、多跳 recall、高 scope 复用、多来源入图和人工治理做深。`

原因很直接：
- 上下文处理决定“原始输入如何变成语义原子”
- 其他专项大多建立在这层原子质量之上
- 如果上下文处理底座不稳，后面的记忆、召回、知识晋升都会放大噪音

## 执行原则
### 1. 先做底座，不优先做扩张
优先顺序应当是：

`上下文处理底座 -> 记忆治理 -> 多跳召回 -> 多来源入图 -> 人工治理与观测`

### 2. 先解耦，再增强
每条攻坚线尽量都形成：
- 独立模块
- 独立测试
- 独立评估
- 独立 explain / diagnostics

### 3. 先把可评估做出来，再继续扩复杂度
任何新专项都尽量满足：
- 有 fixture
- 有 harness
- 有 explain
- 有最小报告

## 优先级总表
### P0：已经完成并稳定收口
- `ContextProcessingPipeline`
- 噪音治理与无意义语句策略
- `Summary Planner`
- `Semantic Classifier / Node Materializer`
- `Context Processing Harness`

### P1：当前最值得继续推进
- 长期记忆与知识晋升治理第二轮
- 多跳 recall 与路径裁决深化

### P2：在记忆治理和多跳 recall 稳住后推进
- 高 scope 记忆治理与跨任务复用
- 多来源知识图谱输入
- 人工校正产品化
- 观测与专项评估矩阵第二轮

### P3：最后做收口与阶段承接
- 其他专项攻坚验收与收口
- 下一阶段承接项整理

## 推荐执行顺序
### 第一段：上下文处理底座收口
对应 [context-processing-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing-hardening-todo.zh-CN.md)

1. `ContextProcessingPipeline`
2. 噪音治理
3. `Summary Planner`
4. `Semantic Classifier / Node Materializer`
5. `Context Processing Harness`
6. `Attempt / Episode` raw-first builder
7. 版本化与缓存
8. 人工校正接入
9. 专项评估与报告
10. 上下文处理收口

当前状态：
- 这一段已完成

### 第二段：长期记忆与召回治理深化
对应 [other-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/other-hardening-todo.zh-CN.md)

11. 长期记忆与知识晋升治理第二轮
12. 多跳 recall 与路径裁决深化
13. 高 scope 记忆治理与跨任务复用

当前状态：
- `11` 已完成
- `12` 进行中
- `13` 待办

### 第三段：多来源入图与人工治理
对应 [other-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/other-hardening-todo.zh-CN.md)

14. 多来源知识图谱输入
15. 人工校正产品化
16. 观测与专项评估矩阵第二轮

### 第四段：统一收口
17. 其他专项攻坚验收与收口
18. 下一阶段承接项整理

## 可以并行的部分
- `多跳 recall 深化` 和 `长期记忆治理第二轮`
  原因：两者都依赖稳定上下文底座，但实现边界不同
- `人工校正产品化` 和 `观测矩阵`
  原因：两者都服务治理和排查

## 不建议并行的部分
- 不建议在 `多跳 recall` 还没收紧前，先大规模扩张多来源入图
- 不建议在 `高 scope 复用` 还没治理好前，先放大全局记忆写入

## 当前建议的下一步
如果只选一个马上开始，建议顺序是：

1. `多跳 recall 与路径裁决深化`
2. `高 scope 记忆治理与跨任务复用`
3. `多来源知识图谱输入`

## 一句话总结
`后续攻坚不该平均铺开，而应该先利用已经稳定的上下文处理底座，继续把长期记忆与多跳召回做实，再逐步扩到高 scope 复用、多来源入图和人工治理。`
