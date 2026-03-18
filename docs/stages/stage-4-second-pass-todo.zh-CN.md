# �׶� 4 �ڶ�����ǿ TODO

���嵥���ڹ�����Ȳ������Ĵ�������������ܿ���ǿ�뾭��ѧϰ���ĵڶ��ֹ�����

��ǰ�жϣ�
`�׶� 4 �ڶ��ֵ������������տ�����ȫ����ɣ�����������ת��׶� 5 Ԥ�������`

����ĵ���
- ��ǰ״̬��[stage-4-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-status.zh-CN.md)
- ����·��ͼ��[context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)
- ���ͼ�׼ܹ���[layered-knowledge-graph-architecture.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/layered-knowledge-graph-architecture.zh-CN.md)
- �����Ĵ�����Լ��[context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-contracts.zh-CN.md)
- �Դ�ѧϰ�뾭�������[experience-learning-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/knowledge/experience-learning-plan.zh-CN.md)
- ��� summarize �Ĵ�������[summarize-reference-for-context-processing.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/references/summarize-reference-for-context-processing.zh-CN.md)
- �׶� 5 Ԥ��˵����[stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-prework.zh-CN.md)
- �׶� 5 Ԥ�� TODO��[stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-todo.zh-CN.md)
- �׶� 4 ��һ�� TODO��[stage-4-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-4-todo.zh-CN.md)
- TODO ģ�壺[todo-template.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/todo-template.zh-CN.md)

## ����

- [ ] ��ǰ��ʣ����죻������ת�� [stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-todo.zh-CN.md)��

## ������

- [ ] ��ǰ�޽��������񣻺�����ת�� [stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-todo.zh-CN.md)��

## �����

- [x] TODO 10: ����׶� 5 Ԥ���� ~3d #�ܹ� #�ĵ� @Codex 2026-03-14
  - [x] �������� relation recall �� path explain �Ľ�������
  - [x] ���� workspace / global ��������临���볤���������
  - [x] ���� `FailurePattern / SuccessfulProcedure / Skill / Topic / Concept` �ĳ����ں����������
  - [x] ���� `Attempt -> Episode -> Pattern -> Skill / Rule / Process` ��֪ʶ������ͬ
  - [x] �����۲���塢�˹�У��������ѡ LLM extractor �߽�
  - [x] ����׶� 5 Ԥ��˵���� TODO ���

- [x] TODO 9: ��ɽ׶� 4 �ڶ����������ĵ��տ� ~3d #�ĵ� #���� @Codex 2026-03-14
  - [x] ����׶� 4 �ڶ���״̬���ܽ��ĵ�
  - [x] У�� README��·��ͼ�������������ĵ�
  - [x] ��������ʵ�� / ��ʵ�� / δʵ�֡��������߽�
  - [x] ��ʣ��Զ����ת��׶� 5 Ԥ����

- [x] TODO 8: �� evaluation harness �������Ĵ���ר�� ~4d #���� #���� @Codex 2026-03-14
  - [x] �������ġ�Ӣ�ġ���Ӣ��ϵĽ��� fixture
  - [x] ���� clause split��concept normalization��semantic node materialization ָ��
  - [x] ���Ӷ�γ��ԡ�ʧ�ܲ��衢���ճɹ�·���ľ����ȡ fixture
  - [x] ���� bundle coverage / omission reason / evidence anchor completeness ָ��
  - [x] ��ר���������� `npm run test:evaluation`

- [x] TODO 7: �� compiler ����������㲢�ս��ܽ���Լ ~4d #��� #���� @Codex 2026-03-14
  - [x] �̶� bundle / summary �ر��ֶΣ�������������ժҪ
  - [x] �� `Goal / Constraint / Risk / Topic` ���ȶ������Գ�ȡ���
  - [x] ��ȷ�ɹ�·����ʧ���źš��ؼ������� bundle �е����ȼ��ͽ�������
  - [x] ����Ϊʲôѡ�� / Ϊʲôûѡ�� / Ϊʲô��ѹ������ reason contract
  - [x] ��ȷ Topic / Concept �ڵڶ�����Ϊ�ܿ� admission����������Ⱦ����

