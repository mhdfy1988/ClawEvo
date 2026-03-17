# 项目规则索引

这个目录用于承接当前项目里原本堆在 [AGENTS.md](/d:/C_Project/openclaw_compact_context/AGENTS.md) 里的长规则。

使用原则：

1. [AGENTS.md](/d:/C_Project/openclaw_compact_context/AGENTS.md) 只保留高频硬约束和索引入口。
2. 细节规则、踩坑记录、约束背景、分类说明统一放到本目录。
3. 碰到对应任务时，先从这里找相关分类，再继续实现。

## 分类入口

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

## 按任务找规则

- 做 OpenClaw 插件入口、CLI 子命令、`register(api)`：看 `产品边界与入口`
- 做 `codex-cli` / `codex-oauth` / `auth login` / Windows 本地调试：看 `CLI、Codex 与 OAuth 调试约束`
- 做打包、安装、重装、OpenClaw 宿主验证：看 `Release、安装与宿主验证`
- 做 `llm-toolkit` 结构、provider、runtime façade：看 `llm-toolkit` 职责边界与设计约束
- 做 `compact-context.llm.config.json`、模型切换、providerOrder：看 `配置查找、provider 顺序与模型状态`
- 做千问、豆包、Ollama、LM Studio、Responses 兼容层：看 `通用 provider 复用与外部集成规则`
- 改文档、改 CLI help、做阶段总结、准备提交：看 `文档、协作与总结沉淀`
