# Compact Context 安装与验证流程

这份 runbook 记录 `compact-context` 当前已经验证通过的两条安装链路：

1. `npm` 全局安装后，直接使用 `openclaw-context-cli ...`
2. 安装到 OpenClaw 宿主后，使用 `openclaw compact-context ...`

## 前置条件

正式配置与凭据默认放在：

- `<pluginDir>\compact-context.llm.config.json`
- `<pluginDir>\compact-context.runtime.config.json`
- `<pluginDir>\compact-context.codex-oauth.json`
- `<pluginDir>\compact-context.llm.state.json`

这里的 `<pluginDir>` 指的是“当前实际执行的插件安装目录”，不是用户目录，也不是固定指源码目录：

- 源码直跑时：`D:\C_Project\openclaw_compact_context\apps\openclaw-plugin`
- 全局 npm 安装后：`C:\Users\luoji\AppData\Roaming\npm\node_modules\@openclaw-compact-context\compact-context`
- 安装到 OpenClaw 宿主后：`C:\Users\luoji\.openclaw\extensions\compact-context`

当前 release 包只携带：

- `compact-context.llm.config.example.json`
- `compact-context.runtime.config.example.json`

不会自动把你的正式配置和 OAuth 凭据打进包里，所以全局 CLI 和 OpenClaw 宿主验证都需要把正式文件放进各自的安装目录。

如果要改插件自己的运行策略和存储路径，直接改插件目录里的：

- [compact-context.runtime.config.example.json](/d:/C_Project/openclaw_compact_context/apps/openclaw-plugin/compact-context.runtime.config.example.json)

其中当前这几个路径已经显式进文件：

- `dbPath`
- `runtimeSnapshotDir`
- `toolResultArtifactDir`

## release 包路径

当前插件 release 包：

- [openclaw-compact-context-compact-context-0.1.0.tgz](/d:/C_Project/openclaw_compact_context/artifacts/releases/compact-context/openclaw-compact-context-compact-context-0.1.0.tgz)

重新打包命令：

```powershell
npm.cmd run pack:release:plugin
```

## 1. npm 全局安装流程

安装后的插件目录：

- `C:\Users\luoji\AppData\Roaming\npm\node_modules\@openclaw-compact-context\compact-context`

安装命令：

```powershell
npm.cmd uninstall -g @openclaw-compact-context/compact-context
npm.cmd install -g D:\C_Project\openclaw_compact_context\artifacts\releases\compact-context\openclaw-compact-context-compact-context-0.1.0.tgz
```

把正式配置和 OAuth 凭据同步到全局安装目录：

```powershell
Copy-Item D:\C_Project\openclaw_compact_context\apps\openclaw-plugin\compact-context.llm.config.json C:\Users\luoji\AppData\Roaming\npm\node_modules\@openclaw-compact-context\compact-context\compact-context.llm.config.json -Force
Copy-Item D:\C_Project\openclaw_compact_context\apps\openclaw-plugin\compact-context.runtime.config.json C:\Users\luoji\AppData\Roaming\npm\node_modules\@openclaw-compact-context\compact-context\compact-context.runtime.config.json -Force
Copy-Item D:\C_Project\openclaw_compact_context\apps\openclaw-plugin\compact-context.codex-oauth.json C:\Users\luoji\AppData\Roaming\npm\node_modules\@openclaw-compact-context\compact-context\compact-context.codex-oauth.json -Force
```

验证命令：

```powershell
openclaw-context-cli summarize --text "测试一句话能不能被压缩。"
openclaw-context-cli roundtrip --text "今天先把首页做成控制塔视角，并保留任务总览。"
openclaw-context-cli explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
openclaw-context-cli summarize --model codex-oauth/gpt-5.4 --text "测试一下OAuth摘要。"
```

## 2. OpenClaw 宿主安装流程

当前 OpenClaw 版本直接安装 `tgz` 容易卡在宿主内部解压超时，所以宿主验证推荐用：

`先解包 tgz -> 再安装解包目录`

### 2.1 清理旧的 `compact-context`

如果宿主里之前装过源码链接版或旧 release 目录版，先卸载：

```powershell
openclaw.cmd plugins uninstall compact-context
```

### 2.2 解包新 tgz

```powershell
if (Test-Path .tmp\openclaw-host-package) { Remove-Item .tmp\openclaw-host-package -Recurse -Force }
New-Item -ItemType Directory -Path .tmp\openclaw-host-package | Out-Null
tar -xf artifacts\releases\compact-context\openclaw-compact-context-compact-context-0.1.0.tgz -C .tmp\openclaw-host-package
```

