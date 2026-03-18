# ��Ŀ���Ǩ�Ʊ���

## �����������

### 1. ���� contract ����

- `runtime context / prompt assembly` �鵽�������Ͳ�
- `logger contract` �鵽�������Ͳ�

�ؼ��ļ���
- [runtime-context.ts](/d:/C_Project/openclaw_compact_context/src/types/runtime-context.ts)
- [logging.ts](/d:/C_Project/openclaw_compact_context/src/types/logging.ts)

### 2. �����ƽ̨���ֱ�ӻ���

- ����ࣺ
  - [control-plane-bridge.ts](/d:/C_Project/openclaw_compact_context/src/plugin/control-plane-bridge.ts)
- ƽ̨�ࣺ
  - [control-plane-runtime-bridge.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/control-plane-runtime-bridge.ts)

### 3. `src/core` ��ʵ��Ǩ��

Ǩ�ƽ����
- `src/context-processing/*`
- `src/runtime/*`
- `src/governance/*`
- `src/infrastructure/*`

`src/core/*` ���� shim �Ѿ�ɾ������·��Ǩ����ʽ��ɡ�

### 4. workspace ���ӽ���

������
- `apps/openclaw-plugin`
- `apps/control-plane`
- `packages/contracts`
- `packages/runtime-core`
- `packages/compact-context-core`

### 5. ����������

������
- workspace smoke test
- GitHub Actions CI
- root `exports` / `workspaces` / workspace scripts
- package-local `version / files / prepack`
- workspace `pack:workspace` dry-run ��֤

### 6. shared package �߽������խ

������
- `src/types/control-plane.ts`
- `src/types/evaluation.ts`
- workspace ͳһ `clean dist -> build`
- `packages/contracts/dist` �߽� smoke ����

�����
- `packages/contracts` ����ͨ�� `internal/evaluation/*` ����ʵ�ֲ�����
- `packages/contracts` �� dry-run ��������Ѿ���խ�� `contracts + types`

## Ŀ¼ӳ��

### �����Ĵ���

- `src/context-processing/concept-normalizer.ts` -> [src/context-processing/concept-normalizer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/concept-normalizer.ts)
- `src/context-processing/context-processing-pipeline.ts` -> [src/context-processing/context-processing-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/context-processing-pipeline.ts)
- `src/context-processing/semantic-spans.ts` -> [src/context-processing/semantic-spans.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/semantic-spans.ts)

### ����ʱ

- `src/runtime/ingest-pipeline.ts` -> [src/runtime/ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- `src/runtime/context-compiler.ts` -> [src/runtime/context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- `src/runtime/audit-explainer.ts` -> [src/runtime/audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)

### ����

- `src/governance/governance.ts` -> [src/governance/governance.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/governance.ts)
- `src/governance/knowledge-promotion.ts` -> [src/governance/knowledge-promotion.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/knowledge-promotion.ts)
- `src/governance/relation-contract.ts` -> [src/governance/relation-contract.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/relation-contract.ts)

### ������ʩ

- `src/infrastructure/context-persistence.ts` -> [src/infrastructure/context-persistence.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/context-persistence.ts)
- `src/infrastructure/graph-store.ts` -> [src/infrastructure/graph-store.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/graph-store.ts)
- `src/infrastructure/sqlite-graph-store.ts` -> [src/infrastructure/sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/sqlite-graph-store.ts)

## ��֤

- `npm run check`
- `npm test`
- `npm run test:evaluation`
- `npm run test:smoke:workspace`



