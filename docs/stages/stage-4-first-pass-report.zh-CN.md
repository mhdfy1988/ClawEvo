# �׶� 4 ��һ���ܽ�

## Ŀ��
�׶� 4 ��һ�ֵ�Ŀ�겻�ǡ����������ڼ���ƽ̨�������ǰѽ׶� 3 ������������������������ǰ��һ�֣��ص���֤ 5 ���£�

1. relation ���Դ� `supported_by` �������߼�ֵ��
2. relation retrieval ����� compile / explain �ɱ���ɢ
3. ���ڼ��俪ʼ����С�������ڣ�������ֻ�Ѷ���
4. scope �����߽�����ȷ����ھ�
5. �׶� 4 ��ʼ���Լ�����������

## ��һ��ʵ�������ʲô

### 1. Relation recall ��һ��������һ��߼�ֵ��
���ֲ���ֻ���� `supported_by`�����ǰ����������������ȶ� contract��
- `supported_by`
- `requires`
- `next_step`
- `overrides`

���У�
- `supported_by` �����е� evidence recall
- `requires` ��ʼΪ `Rule / Constraint / Mode` �ṩ recall boost
- `next_step` ��ʼ���� current process �Ĺ�ϵ��ǿ
- `overrides` ���� relation-aware ������ջ�

### 2. Relation retrieval ������С�ɱ�ģ��
���ֲ��Ǽ򵥡����ߡ������ǰ� retrieval ��ʽҲ����������
- ֧�� batch adjacency
- ��Դʱ���� single-source fallback
- diagnostics ����� relation retrieval ���ԡ�lookup ������ edge type

���� relation recall ����ֻ�ǡ����á������ǡ��ɽ��͡��ɻع顢�ɼ�������

### 3. Skill lifecycle �� lineage ���� merge / retire ԭ��
���ְ� skill candidate �ӡ�����Դ��·����������ƽ����ˡ�����������״̬�ļ�����󡱣�
- ֧���ظ� candidate merge
- ֧�ֱ��滻 lineage retire
- ֧�� decay state ���� stale
- explain �ܿ��� merged / retired ��״̬

�⻹���ǳ��ڼ���ƽ̨��̬�������Ѿ����ǡ�ֻ�������������������״̬��

### 4. Scope promotion policy ��������
���ְ� `session / workspace / global` ����ʽԼ����������ʽ�����
- write authority ��ȷ
- recall tier ��ȷ
- recall precedence ��ȷ
- explain ��˵�� higher-scope fallback

### 5. Evaluation harness ��������
���ֿ�ʼ�н׶μ������������Ѹ��ǣ�
- relation recall precision / recall / noise
- memory usefulness / intrusion
- bundle quality
- explain completeness
- retrieval cost

## ���������Ҫ�Ľ���
- relation contract��[relation-contract.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/relation-contract.ts)
- relation-aware compiler��[context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- structured relation ingest��[ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- lifecycle ��ͬ��[memory-lifecycle.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/memory-lifecycle.ts)
- skill merge / retire ԭ�ͣ�[skill-crystallizer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/skill-crystallizer.ts)
- trace / explain �տڣ�[audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- gateway չʾ�㣺[context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- ����������[evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/internal/evaluation/evaluation-harness.ts)

## ��֤���
- `npm test` ͨ��
- ȫ�����ԣ�`64` ��ͨ��
- `npm run test:evaluation` ͨ��
- evaluation harness��`2` ��ͨ��

���������ص������
- `requires / next_step` recall �ع�
- `Topic / Concept` hint ����ع�
- skill merge / retire �� SQLite round-trip
- explain �� relation / lifecycle / topic hint �����

## ��һ����������
�׶� 4 ��һ���������棬���ǡ��ֳ���һ��ͼ�ס������ǣ�

- ��ϵ���߿�ʼ�� contract��������ɢ�����
- ���ڼ��俪ʼ�� lifecycle��������ֻ�����
- Topic / Concept ��ʼ���룬���Ա�Լ���� hint�����ᷴ����Ⱦ����
- ������ʼ�� smoke �ع��ƽ����׶μ� harness

Ҳ����˵��ϵͳ�Ѿ��ӣ�

`��������ܱ��롢��׷��`

�����ƽ����ˣ�

`�����ߡ���������䡢��������ǿ�Ƿ�����м�ֵ`

## ��Ȼ���ø߹��ĵط�
�׶� 4 ��һ����ɺ�ϵͳ��Ȼ��Ӧ�ñ������ɣ�
- �����Ķ���ͼ����ϵͳ
- �����ĳ��ڼ���ƽ̨
- ��������������� recall ϵͳ

��ǰ��׼ȷ�ı߽���Ȼ�ǣ�
- Topic / Concept ֻ�� hint
- relation recall ����һ���߼�ֵ��Ϊ��
- skill merge / retire ���ǵ�һ��ԭ��

## ��һ������
������һ���������������� 3 ��֮һ��

1. ���� relation recall �Ľ��������� path explain
2. Skill / Topic / Concept �ĳ��� admission ����
3. �׶μ��۲��������������

## һ�仰����
`�׶� 4 ��һ�ֵļ�ֵ���ǰѡ���ϵ���ߡ����ڼ���������׶μ��������������ӽ�������������Ȼ�����ǿ����ڿɽ��͡��ɻع顢������ķ�Χ�ڡ�`



