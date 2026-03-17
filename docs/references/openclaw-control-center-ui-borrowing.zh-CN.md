# openclaw-control-center 页面借鉴清单

这份文档专门回答一个问题：`openclaw-control-center` 的平台页面哪些值得借，哪些不该照搬，以及如何映射到我们当前的 control-plane console。

相关参考：
- `openclaw-control-center`：<https://github.com/TianyiDataScience/openclaw-control-center>
- 外部参考总表：[openclaw-external-context-references.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/openclaw-external-context-references.zh-CN.md)
- 当前 control-plane 文档入口：[README.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/README.md)
- control-plane 第一轮历史说明：[control-plane-server-first-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/archive/control-plane/control-plane-server-first-pass.zh-CN.md)
- 开放平台第一轮历史说明：[open-platform-first-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/archive/control-plane/open-platform-first-pass.zh-CN.md)
- 落地 TODO：[console-improvement-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/console-improvement-todo.zh-CN.md)

## 1. 总结判断

一句话判断：
`最值得借的是信息架构、总览视角、drilldown 和 plain-language 文案；最不该照搬的是超大单文件 UI 实现和它自己的 mission-control 业务语义。`

## 2. 值得借的页面思路

### 2.1 清晰分区，而不是堆 API 面板

它的首页不是接口清单，而是面向运营的分区首页。这个思路适合映射到我们现在已有的六大板块：
- 总览
- 观测
- 治理
- 导入
- 运行时
- 平台

### 2.2 总览 + drilldown

它不是只有 dashboard，还有明确的详情入口，例如：
- 会话详情页
- 审计时间线页
- 任务详情页

这对我们最值得借的映射是：
- runtime window 详情页
- proposal 审批详情页
- import job 详情页

### 2.3 全局可见性卡片

它很强调一眼能看懂“系统现在发生了什么”。这个思路适合我们首页优先展示：
- runtime snapshot 是否新鲜
- 当前 alerts
- 待审批 proposal
- 失败导入 / 待重试导入

### 2.4 运行时证据优先

它的页面顺序偏向先看 schedule / runtime evidence，再看任务详情。  
这和我们坚持的原则一致：
- `assemble()` 是运行时真相源
- runtime snapshot 是送模前快照
- proposal / import / workspace 是治理视图，不是最终真相

### 2.5 plain-language 文案

它很强调对非技术用户友好的解释层。这个思路值得借到：
- alert 解释
- import failure 原因
- autonomy recommendation 说明
- extension 状态说明

### 2.6 quick filter 与偏好

它的轻量筛选和偏好保存很适合我们的 control-plane console，尤其是：
- `workspace`
- `status`
- `only-alerts`
- `only-pending-governance`
- `only-failed-imports`

## 3. 不建议照搬的地方

### 3.1 不照搬超大单文件 UI

它把路由、HTML、CSS、脚本、页面逻辑混在很大的单文件里。  
这对我们不合适。我们应该继续保持：
- `server.ts`
- `console.ts`
- facade / contracts / services

的分层，而不是回到“大一统 UI 文件”。

### 3.2 不照搬 mission-control 语义

像 `commander / office / staff / mission control` 这类表达可以借“气质”，不能直接搬概念。  
我们的核心语义仍然应该是：
- runtime
- governance
- observability
- import
- workspace
- extension

### 3.3 不把控制台变成直写底层库的入口

我们当前已经明确控制面边界：

`UI -> control-plane facade -> runtime/control services -> store`

所以页面不应该直接写底层库，也不应该替 runtime plane 做送模组装。

## 4. 映射到我们当前控制台

当前主要入口：
- [console.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/console.ts)
- [server.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/server.ts)

最适合立刻借的改造点：
1. 首页继续控制塔化
2. 补 runtime / proposal / import drilldown
3. 加 quick filters + 本地偏好
4. 强化 plain-language 文案
5. 后续再补 observability 时间线与工作区详情

## 5. 推荐改造顺序

1. 首页控制塔化
2. runtime / proposal / import drilldown
3. quick filters + UI 偏好
4. observability 时间线页
5. 文档/知识工作台第一轮

## 6. 一句话结论

`openclaw-control-center 最值得借的是“控制台如何让人一眼看懂系统”，而不是“把所有页面都塞进一个大 server 文件里”。`
