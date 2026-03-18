# �׶� 4 ׼�������

## 1. Ŀ��

����ĵ����ڻش��������⣺

1. ����׶� 4 ֮ǰ��������Щ�����Ȳ����
2. �׶� 4 �Լ�֮�󣬻�Ӧ�ö���滮��Щ����

�������µ�·��ͼ������һ�ݻ��ڵ�ǰ����������ĵ���׼������顣

---

## 2. ������

��ǰ�����Ѿ��߱�����׶� 4 ǰ��׼���Ļ������������ʺ�ֱ�Ӵ��ģ���ߡ������䡢�� scope��

����Ҫ�Ȳ�����Ĳ��ǡ������ĸ����ܡ������� 5 �����̵�����

1. `��ϵ������Լ`
2. `��ϵ������ explain �ɱ�����`
3. `���������������`
4. `scope ������д��߽�`
5. `�׶� 4 ����������ָ��`

һ�仰�жϣ�

`�׶� 4 ���ǲ��ܿ�ʼ������Ӧ���Ȱѡ����ߡ������䡢�������������µ��������д���������ʽ����ʵ�֡�`

---

## 3. ����׶� 4 ǰ���貹�����

### 3.1 ��ϵ������Լ��������ȷ

��ǰ�����compiler �ѿ�ʼ���ѹ�ϵ�����ȶ������ı���Ȼ�Ƚ��٣�

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
  - ������һ�� `supported_by`
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
  - �ȶ����ɵı���Ҫ���ǣ�
    - `supported_by`
    - `conflicts_with`
    - `supersedes`
    - `overrides`

�����Ͳ��Ѿ������˸���ߣ�

- [core.ts](/d:/C_Project/openclaw_compact_context/src/types/core.ts)
  - `requires`
  - `next_step`
  - `produces`
  - `uses_skill`

�������ڣ�

- ��Щ���Ѿ��� schema������û���ȶ����ɹ���
- Ҳû����ȷ��Щ������� recall ��������Щֻ�ʺ� explain
- �׶� 4 ���ֱ���� recall��������׳��֡��߶���ܶ࣬���������ͱ����ȼ���ͳһ��������

�����ڽ׶� 4 ǰ�Ȳ���

- relation production contract
- recall-eligible edge whitelist
- ÿ��ߵ� provenance / confidence / priority ����

### 3.2 ��ϵ������ explain �ĳɱ����ƻ�û����

��ǰʵ�ֶԵ��Ự��ģ�ǿ��õģ����׶� 4 ������ߺ������䣬�ⲿ�ֳɱ������ԷŴ�

�������Ѿ��ܿ�������ɱ��㣺

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
  - `compile()` ��������� `queryNodes(...)`
  - relation-aware recall ������� selection �� `getEdgesForNode(...)`
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
  - explain ��� node edges
  - persistence explain ��ɨ�� `listCheckpoints / listDeltas / listSkillCandidates`
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/sqlite-graph-store.ts)
  - `queryNodes()` �� text ������Ȼ�� SQL ��ɸ������ JS ���� `matchesTextFilter`

��ǰ�Ⲣ���� bug�����Խ׶� 4 ��˵������ζ�ţ�

- recall ����ǰ���������ȷ batch retrieval / adjacency cache / index ����
- explain �� persistence lineage ��Ҫ���ڷ�����������Զ����� N ��ɨ��
- SQLite �������Ҫ�нӸ����ģ���䣬Ӧ�ÿ�ʼ�滮�����Ͳ�ѯ·��������ֻ�ǹ�����ȷ

�����ڽ׶� 4 ǰ�Ȳ���

- relation retrieval cost model
- explain lineage lookup strategy
- SQLite / GraphStore ��������������ȡ����˵��

### 3.3 ��������������ڻ�û����ʽ����

��ǰ `memory lineage` �Ѿ���ͨ������������γ��ڴ��ڡ�����»�û��������������

����״̬��

- [skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/skill-crystallizer.ts)
  - �����ǻ��� bundle ����һ���� `SkillCandidate`
  - ���� `sourceBundleId / sourceCheckpointId / sourceNodeIds`
  - ��û�� merge��upgrade��retire
- [checkpoint-manager.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/checkpoint-manager.ts)
  - ���������� checkpoint / delta
  - ����û�зֲ� checkpoint �ͼ�����̭����

�������ڣ�

- ��ǰ�Ѿ�����׷�١����������ܡ��ܹ����
- û������������Լ�����޷���ȫ�Ŵ��ڼ����

�����ڽ׶� 4 ǰ�Ȳ���

- `SkillCandidate -> Skill` ��������
- memory merge / dedupe / retire ����
- checkpoint �ķֲ��뱣�����

