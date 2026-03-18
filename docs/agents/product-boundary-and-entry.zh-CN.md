# 产品边界与入口

## 规则

1. 当前项目在接入 Codex 能力时，第一优先路线是 `Codex CLI`，不是先重写 OAuth provider，也不是先接 OpenAI API。
2. 当前项目里：
   - `openclaw-context-plugin` 只负责宿主 `stdio JSONL` 插件入口。
   - `openclaw-context-cli` 才是给人直接调试摘要、压缩、roundtrip、explain 的命令行入口。
   - 如果插件安装在 OpenClaw 宿主里，并且宿主提供 CLI 注册接口，则优先暴露并维护 `openclaw compact-context ...` 这条宿主子命令入口；不要假设包自己的 `bin` 一定会被宿主安装器直接挂到 PATH。
3. `codex` 模式不能成为当前项目的唯一入口；凡是接入 Codex 的摘要或压缩能力，都必须保留代码主链作为 fallback。
4. 当前项目如果要做“摘要增强”实验，应优先先做：
   - `code`
   - `codex`
   - `auto fallback`
   三种模式并存，再决定是否进入正式主链。
5. 接入真实 OpenClaw 宿主插件接口时，插件导出的 `register(api)` 必须保持同步：
   - 当前 OpenClaw 宿主会忽略返回 Promise 的异步注册
   - `registerCli`、`registerCommand` 这类附加注册面如果放进 `async register`，会静默失效
6. `apps/openclaw-plugin` 应保持宿主适配壳：如果 CLI 或宿主入口需要上下文运行时能力，优先通过 `@openclaw-compact-context/compact-context-core` 的聚合导出使用，不直接 import `runtime-core` / `contracts`。

## 适用任务

- 调整 `openclaw-context-plugin` / `openclaw-context-cli` 的角色边界
- 把插件接成 `openclaw compact-context ...` 宿主子命令
- 讨论“先上 Codex 还是先上 API / OAuth”
- 决定一项新能力该挂在 `plugin`、`cli` 还是 `llm-toolkit`
