# Codex 接入方式说明

## 1. 目标

这份文档回答的是同一个问题：

`当前项目如果要接入 Codex，总共有哪几种方式、各自怎么实现、适合什么场景、第一步应该先做哪条。`

这里讨论的是“如何访问 Codex”和“如何把 Codex 接进当前项目”，不是讨论“上下文压缩值不值得做”。

## 2. 当前结论

当前项目已经把 Codex 接入收成了一个独立工具包：

- [packages/llm-toolkit](/d:/C_Project/openclaw_compact_context/packages/llm-toolkit)

当前推荐顺序仍然是：

1. `Codex CLI`
2. `OpenClaw 风格的 Codex OAuth`
3. `OpenAI Responses API + GPT-5-Codex`

原因很简单：
- 你当前机器已经可以用 `codex auth`
- 本机已经有可用的 `codex` CLI
- 第一阶段目标是验证“Codex 摘要值不值得引入”

## 3. 当前仓库的落点

和这件事直接相关的入口如下：

- 人工 CLI：
  - [apps/openclaw-plugin/src/bin/openclaw-context-cli.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/bin/openclaw-context-cli.ts)
- 摘要映射层：
  - [apps/openclaw-plugin/src/cli/context-summary.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/cli/context-summary.ts)
- roundtrip：
  - [apps/openclaw-plugin/src/cli/context-roundtrip.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/cli/context-roundtrip.ts)
- explain：
  - [apps/openclaw-plugin/src/cli/context-explain.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/cli/context-explain.ts)
- transport 工具包：
  - [packages/llm-toolkit/src](/d:/C_Project/openclaw_compact_context/packages/llm-toolkit/src)

当前职责已经固定：
- `openclaw-context-plugin`
  - 只负责宿主 `stdio JSONL`
- `openclaw-context-cli`
  - 只负责人工实验入口
- `llm-toolkit`
  - 统一承接具体 transport
  - 其中 `codex-*` 负责 Codex 专用链路，`catalog + llm` 负责承接通用多厂商 provider

当前还新增了一层配置入口：
- `compact-context.llm.config.json`
  - 用来覆盖默认 transport 顺序
  - 用来启用 / 禁用具体 provider
  - 用来写 provider 级参数
  - 也可以顺手承载未来多厂商模型的统一 catalog 元数据

## 4. 三种 Codex 方式

### 4.1 Codex CLI

特点：
- 直接调用本机 `codex exec`
- 不自己实现 OAuth
- 最适合当前本地实验

实现要点：
- 中文 prompt 走 UTF-8 `stdin`
- 默认推理强度固定 `low`
- 通过 `codex exec -o <file> -` 读取输出

当前 mode：
- `--mode codex-cli`

### 4.2 Codex OAuth

特点：
- 借鉴 `OPENCLAW_CODEX` 的实现
- 核心链路是：
  - PKCE
  - 本地回调
  - authorization code exchange
  - refresh token
- 请求目标默认是：
  - `https://chatgpt.com/backend-api`
- 这个 `baseUrl` 来自 `OPENCLAW_CODEX` 的 provider 实现，不是 OpenAI 官方公开开发者 API 文档里的标准公共字段

实现位置：
- [openclaw-codex-oauth-session.ts](/d:/C_Project/openclaw_compact_context/packages/llm-toolkit/src/sessions/openclaw-codex-oauth-session.ts)
- [openclaw-codex-oauth-provider.ts](/d:/C_Project/openclaw_compact_context/packages/llm-toolkit/src/providers/openclaw-codex-oauth-provider.ts)

当前 mode：
- `--mode codex-oauth`

注意：
- 这条线是可复用 transport
- 但是否长期作为正式主链，还要继续验证

### 4.3 OpenAI Responses API

特点：
- 不依赖本机 `codex`
- 直接走 OpenAI API
- 更适合后续服务端或产品化

实现位置：
- [openai-responses-provider.ts](/d:/C_Project/openclaw_compact_context/packages/llm-toolkit/src/providers/openai-responses-provider.ts)

当前 mode：
- `--mode openai-responses`

官方口径：
- `GPT-5-Codex` 当前通过 `Responses API` 使用
- 官方公开端点是 `POST /v1/responses`
- 官方模型文档：
  - https://developers.openai.com/api/docs/models/gpt-5-codex

## 5. 默认选择顺序

当前项目默认顺序：

```text
codex-cli
-> codex-oauth
-> openai-responses
```

对应语义：
- `--mode codex`
  - 按上面顺序尝试任何 Codex transport