- [x] TODO 6: �� ingest ֧��һ����Ϣ���������ڵ� ~5d #��� #�ܹ� @Codex 2026-03-14
  - [x] �� `RawContextRecord -> Evidence -> SemanticSpan[] -> GraphNode[] / GraphEdge[]` ��������
  - [x] ��ȷ span �� `Intent / Goal / Constraint / Risk / Process / Step / Topic / Concept` ��ӳ��
  - [x] �� `Attempt / Episode / FailureSignal / ProcedureCandidate` ����ͳһ��ͼ·��
  - [x] ���ӻ��� concept �� semantic group �� dedupe / version / merge ����
  - [x] ��֤ provenance��governance��conflict��traceability ������
  - [x] ����/��չģ�飺
    - [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
    - [experience-learning.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/experience-learning.ts)
    - [context-engine.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/engine/context-engine.ts)
  - [x] �������ԣ�
    - [ingest-and-compiler.test.ts](/d:/C_Project/openclaw_compact_context/tests/ingest-and-compiler.test.ts)
    - [debug-smoke-snapshots.ts](/d:/C_Project/openclaw_compact_context/tests/fixtures/debug-smoke-snapshots.ts)

- [x] TODO 5: �� Attempt / Episode / Failure Signal ��һ�� ~4d #��� #ѧϰ @Codex 2026-03-14
  - [x] ���� `Attempt / Episode / FailureSignal / ProcedureCandidate` ��С schema
  - [x] ���һ�������еĶ�γ��ԡ��ɹ�·����ʧ��·���ĵ�һ��״̬��
  - [x] ��������취���С������ `FailureSignal`����Ϊ���� `NegativePattern` Ԥ��нӵ�
  - [x] ��ȡ `CriticalStep / ProcedureCandidate`�����ӽ� explain / trace / debug smoke
  - [x] ����ģ�飺
    - [experience-learning.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/experience-learning.ts)
  - [x] ���� explain / trace��
    - [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
    - [trace-view.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/trace-view.ts)
  - [x] �������ԣ�
    - [experience-learning.test.ts](/d:/C_Project/openclaw_compact_context/tests/experience-learning.test.ts)
    - [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/tests/audit-explainer.test.ts)
    - [debug-smoke-snapshots.ts](/d:/C_Project/openclaw_compact_context/tests/fixtures/debug-smoke-snapshots.ts)

- [x] TODO 4: �� Concept Normalizer ��˫�� alias ӳ�� ~4d #��� #������ @Codex 2026-03-14
  - [x] ���� canonical concept id �� alias map
  - [x] �������� / Ӣ�� / ������ͳһ concept
  - [x] ����С����ʱ������ context compression / knowledge graph / provenance / checkpoint
  - [x] Ϊ��Ӣͬ�塢��д��������岹����
  - [x] ����ģ�飺
    - [concept-normalizer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/concept-normalizer.ts)
  - [x] ���� SemanticSpan��
    - [semantic-spans.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/semantic-spans.ts)
  - [x] �� explain / trace��
    - [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
    - [trace-view.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/trace-view.ts)
  - [x] �������ԣ�
    - [concept-normalizer.test.ts](/d:/C_Project/openclaw_compact_context/tests/concept-normalizer.test.ts)
    - [semantic-spans.test.ts](/d:/C_Project/openclaw_compact_context/tests/semantic-spans.test.ts)
    - [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/tests/audit-explainer.test.ts)

- [x] TODO 3: �� SemanticSpan �� Evidence Anchor ~4d #��� #ͼ�� @Codex 2026-03-14
  - [x] ���� `SemanticSpan` ��С schema �� `EvidenceAnchor` ê���ͬ
  - [x] ��ÿ������ԭ�Ӷ��ܻص�ԭ�䡢�Ӿ���ַ�����
  - [x] �� explain / trace ��ʾ span �� evidence anchor
  - [x] Ϊ��ڵ㹲��ͬһ��ԭ��֤�ݲ��ع�
  - [x] ����ģ�飺
    - [semantic-spans.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/semantic-spans.ts)
  - [x] ���� explain / trace��
    - [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
    - [trace-view.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/trace-view.ts)
  - [x] �������ԣ�
    - [semantic-spans.test.ts](/d:/C_Project/openclaw_compact_context/tests/semantic-spans.test.ts)
    - [audit-explainer.test.ts](/d:/C_Project/openclaw_compact_context/tests/audit-explainer.test.ts)

- [x] TODO 2: �� Utterance Parser / Clause Splitter ~4d #��� #������ @Codex 2026-03-14
  - [x] ֧�����ı���о���Ӣ�� sentence split
  - [x] ֧�����Ӵʼ� clause split��������Ӣ��ϱ��
  - [x] ����ȶ��� `clauseId / offset / normalizedText`
  - [x] Ϊ���䡢���о䡢ת�۾䲹 parser fixture
  - [x] ����ģ�飺
    - [utterance-parser.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/utterance-parser.ts)
  - [x] �������ͣ�
    - [context-processing.ts](/d:/C_Project/openclaw_compact_context/src/types/context-processing.ts)
  - [x] �������ԣ�
    - [utterance-parser.test.ts](/d:/C_Project/openclaw_compact_context/tests/utterance-parser.test.ts)
  - [x] ������ route contract ���룺
    - `conversation / transcript / experience_trace` ֧�� clause split
    - `tool_result / document / system` Ĭ������ sentence-level fallback

- [x] TODO 1: ���������Ĵ���ר�����Լ�����˳�� ~3d #�ܹ� #������ @Codex 2026-03-14
  - [x] ��ȷ���ܽ���Լ + �����ȡ + ��ͼ + ���롱�ǵڶ�������
  - [x] ���� summarize �� `input routing / extraction hygiene / cache / fallback` ���̻������������ı� `graph + compiler` ����
  - [x] ��ȷ parser / extractor / normalizer / node-builder ����Сģ��߽�
  - [x] ��ȷ������ `Schema / Conflict / Trace / relation contract / memory lifecycle` �Ľӷ�
  - [x] ��ȷ�׶� 4 �ڶ�����׶� 5 Ԥ�еı߽�
  - [x] �������������� helper��
    - [context-processing.ts](/d:/C_Project/openclaw_compact_context/src/types/context-processing.ts)
    - [context-processing-contracts.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/context-processing-contracts.ts)
  - [x] ������Լ�ĵ���
    - [context-processing-contracts.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-contracts.zh-CN.md)
  - [x] �� route ע����룺
    - [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
    - [transcript-loader.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/transcript-loader.ts)
    - [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)

- [x] ����׶� 4 �ڶ�����ǿ TODO ��������˳���Ų� #�ĵ� @Codex 2026-03-14
  - [x] ���ڴ�����״����Ŀ���ߺͽ׶��ĵ������ڶ�������
  - [x] ���������Ĵ���������ȡ��̶�Ϊ��ǰ�Ƽ�·��




