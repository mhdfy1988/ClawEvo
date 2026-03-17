## 当前项目的长期规则

### 1. 产品边界与入口

1. 当前项目在接入 Codex 能力时，第一优先路线是 `Codex CLI`，不是先重写 OAuth provider，也不是先接 OpenAI API。
2. 当前项目里：
   - `openclaw-context-plugin` 只负责宿主 `stdio JSONL` 插件入口。
   - `openclaw-context-cli` 才是给人直接调试摘要、压缩、roundtrip、explain 的命令行入口。
3. `codex` 模式不能成为当前项目的唯一入口；凡是接入 Codex 的摘要或压缩能力，都必须保留代码主链作为 fallback。
4. 当前项目如果要做“摘要增强”实验，应优先先做：
   - `code`
   - `codex`
   - `auto fallback`
   三种模式并存，再决定是否进入正式主链。

### 2. CLI 与 Codex 调用约束

1. 调用 `codex exec` 处理中文 prompt 时，不要把完整中文内容直接放进命令行参数；应优先使用 UTF-8 文本通过 `stdin` 传入。
2. `openclaw-context-cli` 这类给人直接观察结果的命令，默认终端输出应保持紧凑可读：
   - 默认输出优先展示概览、预览和关键决策。
   - 完整结构、详细字段和脚本消费结果统一走 `--json`。
3. 只要改了 CLI 命令、help 文案或输出语义，就要同步补至少一项：
   - 对应 README / 接入文档示例
   - 对应回归测试
   防止出现“CLI 已改，但文档或测试还停留在旧状态”。

### 3. Release、安装与运行验证

1. 当前项目的 app release 包必须是 standalone 交付物：
   - 必须自包含内部 `@openclaw-compact-context/*` workspace 依赖。
   - 不能依赖安装时再从 registry 拉取内部包。
2. 当前项目在生成 app release 包时，release 专用 manifest 必须把工作区内部路径改写为正式发布路径：
   - `src/*` 入口改写到 `dist/*`
   - `openclaw.extensions`、`exports`、`types` 都要按正式发布口径检查。
3. 在 Windows `cmd` 下使用 `npm pack --pack-destination` 时，优先使用相对路径，不要直接传带引号的绝对路径。
4. 涉及 `cmd / PowerShell / node -e` 多层嵌套的验证命令时，优先拆成顺序命令，避免多层引号互相打架。
5. 做安装验证时，不要把“执行安装后命令”和“清理临时安装目录”并行；清理必须放在验证完成之后再串行执行。
6. 当前项目新增 workspace package 后，如果后续要做运行时测试、安装验证或直接执行 dist 产物，先执行一次 `npm.cmd install`，确保本地 `node_modules` 里的 workspace 链接已经刷新；否则运行时可能出现 `ERR_MODULE_NOT_FOUND`。

### 4. 文档与编码处理

1. 修改经历过多轮重写的文档时，不要直接按旧记忆或旧段落打补丁：
   - 先重新定位当前文件里的实际标题、段落和锚点。
   - 再按现状补丁，避免因为块不匹配把文档打乱。
2. 在当前这台 Windows 机器上检查 UTF-8 中文文档时，不要只看 PowerShell 默认 `Get-Content` 的显示结果；应优先使用 `Get-Content -Encoding utf8` 再判断文件是否真的乱码，避免把终端显示问题误判成文件损坏。

### 5. `llm-toolkit` 的职责边界

1. 当前项目里的大模型 transport 细节统一收敛到 `packages/llm-toolkit`：
   - `openclaw-context-cli` 只负责 prompt、结果映射和终端输出
   - 不要再把具体 provider 逻辑直接写回 app CLI
2. 设计 `llm-toolkit` 配置时，必须区分两层语义：
   - OpenClaw 的 `models.providers.*` 是宿主 provider 元数据和运行时适配配置
   - 当前项目的 `llm-toolkit` 对外配置是插件/工具包自己的公开配置
   不要直接把 OpenClaw 私有字段原样当成当前项目的通用公开配置契约。