- `--mode auto`
  - 也是按上面顺序尝试
  - 但全部失败时回退到 `code`
- 省略 `--mode`
  - 当前默认按 `llm` 处理
  - 优先走通用 provider / 当前模型 / 默认模型

注意：
- 这是默认 fallback 顺序
- 如果存在 `compact-context.llm.config.json` 或显式 `--config`，则优先按配置文件里的 `providerOrder`
- 默认模板里只建议保留一份顺序源：
  - 顶层 `catalog.providerOrder` 负责通用 provider 顺序
  - `codex.providerOrder` 只在你需要覆盖 Codex 专用顺序时才额外写

## 6. 当前 CLI 已支持的 mode

### summarize

```powershell
openclaw-context-cli summarize --mode code --text "今天先把首页做成控制塔视角，并保留任务总览。"
openclaw-context-cli summarize --mode codex --text "今天先把首页做成控制塔视角，并保留任务总览。"
openclaw-context-cli summarize --mode codex-cli --text "请只走本机 Codex CLI"
openclaw-context-cli summarize --mode codex-oauth --text "请只走 ChatGPT OAuth"
openclaw-context-cli summarize --mode openai-responses --text "请只走 OpenAI Responses API"
openclaw-context-cli summarize --mode llm --model qwen-compatible/<your-qwen-model-id> --text "请用千问兼容层压缩这段文本"
openclaw-context-cli summarize --mode llm --model custom-responses/<your-responses-model-id> --text "请用通用 Responses 兼容层压缩这段文本"
openclaw-context-cli summarize --mode codex --model codex-cli/gpt-5-codex --text "请显式覆盖当前模型"
openclaw-context-cli summarize --config .\compact-context.llm.config.json --mode codex --text "请按配置顺序尝试 Codex"
openclaw-context-cli summarize --text "今天先把首页做成控制塔视角，并保留任务总览。"
openclaw-context-cli summarize --text "今天先把首页做成控制塔视角，并保留任务总览。" --json
```

### roundtrip

```powershell
openclaw-context-cli roundtrip --mode code --text "今天先把首页做成控制塔视角，并保留任务总览。"
openclaw-context-cli roundtrip --mode codex --text "今天先把首页做成控制塔视角，并保留任务总览。" --instruction "请压缩输入文本，只保留任务目标和当前动作。"
openclaw-context-cli roundtrip --mode codex --model codex-oauth/gpt-5.4 --text "今天先把首页做成控制塔视角，并保留任务总览。"
openclaw-context-cli roundtrip --mode llm --model qwen-compatible/<your-qwen-model-id> --text "今天先把首页做成控制塔视角，并保留任务总览。"
openclaw-context-cli roundtrip --text "今天先把首页做成控制塔视角，并保留任务总览。" --json
```

### explain

```powershell
openclaw-context-cli explain --mode code --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
openclaw-context-cli explain --mode auto --model codex-cli/gpt-5-codex --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
openclaw-context-cli explain --mode llm --model qwen-compatible/<your-qwen-model-id> --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
openclaw-context-cli explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2 --json
```

### models

```powershell
openclaw-context-cli models list
openclaw-context-cli models current
openclaw-context-cli models use codex-cli/gpt-5-codex
openclaw-context-cli models default codex-oauth/gpt-5.4
openclaw-context-cli models clear
openclaw-context-cli models reset
openclaw-context-cli models list --json
```

### auth

```powershell
openclaw-context-cli auth status
openclaw-context-cli auth login --timeout-ms 180000
openclaw-context-cli auth logout
openclaw-context-cli auth status --json
```

## 7. summarize / roundtrip / explain 的语义

- `summarize`
  - 只比较摘要结果
- `roundtrip`
  - 走 `ingest -> compile`
  - `summary` 只做并排预览，不反写引擎
- `explain`
  - 先 compile 当前 bundle
  - 再对选中的节点执行 `engine.explain`

默认终端输出：
- 紧凑、适合人工观察

完整结构：
- 统一走 `--json`

## 8. 配置文件

### 8.1 默认查找顺序

`compact-context` 插件命令当前按下面顺序查找配置：

1. `--config <path>`
2. 环境变量 `OPENCLAW_LLM_CONFIG`
3. 插件目录：`<pluginDir>/compact-context.llm.config.json`

### 8.2 配置结构

