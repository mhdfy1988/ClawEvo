# OpenClaw Plugin App

这个 app workspace 只负责插件产品的启动壳层与最终发布入口，不承载核心上下文处理实现。

当前职责：
- 插件 `stdio` 入口：`src/bin/openclaw-context-plugin.ts`
- 人工调试 CLI：`src/bin/openclaw-context-cli.ts`
- app 包入口：`src/index.ts`
- 真实实现依赖：
  - `@openclaw-compact-context/openclaw-adapter`
  - `@openclaw-compact-context/llm-toolkit`

## 结构语义

- `openclaw-context-plugin`
  - 只给宿主走 `stdio JSONL`
- `openclaw-context-cli`
  - 只给人直接试摘要、roundtrip、explain

## CLI 使用

当前插件包会暴露两个命令：
- `openclaw-context-plugin`
- `openclaw-context-cli`

如果插件是安装在 OpenClaw 宿主里，并且宿主提供 CLI 注册接口，则还会额外暴露：
- `openclaw compact-context ...`

也就是说：
- 独立 npm / 全局安装时，优先用 `openclaw-context-cli`
- 安装进 OpenClaw 宿主时，优先用 `openclaw compact-context`

### summarize

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode code --text "今天先把首页做成控制塔视角，并保留任务总览。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode codex --text "今天先把首页做成控制塔视角，并保留任务总览。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode codex-cli --text "请只走本机 Codex CLI"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode codex-oauth --text "请只走 ChatGPT OAuth"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode openai-responses --text "请只走 OpenAI Responses API"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode llm --model qwen-compatible/<your-qwen-model-id> --text "请用千问兼容层压缩这段文本"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode llm --model custom-responses/<your-responses-model-id> --text "请用通用 Responses 兼容层压缩这段文本"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode codex --model codex-cli/gpt-5-codex --text "请显式覆盖当前模型"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --config .\\compact-context.llm.config.json --mode codex --text "请按配置顺序尝试 Codex"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --text "今天先把首页做成控制塔视角，并保留任务总览。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --text "今天先把首页做成控制塔视角，并保留任务总览。" --json
```

对应的宿主子命令形态：

```powershell
openclaw compact-context summarize --text "今天先把首页做成控制塔视角，并保留任务总览。"
```

### roundtrip

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --mode code --text "今天先把首页做成控制塔视角，并保留任务总览。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --mode codex --text "今天先把首页做成控制塔视角，并保留任务总览。" --instruction "请压缩输入文本，只保留任务目标和当前动作。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --mode codex --model codex-oauth/gpt-5.4 --text "今天先把首页做成控制塔视角，并保留任务总览。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --mode llm --model qwen-compatible/<your-qwen-model-id> --text "今天先把首页做成控制塔视角，并保留任务总览。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --text "今天先把首页做成控制塔视角，并保留任务总览。" --json
```

对应的宿主子命令形态：

```powershell
openclaw compact-context roundtrip --text "今天先把首页做成控制塔视角，并保留任务总览。"
```

### explain

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js explain --mode code --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js explain --mode auto --model codex-cli/gpt-5-codex --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js explain --mode llm --model qwen-compatible/<your-qwen-model-id> --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2 --json
```

对应的宿主子命令形态：

```powershell
openclaw compact-context explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
```

### models

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models list
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models current
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models use codex-cli/gpt-5-codex
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models default codex-oauth/gpt-5.4
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models clear
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models reset
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models list --json
```

对应的宿主子命令形态：

```powershell
openclaw compact-context models list
openclaw compact-context models current
openclaw compact-context models use codex-cli/gpt-5-codex
```

