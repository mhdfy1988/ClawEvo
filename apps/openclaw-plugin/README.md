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
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --config .\\openclaw.llm.config.json --mode codex --text "请按配置顺序尝试 Codex"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode auto --text "今天先把首页做成控制塔视角，并保留任务总览。" --json
```

### roundtrip

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --mode code --text "今天先把首页做成控制塔视角，并保留任务总览。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --mode codex --text "今天先把首页做成控制塔视角，并保留任务总览。" --instruction "请压缩输入文本，只保留任务目标和当前动作。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --mode codex --model codex-oauth/gpt-5.4 --text "今天先把首页做成控制塔视角，并保留任务总览。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --mode llm --model qwen-compatible/<your-qwen-model-id> --text "今天先把首页做成控制塔视角，并保留任务总览。"
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js roundtrip --mode auto --text "今天先把首页做成控制塔视角，并保留任务总览。" --json
```

### explain

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js explain --mode code --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js explain --mode auto --model codex-cli/gpt-5-codex --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js explain --mode llm --model qwen-compatible/<your-qwen-model-id> --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js explain --mode auto --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2 --json
```

### models

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models list
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models current
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models use codex-cli/gpt-5-codex
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models default codex-oauth/gpt-5.4
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js models list --json
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
3. 当前工作目录下的 `openclaw.llm.config.json`
4. 当前工作目录下的 `.openclaw/llm.config.json`
5. 当前用户目录下的 `.openclaw/llm.config.json`

当前插件包里已经附带了模板：
- [openclaw.llm.config.example.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/openclaw.llm.config.example.json)

你可以先复制成正式配置：

```powershell
Copy-Item apps/openclaw-plugin/openclaw.llm.config.example.json openclaw.llm.config.json
```

配置示例：

```json
{
  "runtime": {
    "defaultModelRef": "codex-cli/gpt-5-codex",
    "stateFilePath": "./.openclaw/llm.state.json"
  },
  "codex": {
    "providerOrder": ["codex-cli", "codex-oauth", "openai-responses"],
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
        "reasoningEffort": "low"
      },
      "openai-responses": {
        "enabled": false,
        "apiKey": "sk-REPLACE_ME",
        "baseUrl": "https://api.openai.com/v1",
        "model": "gpt-5-codex",
        "reasoningEffort": "low"
      }
    }
  }
}
```

补充说明：
- `runtime.defaultModelRef`
  - 表示长期默认模型
  - 格式固定为 `<provider>/<model>`
- `runtime.stateFilePath`
  - 表示当前模型状态文件
  - 默认会写 `currentModelRef`
- `models use <provider>/<model>`
  - 修改当前模型
  - 会写入 `.openclaw/llm.state.json`
- `models default <provider>/<model>`
  - 修改长期默认模型
  - 会回写到配置文件里的 `runtime.defaultModelRef`
- `--model <provider>/<model>`
  - 只对当前这一次 `summarize / roundtrip / explain` 生效
  - 优先级高于状态文件和配置默认模型
- 当前模型解析优先级固定为：
  1. 命令显式指定
  2. 当前模型状态文件里的 `currentModelRef`
  3. 配置文件里的 `runtime.defaultModelRef`
  4. provider 自身的默认模型
- 顶层 `catalog` 用来登记通用厂商 / 模型元数据，给后续扩展千问、豆包、火山、Copilot、Ollama、LM Studio 这类 provider 预留统一配置结构
- `--mode llm` 会直接读取顶层 `catalog`，并通过通用 transport 创建运行时 provider
- 当前已经能通过 `catalog + llm` 直接跑起来的包括：
  - `openai-compatible-chat-completions`
  - `openai-chat-completions`
  - `openai-compatible-responses`
  - `openai-responses`
- `codex` 这一段仍然是当前项目的默认推荐链路；`catalog` 则负责承接多厂商和通用 transport
- `codex-cli` 和 `codex-oauth` 都支持配置 `model`
- `codex-cli` 没有 `baseUrl` 或 `api`，因为它调用的是本机 `codex exec`
- `codex-oauth` 的 `baseUrl` 是兼容 `OPENCLAW_CODEX` 的 transport 参数
- `openai-responses` 既可以在配置文件里写 `apiKey`，也可以继续走环境变量 `OPENAI_API_KEY`
- `openai-responses` 的 `baseUrl` 默认是 `https://api.openai.com/v1`
- `custom-responses` 这类 provider 适合挂接已经提供 Responses 兼容协议的网关、代理服务或厂商封装层
- `api` 不是当前 CLI / `llm-toolkit` 的配置字段；在 `OPENCLAW_CODEX` 里它是 OpenClaw provider 元数据
- 如果不想把密钥落盘，推荐保留示例里的占位值，实际运行时改用环境变量

## 安装正式插件包后运行

```powershell
npm.cmd install -g artifacts/releases/openclaw-plugin/openclaw-compact-context-openclaw-plugin-0.1.0.tgz
openclaw-context-cli summarize --mode auto --text "测试一句话能不能被压缩。"
openclaw-context-cli roundtrip --mode auto --text "今天先把首页做成控制塔视角，并保留任务总览。"
openclaw-context-cli explain --mode auto --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 1
openclaw-context-cli models current
openclaw-context-cli models use codex-cli/gpt-5-codex
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