### 3.4 scope ������д��߽绹�������

��ǰ����Ͳ��Դ󲿷ֻ���Χ�� `session` �ڹ�����

�Ӵ������ܿ�����

- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
  - ���������ѯ���� `sessionId`
- [context-persistence.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/context-persistence.ts)
  - checkpoint / delta / skill candidate ���� `sessionId` ��֯
- [sqlite-graph-store.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/sqlite-graph-store.ts)
  - ��ѯ·��Ҳ��Ҫ�� session ά�ȶ�

��˵����

- �׶� 4 ���Ҫ���� workspace / global �����䣬��ǰ��ȱ��ȷ�� promotion policy
- ��ȱ��˭��д�� workspace/global��ʲô���������� scope��������߽�

�����ڽ׶� 4 ǰ�Ȳ���

- session -> workspace -> global promotion policy
- higher-scope write gate
- higher-scope recall precedence

### 3.5 �׶� 4 ������ָ�껹û��ʽ��

��ǰ�������ǲ���ģ�����Ȼƫ�����ܻع顱�������ǡ��׶���������

��״��

- [debug-smoke.test.ts](/d:/C_Project/openclaw_compact_context/tests/debug-smoke.test.ts)
  - �Ѹ��ǵ����� smoke
- [fault-injection-smoke-checklist.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/fault-injection-smoke-checklist.zh-CN.md)
  - ���з���ǰ smoke / fault injection

����ȱ��

- recall ����֮����ô���������Ƿ�����
- ���ڼ���������ô���� bundle �����Ƿ��½�
- scope ��������ô���� workspace/global recall �Ƿ�ԽȨ��Խ��

�����ڽ׶� 4 ǰ�Ȳ���

- relation recall precision / noise ָ��
- long-memory usefulness / intrusion ָ��
- bundle quality / explain completeness / retrieval cost ָ��

---

## 4. �׶� 4 Ӧ�������

�����������飬�׶� 4 ���������� prework �������ٲ� 4 �����ݡ�

### 4.1 Edge Governance

��ֻ�� node ������㣬���� recall �����ĸ߼�ֵ relation ҲӦ�ÿ�ʼ�߱���С������ͼ��

- edge confidence
- edge freshness
- edge recall eligibility
- edge priority

����׶� 4 �� recall ���߻�Խ��Խ����д��������

### 4.2 Memory Governance

��ǰ memory lineage ���У����׶� 4 Ӧ�����ƽ��� memory governance��

- promotion
- merge
- retire
- decay

���� skill / checkpoint ֻ��Խ��Խ�࣬����Խ��Խ�á�

### 4.3 Scope Governance

�׶� 4 ���Ҫ�� workspace / global��������ʽ������Լ����

- promotion gate
- write authority
- recall precedence
- fallback policy

### 4.4 Evaluation Harness

�׶� 4 ��ʼǰ������ѡ��׶���������������һ�㣬����ֻ�������� smoke��

- representative transcripts
- relation recall evaluation fixture
- long-memory intrusion fixture
- workspace/global promotion fixture

---

## 5. �׶� 4 ֮���Խ��鲹�����

��Щ��һ��Ҫ���ڽ׶� 4 ��һ������������ǰ����·��ͼ�

### 5.1 Topic / Concept Layer ����ʽ����ģ��

��ǰ������ǿ�㻹�Ǹ����ϵġ�

�������鲹��

- `Topic`
- `Concept`
- `PatternTag`
- topic-aware recall

### 5.2 ������ϵ�ٻ���Լ��

��ǰ relation-aware recall ��һ�������ء��ɽ��͵ġ�

����������ٿ��ǣ�

- ���� recall
- relation path constraints
- path explanation

### 5.3 ���ڼ���Ŀ�������

�������鲹��

- workspace skill reuse
- global pattern reuse
- cross-session memory curation

### 5.4 �׶μ��۲����

�����������Щ�����ͳһ�۲���������ͳһͳ�������

- bundle token quality
- recall edge contribution
- memory promotion / merge / retire
- explain completeness

---

## 6. ������ĵ����

Ϊ�˱�����Щ������ֻͣ������һҳ������ͬ�������漸�����ĵ���

- [stage-4-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-prework.zh-CN.md)
- [stage-4-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-todo.zh-CN.md)
- [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- [layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)
- [documentation-index.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/documentation-index.zh-CN.md)

---

## 7. һ�仰����

`�׶� 4 ǰ��ò��ģ������¹��ܱ�������ǡ����ߡ������䡢���������������¶�Ӧ�Ĺ�����Լ������Լ����`