3. 设计多模型厂商接入时，优先抽象“provider catalog / auth / transport / model catalog”四层，不要为每一家厂商单独发明一套平铺字段。
4. 涉及 OpenAI / Codex 接入字段时，必须区分“官方公开 API 字段”和“OpenClaw provider 私有字段”；不要把 `api: "openai-codex-responses"` 这类 OpenClaw 元数据误写成 `llm-toolkit` 或正式对外配置契约。

### 6. 配置查找、顺序与模型状态

1. 当前项目的 Codex transport 有默认 fallback 顺序，但允许被配置文件覆盖：
   - 默认顺序是 `codex-cli -> codex-oauth -> openai-responses`
   - 如果存在 `openclaw.llm.config.json` 或显式 `--config`，则优先按配置文件里的顺序设置
   - 其中：
     - `codex` 表示按当前有效顺序尝试所有 Codex transport
     - `auto` 表示按当前有效顺序尝试后，再回退到 `code`
2. 当前项目加载 `openclaw.llm.config.json` 时，查找顺序除了当前工作目录，还要继续回退到插件包目录，再最后回退到用户目录；显式传入的相对 `--config` 路径也应按这个顺序解析，不要只盯住当前目录。
3. 当前项目里 `catalog.providerOrder` 是默认顺序真源，`codex.providerOrder` 只作为 Codex 专用 override：
   - 普通示例配置不要两边重复写同一份顺序
   - 如果没有显式 `codex.providerOrder`，Codex 模式默认继承 `catalog.providerOrder` 中的 Codex transport 顺序
4. 设计当前项目的模型选择机制时，用户可见的模型引用格式统一使用 `<provider>/<model>`；不要让不同 CLI 或不同 provider 各自发明一套模型标识写法。
5. 当前项目要把“长期默认模型”和“临时当前模型”拆开：
   - 默认模型进配置文件里的 `runtime.defaultModelRef`
   - 当前模型进状态文件 `.openclaw/llm.state.json`
   不要把临时切换直接写回主配置。
6. 当前项目的 CLI 如果同时支持“模型状态”和“单次命令显式模型”，则优先级必须固定为：
   - 命令显式 `--model`
   - 状态文件里的当前模型
   - 配置文件里的默认模型
   - provider 自身默认模型
   不要让状态文件覆盖单次命令的显式选择。
7. 当 CLI 走 `--mode llm` 时，provider 选择规则必须保持“配置优先、显式模型兜底、已注册 provider 再兜底”：
   - 先看 `catalog.providerOrder`
   - 如果显式 `--model` 指向某个 provider，则不能因为 providerOrder 为空就直接判定为未启用
   - 如果注册器里已经有可用 provider，也不能在 providerOrder 为空时提前拒绝

### 7. 通用 provider 复用策略

1. 对于通义千问、豆包 / Ark、Ollama、LM Studio 这类本身提供 OpenAI-compatible `/chat/completions` 的模型，优先复用通用 `openai-compatible-chat` transport，不要先为每一家单独写新的 provider。
2. 对于已经提供 Responses 兼容协议的网关、代理服务或厂商封装层，优先复用通用 `openai-compatible-responses` transport，不要先为单一家族复制一套新的 Responses provider。
3. 本地模型或本地代理，如 Ollama、LM Studio、localhost OpenAI-compatible 服务，必须支持无密钥或合成密钥策略，不能默认强制要求真实 `apiKey`。

### 8. 仓库协作约定

1. 在当前项目里，如果用户直接说“提交代码”，默认理解为：
   - 完成本地 commit
   - 并推送到远端 GitHub
   不要只做本地 commit 后停住。

## 当前项目的总结沉淀规则

1. 这个项目每轮完成阶段性工作后，都要做简短总结，至少说明：
   - 这轮完成了什么
   - 剩余问题是什么
   - 有没有值得长期保留的结论
2. 如果总结里出现了对当前仓库长期有效的实现结论、踩坑记录、发布约束或架构边界，就不能只停留在聊天里，必须继续落到以下至少一个位置：
   - 当前项目 `AGENTS.md`
   - 当前项目文档
   - 当前项目测试 / smoke / 校验规则
3. 对这个项目来说：
   - 简短且强约束的规则，优先落 `AGENTS.md`
   - 需要背景、步骤、示例、原因的总结，优先落文档
   - 需要防止回退的结论，优先落测试或 smoke
