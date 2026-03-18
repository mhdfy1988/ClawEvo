# Release、安装与宿主验证

## 规则

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
7. 用 `openclaw plugins install <tgz>` 重新安装同版本 archive 插件时，宿主不会覆盖现有安装目录：
   - 如果要让新包真正生效，必须先卸载旧插件，再安装新包
   - 不要看到 `plugins info` 里的 `Source path` 更新了，就误以为安装目录里的 dist 已经被替换
8. OpenClaw 从 archive 或 `package.json` 探测插件时，会用 npm 包的 unscoped 名称作为 `idHint`：
   - 如果 npm 包名和 `openclaw.plugin.json` 的 `id` 不一致，宿主会持续提示 `plugin id mismatch`
   - 因此当前项目的插件包名必须和 manifest `id: compact-context` 对齐，同时同步 release 目录与安装文档口径
9. 宿主安装链路如果出现当前版本/当前环境特有的 workaround（例如 `tgz` 直装不稳定、需要先解包再装目录），优先把具体步骤收进 runbook：
   - `AGENTS` 里只保留长期有效的安装约束
   - 具体命令、当前宿主版本现象和临时 workaround 放到安装 runbook，不继续堆在规则层
10. 当前项目已经把正式配置、状态和 OAuth 凭据锁定在插件目录：
   - 全局 npm CLI 验证时，`pluginDir` 指全局安装后的包目录
   - OpenClaw 宿主验证时，`pluginDir` 指 `~/.openclaw/extensions/compact-context`
   - 不要再把验证建立在用户目录或源码目录之外的隐式 fallback 上

## 适用任务

- 打包 `compact-context`
- 重装 OpenClaw 插件
- 校验 tgz 是否 standalone
- 处理 `plugin id mismatch`
- 判断当前安装问题该记进规则还是 runbook
