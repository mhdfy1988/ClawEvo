# LLM Toolkit

这个 package 负责承接当前仓库里可复用的 LLM 接入能力。

当前目标很明确：
- 把具体 transport 从 app CLI 里抽离出来
- 给后续接入其他大模型保留统一接口
- 让 `openclaw-context-cli` 只负责实验入口，不再直接管理每种 provider 细节
- 把“厂商 / API 家族 / 认证方式 / 模型目录”从单个 provider 里再往上提一层，形成通用 catalog

## 当前内置能力

当前内置了 3 种 Codex 访问方式：

1. `codex-cli`
   - 复用本机已经安装并登录好的 `codex exec`
   - 适合本地实验
2. `codex-oauth`
   - 借鉴 `OPENCLAW_CODEX` 的 PKCE / code exchange / refresh 链路
   - 默认请求 `https://chatgpt.com/backend-api`
   - 这是兼容 `OPENCLAW_CODEX` 的 transport，不是 OpenAI 官方公开开发者 API 契约
   - 适合后续做 ChatGPT OAuth 深度接入
3. `openai-responses`
   - 直接走 OpenAI Responses API
   - 官方公开端点是 `POST /v1/responses`
   - 适合后续服务端或产品化部署
4. `openai-compatible-chat`
   - 通用 OpenAI-compatible `/chat/completions` transport
   - 适合千问兼容层、豆包 / 火山方舟、Ollama、LM Studio 这类 provider 复用同一条实现
   - 当前优先作为 `catalog` provider 的通用运行时底座
5. `openai-compatible-responses`
   - 通用 OpenAI-compatible `/responses` transport
   - 适合已经提供 Responses 兼容协议的网关、代理服务或厂商封装层
   - 当前也可以通过 `catalog` provider 直接创建运行时 provider

## 公开接口

推荐主入口：
- `@openclaw-compact-context/llm-toolkit`

兼容子入口：
- `@openclaw-compact-context/llm-toolkit/codex`
  - 仅作为历史兼容别名保留
  - 新代码优先直接走主入口

当前对外接口分两层：

1. 高层 façade
   - `createLlmToolkitRuntime`
   - 适合 app CLI、控制台、宿主集成直接拿来做：
     - 配置加载
     - provider registry 创建
     - provider 顺序解析
     - 当前模型 / 默认模型解析
2. 低层构件
   - `LlmProviderRegistry`
   - `createCatalogProviderRegistry`
   - `createCodexProviderRegistry`
   - `resolveCodexProviderOrder`
   - `CodexCliTextProvider`
   - `OpenClawCodexOAuthSession`
   - `OpenClawCodexOAuthTextProvider`
   - `OpenAIResponsesTextProvider`
   - `OpenAICompatibleChatTextProvider`
   - `OpenAICompatibleResponsesTextProvider`

当前目录结构也已经按职责收口为：
- `src/providers/*`
  - 具体 provider transport
- `src/sessions/*`
  - OAuth / credential session
- `src/presets/*`
  - Codex 这类 provider 组合与默认顺序
- `src/toolkit-runtime.ts`
  - 对外统一 façade

## 默认 provider 顺序

当前项目固定采用这个顺序：

```text
codex-cli
-> codex-oauth
-> openai-responses
```

也就是说：
- `codex`
  - 表示“按上面顺序尝试任意 Codex transport”
- `auto`
  - 也是先按上面顺序尝试
  - 但失败后还会回退到代码摘要

如果你通过主入口调用 `createLlmToolkitRuntime`：
- `mode: "llm"` 会走 `catalog.providerOrder`
- `mode: "codex"` / `mode: "auto"` / `mode: "codex-*"` 会走 Codex preset 顺序
- `codex.providerOrder` 只作为 Codex 专用 override，不再和 `catalog.providerOrder` 并列成双真源

## 配置文件

`llm-toolkit` 现在支持从配置文件读取 transport 顺序和 provider 参数。

默认查找顺序：
1. 调用层显式传入 `configFilePath`
2. 环境变量 `OPENCLAW_LLM_CONFIG`
3. 当前工作目录下的 `openclaw.llm.config.json`
4. 当前工作目录下的 `.openclaw/llm.config.json`
5. 当前用户目录下的 `.openclaw/llm.config.json`

如果调用层额外传了 `fallbackDirs`：
- 会在当前工作目录之后，再去这些 fallback 目录继续找
- `openclaw-context-cli` 当前就会把插件包目录作为 fallback 目录之一
- 如果是通过 `compact-context` 插件命令调用，插件层还会进一步把默认文件名改成：
  - `compact-context.llm.config.json`
  - `compact-context.llm.state.json`
  - `compact-context.codex-oauth.json`

推荐配置结构：

