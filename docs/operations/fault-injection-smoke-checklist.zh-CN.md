# ����ע���� Smoke Checklist

## 1. �ĵ�Ŀ��

����ĵ����ڰ������������������˻����������̶���һ������ظ�ִ�еļ���

�������Զ������Դ��룬Ҳ��������ĵ������Ǹ�������Щ�����õģ�

- ���� compiler / ingest / explain / gateway debug ֮�������ٻع�
- ����ĳ�θĶ��á������Ŀ����������ܣ����Ѿ����Ծ���ʱ���˹�����
- ����ǰ��һ��ͳһ smoke check

��������������ĵ�����ʹ�ã�

- �������˵����
  [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)
- �������Ų��ֲ᣺
  [debug-playbook.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/debug-playbook.zh-CN.md)

��ǰ�Ѿ���һ����С�Զ��� smoke �׼���

- `npm run test:smoke:debug`
- [debug-smoke.test.ts](/d:/C_Project/openclaw_compact_context/tests/debug-smoke.test.ts)

��ǰ���� smoke �Ѹ��ǵ���

- inspect bundle
- query explain
- provenance explain
- conflict explain
- memory lineage explain

---

## 2. ʹ�÷�ʽ

�������� checklist �ֳ�����ִ�У�

### 2.1 ���� Smoke

�ʺϣ�

- ÿ����Ҫ�Ķ���
- ���� 5 �� 10 ������ȷ������û��

### 2.2 ����ע��

�ʺϣ�

- compiler / provenance / explain ���������˻�
- ��ȷ�ϱ߽糡���Ƿ񻹳���
- ����ǰ����������ԵĻع�

---

## 3. ���� Smoke Checklist

������Щ���ÿ�θ���ؼ���·����һ�顣

### Smoke 1��`inspect_bundle` ������������ bundle ���

��鶯����

1. �� `compact-context.inspect_bundle`
2. ȷ�Ϸ������У�
   - `bundle`
   - `summary`
   - `promptPreview`
   - `selectionContext`

Ԥ�ڽ����

- `summary` ���� selection diagnostics
- `promptPreview` ��Ӧ�ô���ϸ diagnostics header

���ʧ�ܣ����Ȼ��ɣ�

- adapter ��ʽ����
- inspect_bundle �ۺϲ�

### Smoke 2��`query_nodes` ���ܸ����ٻ���ϣ����ɵ��� explain

��鶯����

1. �� `compact-context.query_nodes`
2. ���� `filter.text`
3. �ٴ� `explain=true`

Ԥ�ڽ����

- ��������� `nodes`������ `queryMatch`
- `queryMatch.queryTerms` �ǿ�
- `queryMatch.diagnostics` �ܿ���ÿ���ڵ���������Щ��
- �����ﻹ�ܵ��� `explain`
- `explain.explanations` �����ܽ���ǰ�����ڵ�
- `selectionContext` �ܱ��Ƶ�����

���ʧ�ܣ����Ȼ��ɣ�

- text-search / queryMatch �ۺϲ�
- gateway payload normalization
- query_nodes explain ���Ӳ�

### Smoke 3������ `explain` ����˵�� selection

��鶯����

1. ��һ��ȷ���ᱻѡ�е� `Risk` �� `Rule`
2. �� `compact-context.explain`

Ԥ�ڽ����

- `selection.included=true`
- `selection.slot` ����
- `selection.reason` �ǿ�
- `trace.selection.evaluated=true`
- `trace.output.promptReady=true`

���ʧ�ܣ����Ȼ��ɣ�

- `AuditExplainer`
- explain selectionContext ������

### Smoke 4��tool result ѹ���� provenance ����

��鶯����

1. ����һ���� `tool_result_persist` ѹ������ tool ���
2. ����ؽڵ㲢 explain

Ԥ�ڽ����

- `provenance.originKind=compressed`
- `provenance.sourceStage=tool_result_persist`
- `trace.source.sourceStage=tool_result_persist`
- `trace.output.preferredForm=summary`
- explain ����ָ����Ϊʲô��ѡ�л�û��ѡ��

���ʧ�ܣ����Ȼ��ɣ�

- transcript loader
- ingest provenance ͸��

### Smoke 5��Ԥ��ܾ� currentProcess ʱ�Կɽ���

��鶯����

1. ����һ���ܳ��� `Step`
2. ����С�� compile budget
3. �� `inspect_bundle`