```json
{
  "catalog": {
    "providerOrder": ["codex-cli", "codex-oauth", "openai-responses", "qwen-compatible"],
    "providers": {
      "codex-cli": {
        "enabled": true,
        "status": "implemented",
        "auth": "cli",
        "api": "codex-cli",
        "models": [{ "id": "gpt-5-codex" }]
      },
      "qwen-compatible": {
        "enabled": false,
        "status": "experimental",
        "auth": "api-key",
        "api": "openai-compatible-chat-completions",
        "models": [{ "id": "<your-qwen-model-id>" }]
      }
    }
  },
  "runtime": {
    "defaultModelRef": "codex-cli/gpt-5-codex",
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
      "qwen-compatible": {
        "enabled": false,
        "apiKeyEnv": "DASHSCOPE_API_KEY",
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "<your-qwen-model-id>",
        "reasoningEffort": "low"
      }
    }
  }
}
```

### 8.3 规则说明

- `runtime.defaultModelRef` 表示长期默认模型，格式固定为 `<provider>/<model>`
- `runtime.stateFilePath` 指向当前模型状态文件，默认保存 `currentModelRef`
- 推荐分层是：
  - `catalog` 只放 provider / auth / api / models 这类长期稳定元数据
  - `runtime.providers` 才放 `baseUrl`、`apiKey`、`credentialFilePath`、`command`、`model`、`reasoningEffort`
- `models use <provider>/<model>` 只更新当前模型状态文件
- `models default <provider>/<model>` 会回写配置文件里的 `runtime.defaultModelRef`
- `models clear` 只清空当前模型状态文件里的 `currentModelRef`
- `models reset` 会同时清空当前模型状态和 `runtime.defaultModelRef`
- `--model <provider>/<model>` 只覆盖当前这一次命令执行，不会修改状态文件和配置
- 当前模型解析优先级固定为：
  1. 命令显式指定
  2. 状态文件里的 `currentModelRef`
  3. 配置文件里的 `runtime.defaultModelRef`
  4. provider 自身默认模型
- 默认模板只保留一份顺序源：
  - 顶层 `catalog.providerOrder` 是通用默认顺序
  - `codex.providerOrder` 只在你确实要覆盖 Codex 专用顺序时再额外写
- 显式 `--config` 或 `OPENCLAW_LLM_CONFIG` 一旦指向了不存在的配置文件，就应该直接报错，不再静默回退到别的候选配置
- `providerOrder` 会覆盖默认顺序
- `enabled: false` 会直接禁用对应 transport
- 相对路径会按配置文件所在目录解析
- app release 包里已经附带模板：
  - [compact-context.llm.config.example.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/compact-context.llm.config.example.json)
- `codex-cli` 和 `codex-oauth` 都支持 `model`
- `codex-oauth` 支持额外配置 `systemPrompt`；如果不显式提供，toolkit 会补一个通用 instruction，避免 Codex OAuth 返回 `Instructions are required`
- `openai-responses` 既可以在配置文件里写 `apiKey`，也可以继续走 `OPENAI_API_KEY`
- `codex-cli` 没有 `baseUrl` 或 `api` 配置，因为它调用的是本机 `codex exec`
- `codex-oauth` 的 `baseUrl` 是兼容 `OPENCLAW_CODEX` 的 transport 参数，不是 OpenAI 官方公开 API 标准字段
- `codex-oauth` 的目录元数据应对齐 OpenClaw，写成 `api: "openai-codex-responses"`，不要再写成普通 `openai-responses`
- `openai-responses` 的 `baseUrl` 默认是 `https://api.openai.com/v1`
- `catalog.providers.*.api` 是 `llm-toolkit` 的 provider 元数据字段，不是请求 payload 参数；其中：
  - `openai-responses` 只用于 OpenAI 官方公开 Responses API
  - `openai-codex-responses` 只用于 Codex OAuth 这条独立 transport

### 8.4 通用多厂商配置方向

当前示例配置额外新增了 `catalog` 层，目的是给后续这些家族收敛成统一配置：
- 通用 Responses 兼容网关 / 代理服务
- 通义千问
- 豆包
- 火山引擎方舟
- GitHub Copilot
- Ollama
- LM Studio

`catalog` 层统一记录：
- 厂商
- 认证方式
- API 家族
- 可用模型目录
- 当前状态（`implemented / experimental / planned`）

真正会影响运行时请求的字段统一放在 `runtime.providers`：
- `baseUrl`
- `apiKey` / `apiKeyEnv`
- `credentialFilePath`
- `command`
- `model`
- `reasoningEffort`
- `headers`

