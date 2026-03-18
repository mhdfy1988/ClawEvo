# �׶� 3 ״̬

## 1. �ĵ�Ŀ��

����ĵ����ڻش������£�

1. �׶� 3 ��ǰ������������
2. `Schema / Conflict / Trace` �����������߸�����ɵ�ʲô�̶�
3. ��Щ�Ѿ��ﵽ�׶� 3 ��һ�ֳ��ڣ���ЩӦ������һ����ǿ

---

## 2. ��ǰ����

��ǰ��׼ȷ���ж��ǣ�

`�׶� 3 �ڶ�����ǿ����ɣ�TODO 5��persistence trace����TODO 6��relation-aware recall ��һ�֣���TODO 7��������ǿ�����׷�٣��� TODO 8���ڶ����������ܽᣩ�����տڣ���ǰ����׶� 4 ǰ��׼���׶Ρ�`

����ζ�ţ�

- �׶� 2 �Ѿ����ǵ�ǰ��������
- �׶� 3 Ҳ����ͣ���ڡ��滮 / ׼���׶Ρ�
- ��ǰ���ʺ������ǣ�
  - ����׶� 4 ǰ����������
  - ����׶� 4 TODO

---

## 3. ����ɷ�Χ

### 3.1 Schema

��һ������ɣ�

- ͳһ `NodeGovernance`
- ��ʽ�� `knowledgeState / validity / promptReadiness / traceability`
- ingest Ϊ�����ڵ�д��Ĭ�� governance
- SQLite ���ڴ�ͼ�洢���ѳ־û� governance
- compiler �Ѷ�ȡ governance ��������ѡ��
- explain ����� governance ժҪ

��Ӧ���룺

- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)
- [io.ts](/d:/C_Project/openclaw_compact_context/src/types/io.ts)
- [governance.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/governance.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [001_init.sql](/d:/C_Project/openclaw_compact_context/packages/runtime-core/schema/sqlite/001_init.sql)

״̬�жϣ�

`����ɽ׶� 3 ��һ������`

### 3.2 Conflict

��һ������ɣ�

- ������С��ͻģ�ͣ�`conflictStatus / resolutionState / conflictSetKey / overridePriority`
- ingest �������ɣ�
  - `supersedes`
  - `conflicts_with`
  - `overrides`
- ��ͻ������д�ڵ� governance
- compiler ����������ͻѹ�ƵĽڵ�
- explain ����˵�� suppression reason

��Ӧ���룺

- [governance.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/governance.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)

״̬�жϣ�

`����ɽ׶� 3 ��һ����С�ջ�`

### 3.3 Trace

��һ������ɣ�

- ����ͳһ `TraceView`
- explain �����ͳһ trace �ṹ
- `query_nodes + explain` ֱ�Ӹ��� explain ������ trace
- `inspect_bundle` �� explain sample �Ѹ���ͳһ trace
- trace �Ѹ��ǣ�
  - `source`
  - `transformation`
  - `selection`
  - `output`
  - `persistence`

��Ӧ���룺

- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)
- [io.ts](/d:/C_Project/openclaw_compact_context/src/types/io.ts)
- [trace-view.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/trace-view.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

״̬�жϣ�

`����ɽ׶� 3 ��һ��ͳһ��ͼ`

�ڶ��ֵ�ǰ������

- explain ����ʽ���� `checkpoint / delta / skill candidate` �� persistence trace
- explain ��������ڵ㱻��ʷ�����δ���뵱ǰ runtime bundle���� retention reason
- `query_nodes + explain` �� `inspect_bundle` ��͸��ͬһ�� persistence trace
- �Ѳ� history-retention �ع��� gateway ���Իع�

״̬�жϣ�

`�׶� 3 �ڶ�������� TODO 5��trace ������׶�`

### 3.4 Relation-aware Recall

�ڶ��ֵ�ǰ������

- compiler ��һ������ʽ���� `supported_by` ��Ϊ recall ����
- `relevantEvidence` ������� `activeRules / activeConstraints / openRisks / currentProcess / recentDecisions / recentStateChanges` ��һ�� `supported_by` ֤������Ȩ
- `ContextSelection.reason` ����ʽ��� `via supported_by from ...`
- bundle diagnostics �� explain ���ܿ��� relation contribution
- �Ѳ� relation-aware compiler / explain �ع飬��ͬ������ debug smoke ����

��Ӧ���룺

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [ingest-and-compiler.test.ts](/d:/C_Project/openclaw_compact_context/tests/ingest-and-compiler.test.ts)
- [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/tests/audit-explainer.test.ts)

״̬�жϣ�

`����ɽ׶� 3 �ڶ��� relation-aware recall ��һ��`

### 3.5 Memory Enrichment And Retention Lineage

�ڶ��ֵ�ǰ������

- `checkpoint / delta / skill candidate` ���ڶ��� `sourceBundleId`
- `skill candidate` ���ڻ���ʽ��ָ `sourceCheckpointId / sourceNodeIds`
- explain trace �� `persistence` ��ͼ�Ჹ�룺
  - `checkpointSourceBundleId`
  - `deltaSourceBundleId`
  - `skillCandidateSourceBundleId`
- `query_nodes + explain` �� `inspect_bundle` ���ܿ���һ�µ� bundle lineage
- SQLite ����� checkpoint / delta / skill candidate �� lineage round-trip
- �Ѳ���С������ǿ smoke �� SQLite �ع�

��Ӧ���룺

- [checkpoint-manager.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/checkpoint-manager.ts)
- [skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/skill-crystallizer.ts)
- [trace-view.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/trace-view.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/sqlite-graph-store.ts)
- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)
- [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/tests/audit-explainer.test.ts)
- [context-engine-adapter.test.ts](/d:/C_Project/openclaw_compact_context/tests/context-engine-adapter.test.ts)
- [debug-smoke.test.ts](/d:/C_Project/openclaw_compact_context/tests/debug-smoke.test.ts)
- [ingest-and-compiler.test.ts](/d:/C_Project/openclaw_compact_context/tests/ingest-and-compiler.test.ts)