```json
{
  "catalog": {
    "providerOrder": ["codex-cli", "codex-oauth", "openai-responses", "bailian", "volcengine"],
    "providers": {
      "codex-cli": {
        "enabled": true,
        "status": "implemented",
        "auth": "cli",
        "api": "codex-cli",
        "models": [{ "id": "gpt-5-codex" }]
      },
      "bailian": {
        "enabled": false,
        "status": "experimental",
        "auth": "api-key",
        "api": "openai-compatible-chat-completions",
        "models": [{ "id": "qwen3.5-plus" }]
      },
      "volcengine": {
        "enabled": false,
        "status": "experimental",
        "auth": "api-key",
        "api": "openai-compatible-chat-completions",
        "models": [{ "id": "<your-ark-endpoint-id>", "name": "doubao-seed-2-0-pro-260215" }]
      }
    }
  },
  "runtime": {
    "defaultModelRef": "codex-cli/gpt-5-codex",
    "stateFilePath": "./.openclaw/llm.state.json",
    "providers": {
      "codex-cli": {
        "enabled": true,
        "command": "codex",
        "model": "gpt-5-codex",
        "reasoningEffort": "low"
      },
      "codex-oauth": {
        "enabled": true,
        "baseUrl": "https://chatgpt.com/backend-api",
        "credentialFilePath": "./.openclaw/openclaw-codex-oauth.json",
        "model": "gpt-5.4",
        "reasoningEffort": "low",
        "systemPrompt": "You are a helpful assistant. Reply clearly and concisely."
      },
      "openai-responses": {
        "enabled": false,
        "apiKeyEnv": "OPENAI_API_KEY",
        "baseUrl": "https://api.openai.com/v1",
        "model": "gpt-5-codex",
        "reasoningEffort": "low"
      },
      "bailian": {
        "enabled": false,
        "apiKeyEnv": "DASHSCOPE_API_KEY",
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen3.5-plus",
        "reasoningEffort": "low"
      },
      "volcengine": {
        "enabled": false,
        "apiKeyEnv": "ARK_API_KEY",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
        "model": "<your-ark-endpoint-id>",
        "reasoningEffort": "low"
      }
    }
  }
}
```

规则说明：
- 推荐分层是：
  - `catalog` 只描述 provider / auth / api / models 这类长期稳定元数据
  - `runtime.providers` 才承载 `baseUrl`、`apiKey`、`credentialFilePath`、`model`、`reasoningEffort` 这类运行时敏感参数
- `runtime.defaultModelRef` 是长期默认模型，格式固定为 `<provider>/<model>`
- `runtime.stateFilePath` 指向当前模型状态文件，默认保存 `currentModelRef`
- 当前模型解析优先级固定为：
  1. 调用层显式指定 `modelRef`
  2. 状态文件里的 `currentModelRef`
  3. 配置文件里的 `runtime.defaultModelRef`
  4. provider 自身默认模型
- 默认模板里不要同时重复写两份顺序源：
  - 顶层 `catalog.providerOrder` 负责通用 provider 顺序
  - `codex.providerOrder` 只在你需要覆盖 Codex 专用顺序时才额外提供
- 显式 `configFilePath` 或 `OPENCLAW_LLM_CONFIG` 一旦指定了不存在的文件，就应该直接报错，而不是静默回退到默认查找
- `models use` 应只写状态文件，不直接改主配置
- `models default` 应回写 `runtime.defaultModelRef`
- `providerOrder` 会覆盖默认顺序
- `enabled: false` 会直接禁用对应 transport
- 相对路径会按配置文件所在目录解析
- 如果没有配置文件，仍然回退到内置默认顺序
- `codex-cli` 和 `codex-oauth` 都支持 `model`
- `codex-oauth` 支持额外配置 `systemPrompt`；如果不显式提供，toolkit 会补一个通用 instruction，避免 Codex OAuth 返回 `Instructions are required`
- `openai-responses` 可以在配置文件里写 `apiKey`，也可以继续走 `OPENAI_API_KEY`
- `codex-cli` 不存在 `baseUrl` 或 `api`，因为它调用的是本机 `codex` 进程，不是 HTTP 接口
- `codex-oauth` 的 `baseUrl` 是兼容 `OPENCLAW_CODEX` 的 transport 参数，不是 OpenAI 官方公开 API 文档里的标准配置字段
- `codex-oauth` 的目录元数据应对齐 OpenClaw，写成 `api: "openai-codex-responses"`，不要再伪装成普通 `openai-responses`
- `openai-responses` 才是 OpenAI 官方公开 API 路线；这里的 `baseUrl` 默认是 `https://api.openai.com/v1`
- `catalog.providers.*.api` 是 `llm-toolkit` 的 provider 元数据字段，不是请求 payload 参数；其中：
  - `openai-responses` 只用于 OpenAI 官方公开 Responses API
  - `openai-codex-responses` 只用于 Codex OAuth 这条独立 transport
  - `openai-chat-completions` 保留给 OpenAI 官方 Chat Completions 语义
  - `openai-compatible-chat-completions` 用于千问、火山方舟、豆包、Ollama、LM Studio 这类第三方 OpenAI-compatible `/chat/completions`
  - 当前代码里 `openai-chat-completions` 和 `openai-compatible-chat-completions` 会共用同一个 chat provider 实现，但配置语义仍然要区分“官方 OpenAI”与“第三方兼容接口”

## 通用 provider catalog

为了后面接更多厂商，`llm-toolkit` 现在额外支持一层通用 `catalog` 配置。

