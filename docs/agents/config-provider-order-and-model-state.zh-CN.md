# 配置查找、provider 顺序与模型状态

## 规则

1. 当前项目的 Codex transport 有默认 fallback 顺序，但允许被配置文件覆盖：
   - 默认顺序是 `codex-cli -> codex-oauth -> openai-responses`
   - 如果存在 `openclaw.llm.config.json` 或显式 `--config`，则优先按配置文件里的顺序设置
   - 其中：
     - `codex` 表示按当前有效顺序尝试所有 Codex transport
     - `auto` 表示按当前有效顺序尝试后，再回退到 `code`
2. 当前项目加载 `openclaw.llm.config.json` 时，查找顺序除了当前工作目录，还要继续回退到插件包目录，再最后回退到用户目录；显式传入的相对 `--config` 路径也应按这个顺序解析，不要只盯住当前目录。
3. 当前项目里显式传入的 `--config` 或环境变量 `OPENCLAW_LLM_CONFIG` 一旦指向了不存在的配置文件，就必须直接报错；不要再静默回退到默认查找链路，避免实际运行到了错误配置。
4. 当前项目推荐的 LLM 配置分层是：
   - `catalog` 只放 provider / auth / api / models 这类长期稳定元数据
   - `runtime.providers` 才放 `baseUrl`、`apiKey`、`credentialFilePath`、`command`、`model`、`reasoningEffort`、`headers`
   - 旧的“把运行时字段混在 catalog 里”的写法只作兼容读取，不再作为推荐示例或新配置真源
5. 当前项目里 `catalog.providerOrder` 是默认顺序真源，`codex.providerOrder` 只作为 Codex 专用 override：
   - 普通示例配置不要两边重复写同一份顺序
   - 如果没有显式 `codex.providerOrder`，Codex 模式默认继承 `catalog.providerOrder` 中的 Codex transport 顺序
6. 设计当前项目的模型选择机制时，用户可见的模型引用格式统一使用 `<provider>/<model>`；不要让不同 CLI 或不同 provider 各自发明一套模型标识写法。
7. 当前项目要把“长期默认模型”和“临时当前模型”拆开：
   - 默认模型进配置文件里的 `runtime.defaultModelRef`
   - 当前模型进状态文件 `.openclaw/llm.state.json`
   不要把临时切换直接写回主配置。
8. 当前项目的 CLI 如果同时支持“模型状态”和“单次命令显式模型”，则优先级必须固定为：
   - 命令显式 `--model`
   - 状态文件里的当前模型
   - 配置文件里的默认模型
   - provider 自身默认模型
   不要让状态文件覆盖单次命令的显式选择。
9. 当 CLI 走 `--mode llm` 时，provider 选择规则必须保持“配置优先、显式模型兜底、已注册 provider 再兜底”：
   - 先看 `catalog.providerOrder`
   - 如果显式 `--model` 指向某个 provider，则不能因为 providerOrder 为空就直接判定为未启用
   - 如果注册器里已经有可用 provider，也不能在 providerOrder 为空时提前拒绝
10. 清空长期默认模型时，如果当前本来就没有配置文件，不要为了“清空”额外在 cwd 生成一个空的 `openclaw.llm.config.json`；默认状态应继续保持为真正的无配置状态。

## 适用任务

- 改 `openclaw.llm.config.json`
- 改模型切换 / 当前模型 / 默认模型
- 改 `providerOrder`
- 改 `--config` 查找链路
