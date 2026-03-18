# 通用 provider 复用与外部集成规则

## 规则

1. 对于通义千问、豆包 / Ark、Ollama、LM Studio 这类本身提供 OpenAI-compatible `/chat/completions` 的模型，优先复用通用 `openai-compatible-chat` transport，不要先为每一家单独写新的 provider。
   - 在 `catalog.providers.*.api` 里优先写 `openai-compatible-chat-completions`
   - 不要因为它们请求形状看起来和 OpenAI 官方 `/chat/completions` 一样，就写成 `openai-chat-completions`
   - `openai-chat-completions` 更适合保留给 OpenAI 官方 Chat Completions 语义
   - 当前项目里这两个值虽然共用同一套 provider 实现，但语义标签仍然要区分“官方 OpenAI”与“第三方兼容接口”
2. 对于已经提供 Responses 兼容协议的网关、代理服务或厂商封装层，优先复用通用 `openai-compatible-responses` transport，不要先为单一家族复制一套新的 Responses provider。
3. 本地模型或本地代理，如 Ollama、LM Studio、localhost OpenAI-compatible 服务，必须支持无密钥或合成密钥策略，不能默认强制要求真实 `apiKey`。
4. 当前项目里的 `codex-oauth` 必须保持独立的 Codex OAuth transport 语义：
   - `catalog.providers.codex-oauth.api` 应写成 `openai-codex-responses`
   - 不要再把它写成普通 `openai-responses`
   - `openai-responses` 只保留给 OpenAI 官方公开 Responses API 路线
5. 当前项目走 `codex-oauth` 生成文本时，必须保证请求里有 `instructions/systemPrompt`：
   - `pi-ai` / OpenClaw 这条 Codex OAuth transport 在生成阶段会要求 instructions
   - 如果调用方没有显式提供，toolkit 需要补一个通用默认 system prompt
   - 不要再把 `Instructions are required` 误判成 token、OAuth 或 baseUrl 问题
6. 调试 `codex-oauth` 浏览器登录链路时，OAuth 默认参数优先对齐 OpenClaw / `@mariozechner/pi-ai` 的已知可用值：
   - 默认 `redirect_uri` 用 `http://localhost:1455/auth/callback`
   - 默认 `originator` 用 `pi`
   - 不要在缺少证据时自行发明新的默认参数，再靠反复试错碰运气

## 适用任务

- 接千问、豆包、火山、Ollama、LM Studio
- 处理 `codex-oauth` / `openai-responses` 的边界
- 对齐 OpenClaw / `pi-ai` / 官方文档语义
