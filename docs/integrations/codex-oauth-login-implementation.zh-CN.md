# Codex OAuth 登录实现说明

## 1. 目标与范围

这份文档专门说明当前项目里 `codex-oauth` 这条链路的实现方式，回答 5 个问题：

1. 整个登录与生成流程是怎么跑通的。
2. 用到了哪些技术。
3. 为什么当前实现要借鉴 OpenClaw、`@mariozechner/pi-ai` 和 `OPENCLAW_CODEX`。
4. 这条链路有哪些难点和注意点。
5. 实际怎么调试、怎么验证。

这份文档**只讨论 `codex-oauth`**，不展开 `codex-cli` 或普通 `openai-responses`。

## 2. 这条链路是什么，不是什么

当前项目里的 `codex-oauth` 是一条**独立的 Codex OAuth transport**，不是普通 OpenAI API Key 路线。

当前项目已经明确区分：

- `codex-cli`
  - 复用本机 `codex exec`
- `codex-oauth`
  - 走 ChatGPT / Codex OAuth 登录
  - 目录元数据语义对齐 OpenClaw：`api = "openai-codex-responses"`
- `openai-responses`
  - 只表示 OpenAI 官方公开 `Responses API`

这也是为什么 `codex-oauth` 不能再伪装成普通 `openai-responses`。

官方公开口径也支持这种拆分：

- OpenAI 官方公开 API 里，`GPT-5-Codex` 当前通过 `Responses API` 使用：  
  <https://developers.openai.com/api/docs/models/gpt-5-codex>
- Codex CLI 支持用 ChatGPT account 登录：  
  <https://developers.openai.com/codex/cli>
- ChatGPT 计划也支持使用 Codex：  
  <https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan>

但官方公开开发者文档**没有**把 `https://chatgpt.com/backend-api` 作为通用开发者 API 契约公开出来。因此在当前项目里，这条线被视为：

- 一条与 OpenClaw / `pi-ai` 对齐的 `codex-oauth` transport
- 而不是通用公开 `openai-responses` provider

## 3. 当前实现落点

当前项目里，`codex-oauth` 相关代码主要落在下面这些文件：

- 登录会话与本地回调服务：
  - `packages/llm-toolkit/src/sessions/openclaw-codex-oauth-session.ts`
- 生成 provider：
  - `packages/llm-toolkit/src/providers/openclaw-codex-oauth-provider.ts`
- 认证命令入口：
  - `apps/openclaw-plugin/src/cli/context-auth.ts`
- CLI 统一执行器：
  - `apps/openclaw-plugin/src/cli/context-cli-runtime.ts`
- CLI bin：
  - `apps/openclaw-plugin/src/bin/openclaw-context-cli.ts`
- 示例配置：
  - `apps/openclaw-plugin/compact-context.llm.config.example.json`

当前推荐的调试入口是：

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth status --config apps/openclaw-plugin/compact-context.llm.config.example.json
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth login --config apps/openclaw-plugin/compact-context.llm.config.example.json --timeout-ms 180000
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode codex-oauth --config apps/openclaw-plugin/compact-context.llm.config.example.json --text "测试一下"
```

## 4. 整体流程

### 4.1 总览

可以先把整条链路压成一张图：

```text
auth status / auth login
  -> 加载 llm-toolkit 配置
  -> 解析 codex-oauth runtime 配置
  -> 创建 OpenClawCodexOAuthSession

auth login
  -> 生成 PKCE 参数
  -> 构造 authorize URL
  -> 启动本地回调服务 http://127.0.0.1:1455/auth/callback
  -> 打开浏览器
  -> 用户完成授权
  -> 捕获 code
  -> 向 token endpoint 交换 access / refresh token
  -> 保存本地 credential JSON

summarize --mode codex-oauth
  -> 加载配置
  -> 创建 OpenClawCodexOAuthTextProvider
  -> getValidCredential()
  -> 如将过期则 refresh token
  -> 组装 systemPrompt + user prompt
  -> 调用 pi-ai completeSimple()
  -> 返回文本结果