״̬�жϣ�

`����ɽ׶� 3 �ڶ��ּ�����ǿ�����׷�ٵ�һ�ֱջ�`

---

## 4. �׶� 3 ��һ�ֳ�������

����ѵ�һ�ֳ����������������������顣

### 4.1 Schema ����

- ���к��Ľڵ㶼���ȶ�����ͳһ governance
- `raw / compressed / derived` ����ֻ�� explain �������ͳһ�ֶ�
- compiler �� explain �� governance �Ķ�ȡ�ھ�һ��
- SQLite / InMemory �洢���� round-trip governance

��ǰ�жϣ�

`������`

### 4.2 Conflict ����

- ����һ���߼�ֵ�ڵ����;߱���ͻ�����ֶ�
- ingest ��������С��ͻ���븲�Ǳ�
- compiler ���ٰ��ѱ�ѹ�ƵĽڵ�����ͽ� bundle
- explain ��˵����Ϊʲô����ͻѹ���

��ǰ�жϣ�

`������`

### 4.3 Trace ����

- explain ����ͳһ trace �ṹ
- `query_nodes + explain` �� `inspect_bundle` ���ٸ���ƴһ�׽���
- trace �����ܹ�ͨ `source -> transformation -> selection -> output`
- ��ѹ���ڵ�ͳ�ͻ�ڵ㶼�ܸ����ɶ� trace

��ǰ�жϣ�

`������`

---

## 5. ��֤���

��ǰ�׶� 3 �ڶ�������ɲ��ֵ���֤���ۣ�

- `TypeScript` ����ͨ��
- ȫ�� `node:test` �ع�ͨ��
- ��ǰ�ع�������`47`
- debug smoke �� explain/query �ع��������ͨ��

��ǰ��֤�����ص������

- governance Ĭ��д����־û�
- compiler governance-aware ѡ��
- conflict ������ suppression
- explain ��ͻ����
- trace �� explain / query_nodes / inspect_bundle �е�һ����
- persistence trace ����ʷ�������
- relation-aware recall �� `supported_by` ��ϵ���׽���
- ������ǿ�� `bundle -> checkpoint / delta / skill candidate` lineage ׷��

---

## 6. ��Ȼ���ڵ�ȱ��

�׶� 3 �ڶ����Ѿ���ɡ���ǰ��Ҫʣ����ǽ׶� 4 ǰ��׼���

- relation-aware recall ��û��չ������ͼ�����ǿ�ı����ȼ�����
- ������ǿĿǰ������С lineage �ջ�Ϊ�������ڼ������֡��ۺ�����̭���Ի�û��������
- ����㡢���ڼ���㻹û����ʽ���� compiler
- �׶�ָ����Զ������ջ��ܻ���Ҫ��������

��Щ���ʺ���Ϊ�׶� 4 ��ǰ��׼����

---

## 7. �Ƽ���һ��

��ǰ�������˳���ǣ�

1. �ȸ��� [stage-4-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-prework.zh-CN.md) �����׶� 4 ��Χ
2. ������׶� 4 TODO
   - relation-aware recall ����
   - ���ڼ�����ǿ
   - ������볤�ڼ�������

��Ӧִ���嵥����
[stage-3-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-3-todo.zh-CN.md)

---

## 8. һ�仰����

`�׶� 3 �Ѿ���ɵڶ�����ǿ�տڣ���һ�����������߲��Ǽ�������ɢ���ܣ�������ʽ����׶� 4 ǰ��׼����`




