# Control Plane 第二轮说明

这份文档描述阶段 8 为 control-plane 增加的第二轮能力。

## 新增重点

### 1. Governance 第二轮
- policy templates
- diff / preview
- conflict detection
- batch submit / review / rollback

对应代码：
- [governance-service.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/governance-service.ts)
- [contracts.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/contracts.ts)

### 2. Observability 第二轮
- persisted thresholds
- paginated history
- alert subscriptions
- alert notifications
- release-to-release comparison

对应代码：
- [observability-service.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/observability-service.ts)
- [contracts.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/contracts.ts)

### 3. Import 第二轮
- source-specific parse / normalize / dedupe / version
- importer registry 元数据深化
- workbench import review 视图承接

对应代码：
- [import-service.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/import-service.ts)
- [importer-registry.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/importer-registry.ts)

### 4. Workbench 第一轮
- alias view
- knowledge review
- import review
- runtime-governance trace

对应代码：
- [server.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/server.ts)
- [console.ts](/d:/C_Project/openclaw_compact_context/src/control-plane/console.ts)

## 新增 API 方向
- Governance:
  - `/api/governance/templates`
  - `/api/governance/preview`
  - `/api/governance/conflicts`
  - `/api/governance/proposals/batch`
  - `/api/governance/proposals/batch/review`
  - `/api/governance/proposals/batch/rollback`
- Observability:
  - `/api/observability/history/page`
  - `/api/observability/thresholds`
  - `/api/observability/subscriptions`
  - `/api/observability/notifications`
  - `/api/observability/compare`
- Workbench:
  - `/api/workbench/aliases`
  - `/api/workbench/knowledge-review`
  - `/api/workbench/import-review`
  - `/api/workbench/runtime-governance-trace`

## 设计取舍
- 仍然不允许 control-plane 直接绕过 runtime engine 写底层 store。
- Governance / Observability / Import 的第二轮能力继续走 facade 和 service contract，而不是在 server 层临时拼逻辑。
- Workbench 先做聚合视图，不急着引入更重的前端状态管理。

## 一句话结论
`第二轮不是推翻 stage 7，而是在 stage 7 的 control-plane 基础上补齐治理、观测、导入和 workbench 的生产级能力。`