Ԥ�ڽ����

- `bundle.currentProcess` Ϊ��
- `bundle.diagnostics.fixed.skipped` ���ܿ�����Ӧ `Step` / `Process`
- explain �� `trace.selection.included=false`

���ʧ�ܣ����Ȼ��ɣ�

- compiler fixed selection
- diagnostics ���

### Smoke 6������������ͼ�� explain �ﱣ��ͳһ

��鶯����

1. ��һ����ͨ `Rule` �� `Risk`
2. �� `compact-context.explain`

Ԥ�ڽ����

- �� `governance`
- �� `trace`
- `trace.source / transformation / selection / output` ���ɶ�
- `governance` �� `trace.output` �Ŀھ�һ��

���ʧ�ܣ����Ȼ��ɣ�

- `governance.ts`
- `trace-view.ts`
- `audit-explainer.ts`

### Smoke 7��memory lineage �� explain �ﱣ�ֿ�׷��

��鶯����

1. ����һ�� bundle
2. �������� `checkpoint / delta / skill candidate`
3. ������һ�����Ľڵ��� explain

Ԥ�ڽ����

- `trace.persistence.persistedInCheckpoint=true`
- `trace.persistence.surfacedInDelta=true`
- `trace.persistence.surfacedInSkillCandidate=true`
- �ܿ��� `checkpointSourceBundleId / deltaSourceBundleId / skillCandidateSourceBundleId`

���ʧ�ܣ����Ȼ��ɣ�

- `checkpoint-manager.ts`
- `skill-crystallizer.ts`
- `sqlite-graph-store.ts`
- `audit-explainer.ts`

---

## 4. ����ע�� Checklist

������Щ���������ڹؼ����Ա��ʱ�ܡ�

## 4.1 ע�룺���պ���ͨ evidence ͬʱ����

Ŀ�ģ�

- ��֤ `openRisks` ��Ȼ�����ڵ����ȼ� evidence

ע�뷽ʽ��

1. ׼�� 1 ����ȷʧ�ܵ� tool output
2. ��׼��������ƪ���� evidence
3. ��һ��ƫ��� token budget

Ԥ�ڽ����

- `openRisks` ��Ȼ������
- `relevantEvidence` �ᱻ�õ�һ����
- diagnostics ���ܿ��� evidence skip reason

����˻���˵����

- compiler Ԥ��ؿ���ʧЧ

## 4.2 ע�룺ֻ�� compaction / compressed ������û�� raw

Ŀ�ģ�

- ��֤ fallback �߼��Ƿ��ܹ���

ע�뷽ʽ��

1. ����һ�� `compressed` �ڵ�
2. ���Ŷ�Ӧ `raw` �ڵ�
3. ���� bundle

Ԥ�ڽ����

- bundle �Կɽ�������
- explain ��Ҫ��ȷ������ `compressed`

����˻���˵����

- provenance-aware fallback �߼����ܶ���

## 4.3 ע�룺raw �� compressed ͬʱ����

Ŀ�ģ�

- ��֤ raw ���ȼ�û�б������߼�����

ע�뷽ʽ��

1. ͬʱ׼��ͬ����� `raw` �� `compressed` �ڵ�
2. query ָ�������
3. ���� bundle

Ԥ�ڽ����

- ���ȱ�ѡ�е�Ӧ���� `raw`
- diagnostics / explain Ҫ�ܿ���ѡ������

����˻���˵����

- compiler ����� provenance score ���ܱ��Ļ�

## 4.4 ע�룺query_nodes ���غܶ������ѡ

Ŀ�ģ�

- ��֤ `query_nodes + explainLimit + queryMatch` ��Ȼ�ܰ�����С��Χ

ע�뷽ʽ��

1. ׼��������ص����ȼ۵� `Risk / Evidence / State`
2. �ýϿ�� text ��ѯ
3. �� `explain=true`

Ԥ�ڽ����

- `queryMatch.diagnostics` ���ܿ���˭�� `coverage` ����
- `bestField=label` ��ǿ���к�ѡӦ�����ױ��˹��������
- ������ `truncated`
- `explainedCount <= explainLimit`
- ǰ���� explain ������ָ����Щ actually included

����˻���˵����

- text match ��Ͽ���ʧЧ
- gateway query explain �ۺϲ���ܳ�����

## 4.5 ע�룺������ / legacy ���ݽ�������

Ŀ�ģ�

- ��֤�����ݻ���� explain ûʧЧ

ע�뷽ʽ��

1. �ô��ɽڵ�������ݴ����ݿ�
2. �� explain �� query_nodes + explain

Ԥ�ڽ����

- provenance �����пɶ���Ĭ�Ͻ���
- ��Ӧֱ�ӱ���򷵻ؿ� explain

����˻���˵����

- sqlite ����� explain �ݴ������ܻ���

## 4.6 ע�룺��ͻ����ͬʱ����

Ŀ�ģ�

- ��֤ conflict �ջ��Ƿ���Ȼ����

ע�뷽ʽ��

1. ׼��ͬһ `conflictSetKey` ����������
2. �����������෴����������ͬ `overridePriority`
3. ���� bundle �� explain ��ѹ�ƽڵ�

Ԥ�ڽ����

- ���� `conflicts_with / overrides`
- �����ȼ��ڵ㲻����� bundle
- explain ���ܿ��� `conflict` �� suppression reason

����˻���˵����

- ingest ��ͻ���ɹ���� compiler suppression ʧЧ

## 4.7 ע�룺ͳһ trace ��ͼ�˻�

Ŀ�ģ�

- ��֤ `explain / query_nodes + explain / inspect_bundle` û�����·ֲ�����׿ھ�

ע�뷽ʽ��

1. ��ͬһ�ڵ�ֱ��� `explain`
2. ���� `query_nodes + explain`
3. ���� `inspect_bundle` explain sample

Ԥ�ڽ����

- �������ܿ���ͬһ�� `trace` �ṹ
- ���� `sourceStage / semanticNodeId / selection.reason / output.preferredForm` ����

����˻���˵����

- gateway �ۺϲ��ƿ��� explain �����

---

## 5. ����ǰ��С�ع��

���ʱ��ܽ������ǰ���������� 11 �

1. `inspect_bundle` �������� `bundle + summary + promptPreview`
2. `query_nodes` ���� `filter.text` ʱ�������� `queryMatch`
3. `query_nodes + explain` �������� `explain`
4. `explain` �ܽ���һ����ѡ�е� `Risk`
5. `explain` �ܽ���һ���������� `Step`
6. `tool_result_persist` ѹ������Դ� provenance
7. `explain` ����ͳһ `trace`
8. governance �� trace �ھ�һ��
9. ��ͻ�ڵ㱻��ȷ suppress
10. raw �� compressed ����ʱ raw ����
11. memory lineage explain ��Ȼ��׷�� bundle / checkpoint / skill

�� 11 ��������κ�һ�ͨ������������ѵ�ǰ�汾���ɡ���������������ȶ����İ汾��

---

## 6. ÿ��ʧ�ܺ���ȿ���

Ϊ�˱���ʧ�ܺ��ֲ�֪���������֣�����ֱ�Ӱ��������ӳ���Ų飺

- `inspect_bundle` ����
  - �ȿ� `context-engine-adapter.ts`
- `query_nodes` û�� `queryMatch`
  - �ȿ� `text-search.ts` �� gateway success payload �ۺ��߼�
- explain û�� selection
  - �ȿ� `audit-explainer.ts`
- explain û�� trace
  - �ȿ� `trace-view.ts` �� `audit-explainer.ts`
- query_nodes û�� explain ���ӿ�
  - �ȿ� gateway success payload �ۺ��߼�
- provenance ����
  - �ȿ� `transcript-loader.ts`��`ingest-pipeline.ts`
- �������ȼ��쳣
  - �ȿ� `context-compiler.ts`
- conflict suppression �쳣
  - �ȿ� `ingest-pipeline.ts`��`context-compiler.ts`

---

## 7. ������ط�ʽ

��� checklist ���潨����������㣺

### �� 1���ĵ� checklist

�����ǰ��ݣ��ʺ��˹��������Ŷ�Э����

### �� 2���Զ��� smoke fixture

�������԰��������ȶ��ļ����ת�ɣ�

- `node:test` fixture
- �̶� transcript ����
- �̶� inspect/query/explain ����

����ÿ�θĶ���Ͳ�ֻ���˹��жϡ�

---

## 8. ��ش���

- Gateway �ۺ��������ڣ�
  [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/context-engine-adapter.ts)
- explain ���ģ�
  [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- compiler��
  [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- ingest��
  [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- transcript ���룺
  [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/openclaw/transcript-loader.ts)




