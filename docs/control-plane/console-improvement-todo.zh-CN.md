# 控制台改造 TODO

这份 TODO 用来管理“基于 `openclaw-control-center` 可借鉴点，继续把当前 control-plane console 做成更像控制塔的工作台”。

相关文档：
- 借鉴分析：[openclaw-control-center-ui-borrowing.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/openclaw-control-center-ui-borrowing.zh-CN.md)
- 当前 control-plane 文档入口：[README.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/README.md)
- 历史第一轮说明：[control-plane-server-first-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/archive/control-plane/control-plane-server-first-pass.zh-CN.md)
- 历史第二轮说明：[control-plane-second-pass.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/archive/control-plane/control-plane-second-pass.zh-CN.md)

## 待办

- [ ] TODO 2：补 runtime / proposal / import drilldown ~4d #UI #control-plane @Codex 2026-03-19
  - [ ] runtime window 详情页
  - [ ] proposal 审批详情页
  - [ ] import job 详情页
  - [ ] 从首页卡片跳转到对应 drilldown

- [ ] TODO 3：补 quick filter 与本地偏好 ~2d #UI @Codex 2026-03-20
  - [ ] `workspace / status / only-alerts / only-pending / only-failed-imports`
  - [ ] 语言和筛选偏好本地持久化
  - [ ] 提供轻量 reset/clear 操作

- [ ] TODO 4：强化 plain-language 文案与中文优先表达 ~2d #UX @Codex 2026-03-21
  - [ ] 告警解释改成自然语言
  - [ ] 导入失败说明改成“原因 + 下一步”
  - [ ] 自治建议、扩展状态、治理状态统一中文优先

- [ ] TODO 5：补时间线与历史工作台 ~3d #UI #observability @Codex 2026-03-23
  - [ ] observability 趋势/时间线页
  - [ ] 平台事件时间线页
  - [ ] 审计与导入历史分页视图

- [ ] TODO 6：补工作区与扩展详情工作台 ~3d #UI #platform @Codex 2026-03-24
  - [ ] workspace 详情页
  - [ ] extension 详情页
  - [ ] webhook / delivery 状态页

- [ ] TODO 7：前端结构收紧，避免继续长成大单文件 ~3d #架构 #UI @Codex 2026-03-25
  - [ ] 拆 console render helper
  - [ ] 拆页面 section/model 映射
  - [ ] 保持 `UI -> control-plane facade/API` 的边界不变

- [ ] TODO 8：文档/知识工作台第一轮 ~3d #UI #knowledge @Codex 2026-03-27
  - [ ] 治理规则文档工作台
  - [ ] 导入来源文档工作台
  - [ ] 运行手册入口工作台

## 进行中

- [ ] TODO 1：把首页进一步做成控制塔视角 ~3d #UI #control-plane @Codex 2026-03-17
  - [x] 统一中文优先首页文案
  - [x] 建立总览 / 观测 / 治理 / 导入 / 运行时 / 平台六大板块
  - [ ] 增加“当前最需要处理什么”的全局摘要卡
  - [ ] 增加全局可见性卡片，优先展示 runtime / alert / pending governance / failed import

## 已完成

- [x] 收敛 `openclaw-control-center` 的页面借鉴原则 #文档 @Codex 2026-03-15
  - [x] 明确哪些页面思路值得借
  - [x] 明确哪些实现方式不应照搬
