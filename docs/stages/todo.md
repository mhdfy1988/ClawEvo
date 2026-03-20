# TODO

## P0 当前优先

### 1. 收口 `compact-context-core` 重命名重构
- [x] 复查 `packages/compact-context-core` 重命名是否完整
- [x] 确认仓库内不再残留 `control-plane-core` 代码引用
- [x] 清理 `.tmp/` 等临时产物
- [x] 跑一轮核心回归：
  - [x] `npm.cmd run test:package:compact-context-core`
  - [x] `npm.cmd run test:app:openclaw-plugin`
  - [x] `npm.cmd run test:app:control-plane`
  - [x] `npm.cmd run test:smoke:required`
  - [x] `npm.cmd run check`
- [x] 提交并推送这轮重构

### 2. 固定安装验证链路
- [x] 重新打插件发布包
- [x] 验证全局 npm 安装后的 CLI：
  - [x] `openclaw-context-cli summarize`
  - [x] `openclaw-context-cli summarize --model codex-oauth/gpt-5.4`
- [x] 验证 OpenClaw 宿主安装后的子命令：
  - [x] `openclaw compact-context summarize`
  - [x] `openclaw compact-context summarize --model codex-oauth/gpt-5.4`
- [x] 把“安装、卸载、验证”命令收成稳定流程

## P1 紧随其后

### 3. 收配置与安装文档
- [x] 明确默认正式配置、状态、OAuth 凭据都锁定在插件目录
- [x] 把“全局 CLI”和“OpenClaw 子命令”分开写
- [x] 把安装命令、卸载命令、验证命令收成一页 runbook

### 4. 继续收薄插件边界
- [x] 检查 `apps/openclaw-plugin` 是否还直接依赖过多内部 service
- [x] 继续保持“宿主适配壳”和“业务核心”分离
- [x] 避免继续把插件往“平台控制面”方向扩

## P2 体验优化

### 5. 继续收 LLM-first 摘要体验
- [x] 评估是否把 `mode` 收成更少的高层选项
- [x] 继续弱化 `code` 为 fallback 心智
- [x] 评估把 provider / transport 从 `mode` 中拆出

### 6. 清理示例与文档噪音
- [x] 继续删除重复 provider 示例
- [x] 复查 README / docs / AGENTS 是否还有过时口径
- [x] 把调试期临时结论和长期规则继续拆开

## 备注

- 当前阶段先做“收口和稳态验证”，不要优先横向加新功能。
- 与外部集成、安装、认证相关的问题，继续遵循“查询优先，试错其次”。