### auth

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth status
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth login --timeout-ms 180000
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth logout
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth status --json
```

对应的宿主子命令形态：

```powershell
openclaw compact-context auth status
openclaw compact-context auth login --timeout-ms 180000
openclaw compact-context auth logout
```

## summarize / roundtrip / explain 的区别

- `summarize`
  - 只比较摘要结果
  - 适合快速看 `code / codex-*` 的压缩差异
- `roundtrip`
  - 真正走一遍 `ingest -> compile`
  - 同时附带 `summary preview`
  - 适合看一句输入进入系统后最终会被理解成什么
- `explain`
  - 先 compile 当前 bundle
  - 再对选中的节点调用 `engine.explain`
  - 适合看“为什么这个节点会被选中”

## 输出规则

- 默认终端输出：
  - 紧凑、适合人读
- `--json`
  - 输出完整结构
  - 适合脚本消费和后续控制台展示

## 配置文件

CLI 现在支持通过配置文件覆盖 Codex transport 的默认顺序和各 provider 参数。

默认查找顺序：
1. `--config <path>` 显式指定
2. 环境变量 `OPENCLAW_LLM_CONFIG`
3. OpenClaw 用户目录：`~/.openclaw/plugins/compact-context/compact-context.llm.config.json`
4. 插件目录 fallback：`<pluginDir>/compact-context.llm.config.json`

也就是说，日常使用不需要再把配置误写成通用的 `openclaw.*` 文件名；插件命令默认只认带 `compact-context` 前缀的配置文件。
同时，`summarize / roundtrip / explain` 在省略 `--mode` 时默认按 `llm` 处理，不再默认走 `auto`。

当前插件包里已经附带了模板：
- [compact-context.llm.config.example.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/compact-context.llm.config.example.json)

你可以先复制成正式配置：

```powershell
New-Item -ItemType Directory -Force $env:USERPROFILE\.openclaw\plugins\compact-context | Out-Null
Copy-Item apps/openclaw-plugin/compact-context.llm.config.example.json $env:USERPROFILE\.openclaw\plugins\compact-context\compact-context.llm.config.json
```

配置示例：

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

补充说明：
- 推荐分层是：
  - `catalog` 只负责登记 provider / auth / api / models 这类长期稳定元数据
  - `runtime.providers` 才负责 `baseUrl`、`apiKey`、`credentialFilePath`、`command`、`model`、`reasoningEffort`
- `runtime.defaultModelRef`
  - 表示长期默认模型
  - 格式固定为 `<provider>/<model>`
- `runtime.stateFilePath`
  - 表示当前模型状态文件
  - 默认会写 `currentModelRef`
- `models use <provider>/<model>`
  - 修改当前模型
  - 默认会写入 `~/.openclaw/plugins/compact-context/compact-context.llm.state.json`
- `models default <provider>/<model>`
  - 修改长期默认模型
  - 会回写到配置文件里的 `runtime.defaultModelRef`
- `models clear`
  - 只清空当前模型状态文件里的 `currentModelRef`
  - 会回退到配置默认模型或 provider 自身默认模型
- `models reset`
  - 同时清空当前模型状态和长期默认模型
  - 如果当前没有配置文件，不会额外生成一个空配置文件
- `auth status`
  - 查看当前 `codex-oauth` 是否已经检测到凭据
  - 同时显示当前使用的 `baseUrl`、凭据文件路径和配置来源
- `auth login`
  - 打开浏览器走一次 `codex-oauth` 登录流程
  - 如果没有显式配置 `credentialFilePath`，默认把凭据写入 `~/.openclaw/plugins/compact-context/compact-context.codex-oauth.json`
- `auth logout`
  - 清理本地 `codex-oauth` 凭据文件
  - 如果你还配置了环境变量凭据，provider 仍可能继续可用
- `--model <provider>/<model>`
  - 只对当前这一次 `summarize / roundtrip / explain` 生效
  - 优先级高于状态文件和配置默认模型
- 当前模型解析优先级固定为：
  1. 命令显式指定
  2. 当前模型状态文件里的 `currentModelRef`
  3. 配置文件里的 `runtime.defaultModelRef`
  4. provider 自身的默认模型
- 默认模板只保留一份顺序源：
  - 通用和 `llm` 模式默认看顶层 `catalog.providerOrder`
  - `codex.providerOrder` 只在你确实要覆盖 Codex 专用顺序时再额外写
- 显式 `--config` 或 `OPENCLAW_LLM_CONFIG` 一旦指向了不存在的配置文件，CLI 会直接报错，不会静默回退到别的配置
- 顶层 `catalog` 用来登记通用厂商 / 模型元数据，给后续扩展千问、豆包、火山、Copilot、Ollama、LM Studio 这类 provider 预留统一配置结构
- `--mode llm` 会直接读取顶层 `catalog`，并通过通用 transport 创建运行时 provider
- 当前已经能通过 `catalog + llm` 直接跑起来的包括：
  - `openai-compatible-chat-completions`
  - `openai-chat-completions`
  - `openai-compatible-responses`
  - `openai-responses`
- `codex` 这一段仍然是当前项目的默认推荐链路；`catalog` 则负责承接多厂商和通用 transport
- `codex-cli` 和 `codex-oauth` 都支持配置 `model`
- `codex-oauth` 支持额外配置 `systemPrompt`；如果不显式提供，toolkit 会补一个通用 instruction，避免 Codex OAuth 返回 `Instructions are required`
- `codex-cli` 没有 `baseUrl` 或 `api`，因为它调用的是本机 `codex exec`
- `codex-oauth` 的 `baseUrl` 是兼容 `OPENCLAW_CODEX` 的 transport 参数
- `codex-oauth` 的目录元数据应对齐 OpenClaw，写成 `api: "openai-codex-responses"`，不要再写成普通 `openai-responses`
- `openai-responses` 既可以在配置文件里写 `apiKey`，也可以继续走环境变量 `OPENAI_API_KEY`
- `openai-responses` 的 `baseUrl` 默认是 `https://api.openai.com/v1`
- `custom-responses` 这类 provider 适合挂接已经提供 Responses 兼容协议的网关、代理服务或厂商封装层
- `catalog.providers.*.api` 是 `llm-toolkit` 的 provider 元数据字段，不是请求 payload 参数；其中：
  - `openai-responses` 只用于 OpenAI 官方公开 Responses API
  - `openai-codex-responses` 只用于 Codex OAuth 这条独立 transport
- 如果不想把密钥落盘，推荐保留示例里的占位值，实际运行时改用环境变量

## 安装正式插件包后运行

```powershell
npm.cmd install -g artifacts/releases/compact-context/openclaw-compact-context-compact-context-0.1.0.tgz
openclaw-context-cli summarize --text "测试一句话能不能被压缩。"
openclaw-context-cli roundtrip --text "今天先把首页做成控制塔视角，并保留任务总览。"
openclaw-context-cli explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 1
openclaw-context-cli models current
openclaw-context-cli models use codex-cli/gpt-5-codex
openclaw-context-cli models clear
openclaw-context-cli models reset
openclaw-context-cli auth status
openclaw-context-cli auth login --timeout-ms 180000
openclaw-context-cli auth logout
```

## 当前已经验证过的关键结论

- 插件正式 release 包已经是 standalone 包
- `openclaw-context-cli` 安装后可以直接运行
- `codex` 不是唯一入口，CLI 会保留 `code` fallback
- `llm-toolkit` 现在是 Codex transport 的统一承载层
- `--mode llm` 已经可以直接驱动通用 catalog provider，不再只是配置占位

## 相关文档

- [Codex 接入方式说明](/d:/C_Project/openclaw_compact_context/docs/integrations/codex-access-modes.zh-CN.md)
- [Workspace Release Readiness](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-release-readiness.zh-CN.md)
