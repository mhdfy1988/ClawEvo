# CLI、Codex 与 OAuth 调试约束

## 规则

1. 调用 `codex exec` 处理中文 prompt 时，不要把完整中文内容直接放进命令行参数；应优先使用 UTF-8 文本通过 `stdin` 传入。
2. `openclaw-context-cli` 这类给人直接观察结果的命令，默认终端输出应保持紧凑可读：
   - 默认输出优先展示概览、预览和关键决策。
   - 完整结构、详细字段和脚本消费结果统一走 `--json`。
3. 只要改了 CLI 命令、help 文案或输出语义，就要同步补至少一项：
   - 对应 README / 接入文档示例
   - 对应回归测试
   防止出现“CLI 已改，但文档或测试还停留在旧状态”。
4. 调试 `codex-oauth` 时，优先使用显式认证命令：
   - `auth status`
   - `auth login`
   - `auth logout`
   不要再通过 `summarize --mode codex-oauth` 的报错去倒推“是不是没登录”。
5. Windows 下本地 `codex-oauth auth login` 如果已经登录成功却迟迟不退出，优先检查本地回调服务的 socket 收尾：
   - 浏览器回调连接可能在授权成功后仍短暂挂住
   - 当前实现会跟踪回调 socket，并在关闭时显式 `closeAllConnections()` / `closeIdleConnections()` / `socket.destroy()`，再等待 `server.close()` 完成
   - 不要先回头怀疑 OAuth 参数、token 或 baseUrl
6. 在 Windows 上通过 `cmd /c start` 打开 OAuth / 浏览器 URL 时，必须把完整 URL 作为一个整体加引号传入，并启用 `windowsVerbatimArguments`：
   - 否则 URL 中的 `&` 会被 `cmd` 当成命令分隔符，导致查询参数被截断
   - 这类问题优先对齐 OpenClaw 官方 `openUrl(...)` 的实现，不要自己猜测 Windows 的命令行转义规则
7. 当前项目的 Node CLI bin 入口默认不要在主逻辑结束后直接调用 `process.exit(...)`：
   - 优先设置 `process.exitCode`
   - 避免在 OAuth 回调、本地临时服务或浏览器子进程仍在收尾时，被 Windows 提前强退触发句柄关闭断言
8. `auth` 这类轻量 CLI 命令应保持懒加载：
   - 不要在顶层 import 时顺手拉起 `roundtrip` / `explain` / `ContextEngine` 这类重链路
   - 否则会让本地认证链路无关地携带 SQLite/engine 副作用，增加调试噪音和退出不稳定性
9. `summarize / roundtrip / explain` 省略 `--mode` 时，当前默认按 `llm` 处理：
   - `auto` 仍然可用
   - 但它现在是显式 fallback / 调试策略，不再是日常默认入口
10. Windows 下的 `codex-cli` 可用性检查不要只依赖裸命令 `codex` 是否刚好在当前终端 PATH 里：
   - 先尝试直接探测 `codex --version`
   - 如果失败，再尝试 `where codex` / `where.exe codex` 解析绝对路径
   - 对当前机器，还要继续 fallback 到 VS Code OpenAI 扩展目录下的 `codex.exe`
   - 这样可以避免不同终端会话 PATH 不一致时，把“命令可执行”误判成“Codex CLI 不可用”
11. 当 `compact-context` 通过全局 npm 安装后，`codex-cli` 默认要允许在非 Git 仓库目录执行：
   - `codex exec` 应带上 `--skip-git-repo-check`
   - 否则用户在 `C:\\Users\\<name>` 之类普通目录直接运行 `openclaw-context-cli summarize ...` 时，会被 Codex CLI 自己拒掉
12. `codex-oauth` 对接 `pi-ai` 时，不要假设 `getModel('openai-codex', ...)` 返回的模型元数据一定完整：
   - 即使 `getModel()` 成功返回，也要强制补齐 `api: openai-codex-responses`
   - 同时固定 `provider: openai-codex` 和 `baseUrl`
   - 否则会出现 `No API provider registered for api: undefined`

## 适用任务

- 调试 `codex-cli`
- 调试 `codex-oauth`
- 调整 CLI 输出、示例、help 文案
- 处理 Windows 下浏览器打开、回调服务和命令退出问题
