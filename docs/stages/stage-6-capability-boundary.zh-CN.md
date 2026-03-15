# 阶段 6 第一轮能力边界

这份文档用于回答：
- 阶段 6 第一轮已经真正做到了什么
- 哪些还是半实现
- 哪些还没有进入正式实现

## 已实现
### 1. Runtime Context Contract
- `Runtime Context Window Contract`
- `Prompt Assembly Contract`
- `Runtime Snapshot Persistence`
- `compact-context.inspect_runtime_window`

### 2. Control Plane Service 第一轮
- `governance-service`
- `observability-service`
- `import-service`

### 3. 人工治理第一轮
- `proposal -> approval -> apply -> rollback`
- scope-aware authority
- correction audit trace
- gateway 治理入口

### 4. Dashboard Observability 第一轮
- dashboard contract
- metric cards
- alerts
- runtime snapshot 一等数据源
- `compact-context.inspect_observability_dashboard`

### 5. 多来源导入平台第一轮
- import job contract
- source-specific flow contract
- incremental / version / failure 字段
- gateway import lifecycle

### 6. 目录重构第一轮
- `runtime / context-processing / governance / infrastructure / adapters`
- 分层入口
- 兼容保留

## 半实现
### 1. Control Plane
已有 service contract 和 gateway 入口，但还不是独立进程级 control plane。

### 2. Import Platform
已有 job / flow 模型，但还没有真正的文档抓取器、仓库扫描器和批量 source catalog。

### 3. Dashboard Observability
已有 contract 和 alerts，但还没有历史存储、分页 query 和 Web dashboard。

### 4. Directory Refactor
已有分层入口，但还没有大规模 move 旧文件与清理旧 import。

## 未实现
### 1. Web UI / Console
目前仍然没有正式控制台页面。

### 2. 独立 Control Plane API
当前仍以 service + gateway 入口为主。

### 3. Import History / Retry / Scheduler
尚未做成平台级作业系统。

### 4. 阶段 6 第二轮
第二轮深化目标还没有落成正式 TODO。

## 一句话结论
`阶段 6 第一轮已经把“平台化”从文档方向变成了可运行的 contract + service + gateway 入口；但它仍然是第一轮平台底座，不是完整产品化控制台。`