当前要点：
- `catalog` 现在已经不只是占位
- `--mode llm` 会直接读取 `catalog`，并通过通用 transport 创建运行时 provider
- 它首先解决的是“统一配置语义”，不是一步把所有 runtime provider 全做完
- 当前 CLI 真正运行的仍然优先走 `codex` 那条链
- 当前已经能通过 `catalog + llm` 直接跑起来的 API 家族包括：
  - `openai-compatible-chat-completions`
  - `openai-chat-completions`
  - `openai-compatible-responses`
  - `openai-responses`
- `provider.api` 只表示 provider 默认 API 家族
- `model.api` 只在某个模型要覆盖 provider 默认 API 家族时才出现；普通示例不要重复写两遍

## 9. llm-toolkit 的接口职责

当前工具包的分层原则：

- `llm-toolkit`
  - provider / session / registry / transport 顺序
- `createLlmToolkitRuntime`
  - 当前推荐的统一 façade
  - 负责把配置加载、registry 创建、provider 顺序和模型选择收成一层
- `openclaw-context-cli`
  - prompt 组织
  - 结果映射
  - 终端输出

也就是说：
- transport 细节以后继续放 `llm-toolkit`
- app CLI 不要再自己硬编码具体实现

## 10. 当前已经验证过的关键结论

### 10.1 Codex CLI

- 中文 prompt 不要直接走 argv
- Windows 下更稳的做法是走 UTF-8 `stdin`
- 摘要任务默认固定 `model_reasoning_effort=low`

### 10.2 fallback

- `codex` 不能是唯一入口
- 必须保留 `code` fallback

### 10.3 workspace 运行时链接

- 新增 workspace package 后，运行时测试前要执行一次 `npm.cmd install`
- 否则 app 的 dist 在执行时可能找不到新的 workspace 包

### 10.4 CLI / stdio 分工

- `openclaw-context-plugin`
  - 继续只做宿主 `stdio`
- `openclaw-context-cli`
  - 继续只做人工实验入口

### 10.5 配置文件

- transport 顺序不再只能靠硬编码
- 默认顺序仍保留，但现在可以通过配置文件覆盖
- 安装包里最好附带可复制的配置模板，而不是只在文档里描述 JSON 结构

### 10.6 模型选择

- 用户可见的模型引用格式统一为 `<provider>/<model>`
- 默认模型进配置文件
- 当前模型默认进状态文件 `compact-context.llm.state.json`
- 单次命令如果显式带 `--model`，优先级最高
- `models clear` 用来快速回退到“默认模型 / provider 默认模型”
- `models reset` 用来回到“无当前模型、无长期默认模型”的干净状态
- `auth status` 用来确认 `codex-oauth` 现在到底是“未登录”还是“凭据可用”
- `auth login` 会打开浏览器完成 `codex-oauth` 登录，并把结果写回凭据文件
- `auth logout` 会清理本地凭据文件；如果你同时配置了环境变量凭据，provider 仍可能继续可用
- 这样可以同时满足：
  - 长期默认值可追踪
  - 临时切换不污染主配置
  - CLI / 控制台 / 宿主能共用同一套模型引用语义

### 10.7 通用多厂商运行时

- 当前 `llm-toolkit` 已经把通用多厂商接入拆成两条 transport：
  - `openai-compatible-chat`
  - `openai-compatible-responses`
- `openclaw-context-cli --mode llm` 会优先使用 `catalog` 里的 provider 配置，而不是再走 Codex 专用顺序
- 这意味着：
  - Codex 仍然是当前项目的默认推荐链路
  - 但千问、豆包 / Ark、Ollama、LM Studio、Responses 兼容网关已经可以通过统一配置和统一 transport 接入

## 11. 参考资料

### 官方资料

- Using Codex with your ChatGPT plan  
  https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan
- GPT-5-Codex model doc  
  https://developers.openai.com/api/docs/models/gpt-5-codex
- Migrate to the Responses API  
  https://developers.openai.com/api/docs/guides/migrate-to-responses

### 当前仓库实现

- [packages/llm-toolkit](/d:/C_Project/openclaw_compact_context/packages/llm-toolkit)
- [apps/openclaw-plugin/src/bin/openclaw-context-cli.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/bin/openclaw-context-cli.ts)
- [apps/openclaw-plugin/src/cli/context-summary.ts](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/src/cli/context-summary.ts)

### 参考实现

- [OPENCLAW_CODEX/index.js](/D:/C_Project/OPENCLAW_CODEX/index.js)
- [OPENCLAW_CODEX/README.md](/D:/C_Project/OPENCLAW_CODEX/README.md)
- [OPENCLAW_CODEX/DEPLOY.zh-CN.md](/D:/C_Project/OPENCLAW_CODEX/DEPLOY.zh-CN.md)
