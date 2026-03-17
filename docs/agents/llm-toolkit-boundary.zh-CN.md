# `llm-toolkit` 职责边界与设计约束

## 规则

1. 当前项目里的大模型 transport 细节统一收敛到 `packages/llm-toolkit`：
   - `openclaw-context-cli` 只负责 prompt、结果映射和终端输出
   - 不要再把具体 provider 逻辑直接写回 app CLI
2. 设计 `llm-toolkit` 配置时，必须区分两层语义：
   - OpenClaw 的 `models.providers.*` 是宿主 provider 元数据和运行时适配配置
   - 当前项目的 `llm-toolkit` 对外配置是插件/工具包自己的公开配置
   不要直接把 OpenClaw 私有字段原样当成当前项目的通用公开配置契约。
3. 设计多模型厂商接入时，优先抽象“provider catalog / auth / transport / model catalog”四层，不要为每一家厂商单独发明一套平铺字段。
4. 涉及 OpenAI / Codex 接入字段时，必须区分“官方公开 API 字段”和“OpenClaw / `pi-ai` 风格的兼容 transport 语义”：
   - `openai-responses` 只表示 OpenAI 官方公开 Responses API 路线
   - `openai-codex-responses` 在当前项目里只表示 `codex-oauth` 这条专用 transport
   - 不要把两者混成同一种 API 契约，也不要把 `codex-oauth` 再误当成普通 API key 的 Responses provider
5. 当前项目里 `packages/llm-toolkit` 的统一对外入口是主入口 `@openclaw-compact-context/llm-toolkit` 和 `createLlmToolkitRuntime`：
   - 新代码优先从主入口拿 façade、provider registry、runtime state 和 transport
   - `@openclaw-compact-context/llm-toolkit/codex` 只作为兼容别名保留，不再作为新代码的首选入口
6. 当前项目遇到 OpenAI / Codex / OpenClaw / 多模型 provider 这类外部集成问题时，优先查官方文档、OpenClaw 源码和成熟案例，再决定配置语义与实现方向；不要先凭印象猜协议行为。

## 适用任务

- 调整 `llm-toolkit` 目录结构
- 增加 provider / session / runtime façade
- 设计 transport 抽象、catalog、runtime 配置层