```

### 4.2 `auth status`

`auth status` 本身不做登录，它只回答三件事：

1. 当前是否找到了 `codex-oauth` 的有效配置。
2. 当前凭据文件是否存在。
3. 当前 access token / refresh token 是否可用。

在当前实现里，它的流程是：

1. 通过 `loadLlmToolkitConfig(...)` 加载配置。
2. 通过 `resolveProviderRuntimeConfig(config, "codex-oauth")` 取出 `runtime.providers["codex-oauth"]`。
3. 创建 `OpenClawCodexOAuthSession`。
4. 调用 `session.getAvailability()` 和 `session.loadCredential()`。
5. 输出：
   - `config source`
   - `config file`
   - `base url`
   - `credential file`
   - `has credential`
   - `has refresh token`
   - `account id`
   - `expires at`

### 4.3 `auth login`

`auth login` 是真正触发浏览器登录的入口。

当前流程如下：

1. 和 `auth status` 一样，先解析配置并创建 `OpenClawCodexOAuthSession`。
2. 调用 `session.beginAuthorization()`：
   - 生成 `code_verifier`
   - 生成 `code_challenge`
   - 生成 `state`
   - 构造授权 URL
3. 启动本地回调服务：
   - 默认监听：`127.0.0.1:1455`
   - 默认回调：`http://localhost:1455/auth/callback`
4. 通过 `openExternalUrl(...)` 打开浏览器。
5. 用户在浏览器里完成授权后，浏览器跳回本地回调地址。
6. 回调服务校验：
   - `pathname === /auth/callback`
   - `state` 一致
   - `code` 存在
7. 拿到 `code` 后，调用 `exchangeAuthorizationCode(code, verifier)`：
   - `grant_type=authorization_code`
   - 带上 `client_id`
   - 带上 `code_verifier`
   - 带上 `redirect_uri`
8. 拿到返回的：
   - `access_token`
   - `refresh_token`
   - `expires_in`
9. 从 access token 的 JWT payload 里提取 `chatgpt_account_id`。
10. 保存到本地 JSON 凭据文件。

### 4.4 `summarize --mode codex-oauth`

登录成功后，真正的调用流程不再走 `auth`，而是走 provider。

当前流程如下：

1. `context-summary.ts` 根据 `--mode codex-oauth` 创建 `llm-toolkit runtime`。
2. runtime 解析到 `codex-oauth` provider。
3. `OpenClawCodexOAuthTextProvider.generateText(...)` 调用：
   - `session.getValidCredential()`
4. 如果 access token 临近过期，`session.refreshCredential(...)` 会先执行 refresh token 交换。
5. provider 解析模型：
   - 默认模型：`gpt-5.4`
   - 可通过配置覆盖
   - 最终用 `pi-ai` 的 `getModel("openai-codex", modelId)` 取模型元数据
6. provider 组装请求：
   - `systemPrompt`
   - `messages`
   - `apiKey = credential.access`
   - `transport`
   - `reasoning`
7. 最终通过 `@mariozechner/pi-ai` 的 `completeSimple(...)` 发出请求。
8. 从返回的 assistant message 中提取 text block，作为最终摘要结果返回。

## 5. 用到的技术

### 5.1 PKCE

当前实现走的是标准 PKCE：

- `code_verifier`
- `S256 code_challenge`
- `state`

这一步在 `OpenClawCodexOAuthSession.beginAuthorization()` 里完成。

### 5.2 本地回调服务

当前实现不是手动复制授权码，而是默认先尝试本地回调：

- Host：`127.0.0.1`
- Port：`1455`
- Callback：`/auth/callback`

这和 OpenClaw 文档 / 成熟实现保持一致。

### 5.3 Authorization Code + Refresh Token

当前实现完整支持：

- 首次 `authorization_code` 交换
- 后续 `refresh_token` 刷新

并且支持提前刷新窗口，避免 access token 刚好在请求前后过期。

### 5.4 JWT claim 提取

access token 保存后，当前实现会从 JWT payload 里提取：

- `chatgpt_account_id`

这样 `auth status` 能显示当前登录的是哪个账号。

### 5.5 结构化凭据持久化

当前项目没有沿用 OpenClaw 的 `auth-profiles.json` 存储方式，而是存一份插件自己的 JSON 凭据文件。

默认示例配置里写的是：

```json
"credentialFilePath": "./compact-context.codex-oauth.json"
```

因此项目级配置下，凭据会落到配置文件所在目录相对路径下。

### 5.6 `@mariozechner/pi-ai`

这是当前实现里最关键的技术选型之一。

我们最终没有继续手写完整的请求 transport，而是复用了 `pi-ai` 的成熟实现：

- `getModel("openai-codex", modelId)`
- `completeSimple(...)`

原因很直接：

1. 这条链路本来就是 OpenClaw 生态里已经跑通的成熟实现。
2. `pi-ai` 已经处理了 `openai-codex-responses` 的请求形状。
3. 这样我们只需要补：
   - 配置解析
   - 凭据管理
   - 本地回调服务
   - CLI 与 provider 的衔接

### 5.7 Windows 下打开浏览器

Windows 下不能随便 `start <url>`。

当前实现为了避免 URL 里的 `&` 被 `cmd` 当成命令分隔符，已经对齐成熟做法：