解包后的插件目录是：

- `D:\C_Project\openclaw_compact_context\.tmp\openclaw-host-package\package`

### 2.3 安装到 OpenClaw

```powershell
openclaw.cmd plugins install D:\C_Project\openclaw_compact_context\.tmp\openclaw-host-package\package
```

安装后的插件目录：

- `C:\Users\luoji\.openclaw\extensions\compact-context`

如果不通过脚本自动同步，则手动把正式配置和 OAuth 凭据放进去：

```powershell
Copy-Item D:\C_Project\openclaw_compact_context\apps\openclaw-plugin\compact-context.llm.config.json C:\Users\luoji\.openclaw\extensions\compact-context\compact-context.llm.config.json -Force
Copy-Item D:\C_Project\openclaw_compact_context\apps\openclaw-plugin\compact-context.runtime.config.json C:\Users\luoji\.openclaw\extensions\compact-context\compact-context.runtime.config.json -Force
Copy-Item D:\C_Project\openclaw_compact_context\apps\openclaw-plugin\compact-context.codex-oauth.json C:\Users\luoji\.openclaw\extensions\compact-context\compact-context.codex-oauth.json -Force
```

### 2.4 验证宿主子命令

```powershell
openclaw.cmd plugins info compact-context
openclaw.cmd compact-context --help
openclaw.cmd compact-context summarize --text "测试一句话能不能被压缩。"
openclaw.cmd compact-context explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
openclaw.cmd compact-context summarize --model codex-oauth/gpt-5.4 --text "测试一下OAuth摘要。"
```

## 3. 一键脚本

仓库里已经提供脚本：

- [verify-compact-context-install.mjs](/d:/C_Project/openclaw_compact_context/scripts/verify-compact-context-install.mjs)

对应 npm 命令：

```powershell
npm.cmd run verify:install:compact-context
npm.cmd run verify:install:compact-context:global
npm.cmd run verify:install:compact-context:openclaw
```

脚本默认会做这些事：

1. 重新打插件 release 包
2. 如果仓库插件目录里已经有：
   - `apps/openclaw-plugin/compact-context.llm.config.json`
   - `apps/openclaw-plugin/compact-context.runtime.config.json`
   - `apps/openclaw-plugin/compact-context.codex-oauth.json`
   则验证时直接同步到对应安装目录
3. 重装全局 npm 包并验证 `openclaw-context-cli`
   - `summarize / roundtrip / explain`
4. 备份 `C:\Users\luoji\.openclaw\openclaw.json`
5. 清理旧的 `compact-context` 宿主安装记录和扩展目录
6. 解包新 `tgz`
7. 用解包目录重装 OpenClaw 插件
8. 验证 `openclaw compact-context summarize / explain`

如果仓库插件目录里找不到正式配置，脚本会直接报错退出；如果找不到 OAuth 凭据，则默认跳过 `codex-oauth` 显式测试。

## 4. 当前已验证通过的最小命令集

全局 CLI：

```powershell
openclaw-context-cli summarize --text "测试一句话能不能被压缩。"
openclaw-context-cli roundtrip --text "今天先把首页做成控制塔视角，并保留任务总览。"
openclaw-context-cli explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
openclaw-context-cli summarize --model codex-oauth/gpt-5.4 --text "测试一下OAuth摘要。"
```

OpenClaw 宿主：

```powershell
openclaw.cmd compact-context --help
openclaw.cmd compact-context summarize --text "测试一句话能不能被压缩。"
openclaw.cmd compact-context explain --text "今天先把首页做成控制塔视角，并保留任务总览。" --limit 2
openclaw.cmd compact-context summarize --model codex-oauth/gpt-5.4 --text "测试一下OAuth摘要。"
```

## 5. 当前已锁定的上下文压缩场景

除了安装后的真实命令验证，当前还通过自动化测试锁定了这 3 类场景：

1. 长上下文渐进压缩
   - 第 1 轮、第 2 轮不压缩
   - 第 3 轮开始生成单块 `incremental`
2. 超阈值全量重压缩
   - 超过 `60%` 预算后，在 `assemble()` 内直接触发 `full`
   - 重建 `baseline`
   - 清空旧 `incremental`
3. recent raw tail 保留
   - 固定保最近 `2` 个 turn block
   - `toolResult` 跟所属 turn 一起保留
   - `baseline / incremental / rawTail` 三层不重叠

当前对应的锁定测试主要在：

- [context-engine-adapter.test.ts](/d:/C_Project/openclaw_compact_context/tests/context-engine-adapter.test.ts)
