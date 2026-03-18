# Import Source Spec

这份文档定义 import platform 第一轮支持的来源类型、默认 flow 和字段约束。

相关代码：
- [import-service.ts](/d:/C_Project/openclaw_compact_context/packages/compact-context-core/src/import-service.ts)
- [control-plane-service-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/control-plane/control-plane-service-contracts.zh-CN.md)

## 1. 支持的来源

当前第一轮固定支持三类来源：
1. `document`
2. `repo_structure`
3. `structured_input`

## 2. Source Descriptor

所有来源统一使用：

```ts
type ImportSourceDescriptor = {
  kind: "document" | "repo_structure" | "structured_input"
  path?: string
  uri?: string
  repoRoot?: string
  format?: string
  checksum?: string
}
```

## 3. 默认 Flow

### `document`
- `parser`: `document_parser`
- `normalizer`: `document`
- `materializer`: `source_entities`

### `repo_structure`
- `parser`: `repo_structure_parser`
- `normalizer`: `repo_structure`
- `materializer`: `source_entities`

### `structured_input`
- `parser`: `structured_payload_parser`
- `normalizer`: `structured_input`
- `materializer`: `runtime_ingest`

## 4. Stage 约束

所有 job 当前都固定三段：
1. `parse`
2. `normalize`
3. `materialize`

每段都要产出：
- `status`
- `completedAt`
- 可选 `recordCount`
- 可选 `warningCount`
- 可选 `durationMs`

## 5. Version 与 Incremental

### `versionInfo`
当前最少包含：
- `schemaVersion`
- `parserVersion`
- `normalizerVersion`
- `materializerVersion`
- `dedupeKey`
- `recordVersion`

### `incremental`
当前支持：
- `enabled`
- `previousJobId`
- `cursor`
- `changedRecordIds`

## 6. 当前原则

`import-service` 负责编排 job，真正入图仍由 runtime engine 完成。

因此 import service 不直接：
- 写图存储
- 绕过 ingest 主链
