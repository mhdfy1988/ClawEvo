# 项目规则入口

这个文件现在只保留高频硬规则和入口索引。  
长规则、分类规则、踩坑沉淀已经拆到：

- [docs/agents/index.md](/d:/C_Project/openclaw_compact_context/docs/agents/index.md)

使用方式：

1. 先看本文件里的高频硬约束。
2. 碰到具体任务，再去 [docs/agents/index.md](/d:/C_Project/openclaw_compact_context/docs/agents/index.md) 找对应分类。
3. 不要再把长篇规则继续直接堆回本文件。

## 高频硬约束

1. 当前项目接入 Codex 时，第一优先路线仍是 `Codex CLI`；不要跳过现有成熟路径直接重写 OAuth provider 或先接 OpenAI API。
2. 入口职责固定：
   - `openclaw-context-plugin` 只负责宿主 `stdio JSONL`
   - `openclaw-context-cli` 只负责人工调试入口
   - 安装到 OpenClaw 宿主后，如果宿主支持 CLI 注册，则优先维护 `openclaw compact-context ...`
3. `codex` 不能成为唯一入口；任何 Codex 能力都必须保留 `code` fallback。
4. 接 OpenClaw 宿主插件接口时，`register(api)` 必须保持同步；不要把 CLI / command 注册面放进 `async register(...)`。
5. `llm-toolkit` 是当前项目唯一的 transport 细节归口；新代码优先走主入口 `@openclaw-compact-context/llm-toolkit` 和 `createLlmToolkitRuntime`。
6. `codex-oauth` 必须保持独立 transport 语义，不要再把它写成普通 `openai-responses`。
7. `openclaw.llm.config.json` 的默认顺序真源是 `catalog.providerOrder`；`codex.providerOrder` 只作为 Codex 专用 override。
8. 模型引用格式固定为 `<provider>/<model>`；优先级固定为：
   - `--model`
   - 当前模型状态
   - 配置默认模型
   - provider 自身默认模型
9. app release 包必须是 standalone，重装同版本 OpenClaw 插件时必须先卸载旧包，再安装新包，再重启 gateway。
10. 当前项目插件包名必须和 `openclaw.plugin.json` 的 `id: compact-context` 对齐，避免 `plugin id mismatch`。
11. 用户说“提交代码”，默认等于：
   - 本地 commit
   - 推送远端 GitHub
12. 当前项目里的命令示例和验证命令默认不要使用 `&&` / `||`。
13. 每轮阶段完成后都要做总结；对当前仓库长期有效的结论，必须继续落到：
   - `AGENTS.md`
   - 文档
   - 测试 / smoke
   之一。

## 分类索引

1. 产品边界与入口  
   [product-boundary-and-entry.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/agents/product-boundary-and-entry.zh-CN.md)

2. CLI、Codex 与 OAuth 调试约束  
   [cli-codex-and-oauth.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/agents/cli-codex-and-oauth.zh-CN.md)

3. Release、安装与宿主验证  
   [release-install-and-host-validation.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/agents/release-install-and-host-validation.zh-CN.md)

4. `llm-toolkit` 职责边界与设计约束  
   [llm-toolkit-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/agents/llm-toolkit-boundary.zh-CN.md)

5. 配置查找、provider 顺序与模型状态  
   [config-provider-order-and-model-state.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/agents/config-provider-order-and-model-state.zh-CN.md)

6. 通用 provider 复用与外部集成规则  
   [provider-reuse-and-external-integration.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/agents/provider-reuse-and-external-integration.zh-CN.md)

7. 文档、协作与总结沉淀  
   [documentation-collaboration-and-summary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/agents/documentation-collaboration-and-summary.zh-CN.md)