- `cmd /c start "" "<url>"`
- `windowsVerbatimArguments: true`

否则授权 URL 会被截断，最后在浏览器里表现成：

- `missing_required_parameter`

### 5.8 Windows 下本地回调服务收尾

登录成功后，浏览器回调结束不代表 Node 进程一定会立刻退出。

当前实现已经额外处理：

- 跟踪所有 socket
- `server.closeAllConnections?.()`
- `server.closeIdleConnections?.()`
- `socket.destroy()`
- `await server.close(...)`

否则会出现：

- 登录已成功
- 凭据也已写入
- 但进程仍然挂住不退出

## 6. 关键配置

当前示例配置中，`codex-oauth` 的关键块是：

```json
{
  "catalog": {
    "providers": {
      "codex-oauth": {
        "enabled": true,
        "status": "experimental",
        "auth": "oauth",
        "api": "openai-codex-responses",
        "models": [
          {
            "id": "gpt-5.4",
            "name": "GPT-5.4"
          }
        ]
      }
    }
  },
  "runtime": {
    "providers": {
      "codex-oauth": {
        "enabled": true,
        "baseUrl": "https://chatgpt.com/backend-api",
        "credentialFilePath": "./compact-context.codex-oauth.json",
        "model": "gpt-5.4",
        "reasoningEffort": "low",
        "systemPrompt": "You are a helpful assistant. Reply clearly and concisely."
      }
    }
  }
}
```

这些字段的职责分别是：

- `catalog.providers.codex-oauth.api`
  - 这是目录元数据
  - 当前必须写成 `openai-codex-responses`
- `runtime.providers.codex-oauth.baseUrl`
  - 当前 transport 的请求入口
- `credentialFilePath`
  - 当前项目自己的凭据文件位置
- `model`
  - 默认模型
- `reasoningEffort`
  - 默认推理强度
- `systemPrompt`
  - 当前 provider 调用时的默认 instruction

## 7. 实际案例

### 7.1 项目级配置下的登录与查询

这是当前最推荐的调试方式：

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth status --config apps/openclaw-plugin/compact-context.llm.config.example.json
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth login --config apps/openclaw-plugin/compact-context.llm.config.example.json --timeout-ms 180000
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth status --config apps/openclaw-plugin/compact-context.llm.config.example.json
```

特点：

- 凭据落在项目目录下
- 不污染宿主默认状态
- 最适合本地调试

### 7.2 项目级配置下直接生成

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js summarize --mode codex-oauth --config apps/openclaw-plugin/compact-context.llm.config.example.json --text "测试一下"
```

如果这条能成功返回，说明下面 4 段都已经打通：

1. 配置解析
2. 本地 credential 读取 / refresh
3. `pi-ai` transport
4. text 结果提取

### 7.3 代理环境下登录

OpenClaw 文档里提到，如果在代理环境里遇到：

- `403`
- `unsupported_country_region_territory`

可以先试：

`cmd.exe`：

```cmd
set NODE_USE_ENV_PROXY=1
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth login --config apps/openclaw-plugin/compact-context.llm.config.example.json --timeout-ms 180000
```

`PowerShell 5.1`：

```powershell
$env:NODE_USE_ENV_PROXY='1'
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth login --config apps/openclaw-plugin/compact-context.llm.config.example.json --timeout-ms 180000
```

这个点不是当前实现私有发明的，而是 OpenClaw 文档里的成熟经验。

### 7.4 一个很容易踩的配置案例

下面这两条命令看起来像同一组，实际上读的是两份配置：

```powershell
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth login --config apps/openclaw-plugin/compact-context.llm.config.example.json --timeout-ms 180000
node apps/openclaw-plugin/dist/bin/openclaw-context-cli.js auth status
```

第一条把凭据写到了项目里的相对路径。  
第二条如果不带同一个 `--config`，就会退回默认配置查找链，最后看的是另一份凭据文件。

这会造成一种假象：

- 明明刚登录成功
- 立刻 `auth status` 又说没凭据

根因不是登录失败，而是**两条命令读的不是同一份配置**。

## 8. 难点与注意点

### 8.1 不要把 `codex-oauth` 当普通 `openai-responses`

这是当前实现里最关键的一条边界。

如果误写成：

```json
"api": "openai-responses"
```

通用 registry 很容易把它当成普通 API key provider 去实例化，最后报成：

- 缺 `apiKey`
- 普通 Responses 配置不完整

正确做法是：

- `codex-oauth` 保持独立语义
- `api = "openai-codex-responses"`

### 8.2 `Instructions are required`