这层先解决的是统一配置语义，不是一步把所有 runtime provider 都做完。它负责描述：
- 厂商是谁
- 认证方式是什么
- API 家族是什么
- 当前有哪些模型
- 当前状态是 `implemented / experimental / planned`

当前支持的 catalog 字段包括：
- `providerOrder`
- `providers.<id>.enabled`
- `providers.<id>.status`
- `providers.<id>.label`
- `providers.<id>.vendor`
- `providers.<id>.auth`
- `providers.<id>.api`
- `providers.<id>.notes`
- `providers.<id>.models[]`

模型条目支持：
- `id`
- `name`
- `api`
- `reasoning`
- `input`
- `contextWindow`
- `maxTokens`
- `notes`

真正会影响运行时请求的字段统一放在 `runtime.providers`：
- `baseUrl`
- `apiKey` / `apiKeyEnv`
- `credentialFilePath`
- `command`
- `model`
- `reasoningEffort`
- `headers`

当前示例配置里已经先登记了这些家族：
- `codex-cli`
- `codex-oauth`
- `openai-responses`
- `custom-responses`
- `bailian`
- `volcengine`
- `ollama-local`
- `lm-studio-local`
- `copilot-oauth`

要注意：
- `catalog` 是通用元数据层，但它现在已经不只是占位
- 当前 `openclaw-context-cli --mode llm` 已经会直接读取 `catalog` 并创建运行时 provider
- 这层的价值是后面扩厂商时不用再每家重新定义字段
- `bailian`、`volcengine`、`ollama-local`、`lm-studio-local` 现在已经能通过通用 `openai-compatible-chat` transport 创建运行时 provider
- `custom-responses` 这类 provider 现在已经能通过通用 `openai-compatible-responses` transport 创建运行时 provider
- `provider.api` 只表示 provider 默认 API 家族
- `model.api` 只在某个模型要覆盖 provider 默认 API 家族时才出现；普通示例不要重复写两遍

## 使用建议

如果你在当前仓库里新增一种大模型 transport，建议遵循下面的分层：

- `packages/llm-toolkit`
  - 放 provider / session / registry / transport 细节
- `apps/openclaw-plugin/src/cli`
  - 只放 prompt 组织、结果映射、CLI 展示

不要再把 transport 细节直接写回 `openclaw-context-cli`。

如果某家模型本身就是 OpenAI-compatible `/chat/completions`：
- 先接进 `catalog`
- 再复用通用 `openai-compatible-chat` transport
- 不要一上来就为每一家单独写新的 provider

## 当前模型状态

当前工具包把“默认模型”和“当前模型”拆成两层：

- 默认模型
  - 进配置文件
  - 对应 `runtime.defaultModelRef`
- 当前模型
  - 进状态文件
  - 对应状态文件里的 `currentModelRef`；工具包默认值是 `.openclaw/llm.state.json`，插件层可以覆盖成自己的文件名

这样做的目的很直接：
- 改默认模型时，保留长期配置
- 临时切换模型时，不污染主配置
- CLI / 控制台 / 后续宿主集成都能共用同一套 `<provider>/<model>` 引用格式

## Codex CLI 环境变量

- `OPENCLAW_CODEX_BIN`
- `OPENCLAW_CODEX_MODEL`
- `OPENCLAW_CODEX_REASONING_EFFORT`

## Codex OAuth 环境变量

- `OPENCLAW_CODEX_OAUTH_ACCESS_TOKEN`
- `OPENCLAW_CODEX_OAUTH_REFRESH_TOKEN`
- `OPENCLAW_CODEX_OAUTH_EXPIRES_AT`
- `OPENCLAW_CODEX_OAUTH_ACCOUNT_ID`
- `OPENCLAW_CODEX_OAUTH_CREDENTIAL_FILE`
- `OPENCLAW_CODEX_OAUTH_BASE_URL`
- `OPENCLAW_CODEX_OAUTH_MODEL`
- `OPENCLAW_CODEX_OAUTH_REASONING_EFFORT`

## OpenAI Responses 环境变量

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENCLAW_OPENAI_RESPONSES_MODEL`
- `OPENCLAW_OPENAI_RESPONSES_REASONING_EFFORT`

## 当前约束

- 中文 prompt 传给 `codex exec` 时，优先走 UTF-8 `stdin`
- `codex` 不能成为唯一入口，调用层必须保留代码 fallback
- `codex-oauth` 当前实现是可复用 transport，但是否长期作为正式主链，还要继续观察

## Registry 行为

`LlmProviderRegistry` 现在默认带两层保护，避免多 provider 链路里反复撞同一个失败点：

- availability cache
  - 默认缓存 `1s`
  - 同一 provider 在短时间内不会重复做 availability 探测
- cooldown
  - provider 在 `generate` 阶段失败后，默认进入 `5s` 冷却
  - 冷却期间会直接跳过该 provider，继续尝试后面的 provider

如需覆盖，可以显式传：

```ts
new LlmProviderRegistry({
  availabilityCacheTtlMs: 2_000,
  cooldownMs: 10_000
});
```