`codex-oauth` 这条 `pi-ai` transport 在生成时要求 `instructions/systemPrompt`。

所以当前实现里：

- provider 支持显式配置 `systemPrompt`
- 如果调用方没传，toolkit 会补默认值

否则你会看到：

- OAuth 已登录成功
- 但生成时报 `Instructions are required`

### 8.3 Windows 浏览器打开 URL 被截断

如果在 Windows 下直接把授权 URL 丢给 `cmd /c start`，而没有做好引号保护，URL 里的 `&` 会被截断。

最终表现通常是浏览器页报：

- `missing_required_parameter`

### 8.4 登录成功但进程不退出

这是另一个非常像“登录失败”的假象。

实际情况可能是：

- 浏览器回调已经成功
- token 已经写进凭据文件
- 只是本地回调服务的 socket 没收干净

所以当前实现必须显式清理 socket，并等待 `server.close(...)`。

### 8.5 项目配置与默认配置混用

显式 `--config` 的登录结果，只会落到那份配置解析出来的凭据文件上。  
后续如果不带同样的 `--config`，CLI 可能就去看另一份默认凭据。

### 8.6 当前项目不读取 OpenClaw 全局模型配置

当前实现里，`openclaw compact-context ...` 只是宿主入口。  
它**不会**去接管 OpenClaw 全局 provider / model 配置。

当前项目自己的配置真源仍然是：

- `compact-context.llm.config.json`
- `compact-context.llm.state.json`

## 9. 这次实现借鉴了哪些成熟案例

### 9.1 OpenAI 官方文档

官方主要提供了两条边界：

1. `GPT-5-Codex` 的公开开发者 API 走 `Responses API`
2. Codex CLI 可以用 ChatGPT account 登录

这决定了我们不能把：

- 公开 `Responses API`

和：

- ChatGPT / Codex OAuth transport

写成一回事。

### 9.2 OpenClaw

OpenClaw 最值得借鉴的是它的语义拆分：

- provider：`openai-codex`
- api：`openai-codex-responses`

而不是把它写成普通 `openai-responses`。

此外，OpenClaw 文档和实现还给了我们几个成熟结论：

- `openclaw models auth login --provider openai-codex`
- 回调地址：`http://127.0.0.1:1455/auth/callback`
- 代理环境下的 `NODE_USE_ENV_PROXY=1`
- OpenClaw 自己的凭据收纳方式是 `auth-profiles.json`

### 9.3 `OPENCLAW_CODEX`

这个仓库不是我们当前实现的最终形态，但它给了两类很直接的帮助：

1. 证明 ChatGPT OAuth 这条链路是可以工程化接入的。
2. 提供了：
   - `baseUrl = https://chatgpt.com/backend-api`
   - 本地 callback server
   - token exchange / refresh

这些关键参数和流程参考。

### 9.4 `@mariozechner/pi-ai`

这是当前实现最后真正落地的 transport 基础。

相对于继续手写 fetch，它的价值在于：

- 已经有成熟 `openai-codex-responses` 支持
- 已经有模型目录与 provider 元数据
- 已经有 `completeSimple(...)` 这类适合我们当前摘要场景的接口

所以当前项目最终采用的策略是：

- 登录与凭据管理自己管
- 真正的生成 transport 尽量复用 `pi-ai`

## 10. 当前结论

到当前这版为止，`codex-oauth` 的本地链路已经具备以下状态：

1. `auth status` 可用。
2. `auth login` 可完成浏览器登录，并写入凭据。
3. `summarize --mode codex-oauth` 可直接产出结果。
4. 关键坑点已经收口到：
   - 独立 `openai-codex-responses` 语义
   - 默认 `systemPrompt`
   - Windows URL 打开方式
   - Windows 回调服务收尾

如果后面继续深化，这条线最值得保持的原则是：

- 不要把外部协议行为继续猜下去
- 优先对齐官方文档、OpenClaw 和 `pi-ai` 这类成熟实现
- 本地试错只用来验证和补细节，不用来替代协议语义本身

## 11. 参考链接

- OpenAI Codex CLI：  
  <https://developers.openai.com/codex/cli>
- OpenAI GPT-5-Codex：  
  <https://developers.openai.com/api/docs/models/gpt-5-codex>
- OpenAI Help: Using Codex with your ChatGPT plan：  
  <https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan>
- `@mariozechner/pi-ai`：  
  <https://www.npmjs.com/package/@mariozechner/pi-ai>
- OpenClaw 仓库：  
  <https://github.com/openclaw/openclaw>
- `OPENCLAW_CODEX` 参考实现：  
  [README.md](/D:/C_Project/OPENCLAW_CODEX/README.md)
