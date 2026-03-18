# �����Ĵ������ TODO
���嵥���ڰѡ������Ĵ��������������������������һ���ɶ������С��ɶ������ԡ��ɶ�����������ϵͳ��

����ĵ���
- [������תͼ](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-code-flow.zh-CN.md)
- [������Լ](/d:/C_Project/openclaw_compact_context/docs/context-processing/context-processing-contracts.zh-CN.md)
- [summarize ���](/d:/C_Project/openclaw_compact_context/docs/references/summarize-reference-for-context-processing.zh-CN.md)
- [�Դ�ѧϰ����](/d:/C_Project/openclaw_compact_context/docs/knowledge/experience-learning-plan.zh-CN.md)
- [�ܹ���·��ͼ](/d:/C_Project/openclaw_compact_context/docs/planning/hardening-master-roadmap.zh-CN.md)

## ����
- [ ] ��ǰû��ʣ����죻������һ��ת�� [other-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/other-hardening-todo.zh-CN.md) ���µ������Ĵ�������⡣

## ������
- [ ] ��ǰû�н���������

## �����
- [x] TODO 1: ������� `ContextProcessingPipeline` ����� ~5d #��� #�ܹ� @Codex 2026-03-14
  - [x] ���� [context-processing-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/context-processing-pipeline.ts)
  - [x] �̶� `record -> parse -> spans -> concepts -> classification -> summary candidates -> materialization plan` ������
  - [x] �� OpenClaw adapter��ingest��explain ͳһ���� pipeline ���
  - [x] �� pipeline �����ȶ� diagnostics���汾��Ϣ�ͻ������

- [x] TODO 2: ������������������������ ~4d #��� #������ @Codex 2026-03-15
  - [x] ���� [noise-policy.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/noise-policy.ts)
  - [x] ���� `drop / evidence_only / hint_only / materialize`
  - [x] ֧�� acknowledgement���ظ��Ӿ䡢�� topic-only �Ӿ�Ľ���
  - [x] `explain / trace` ��˵��������ý��

- [x] TODO 3: �� `Summary Planner` ��ṹ���ܽ��ѡ�� ~4d #��� #�ܽ� @Codex 2026-03-16
  - [x] ���� [summary-planner.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/summary-planner.ts)
  - [x] �� `SemanticSpan[] / node candidates` �Ȳ��� `summary candidates`
  - [x] �̶� summary slot��preferred form �� evidence-required ����

- [x] TODO 4: ��� `Semantic Classifier` �� `Node Materializer` ~5d #��� #�ܹ� @Codex 2026-03-18
  - [x] ���� [semantic-classifier.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/semantic-classifier.ts)
  - [x] ���� [semantic-node-materializer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/semantic-node-materializer.ts)
  - [x] �̶� `SemanticSpan -> NodeCandidate -> GraphNode/GraphEdge` ���νӿ�
  - [x] ���� provenance / governance / conflict / traceability ������

- [x] TODO 5: ������� `Context Processing Harness` ~5d #���� #���� @Codex 2026-03-19
  - [x] ���� [context-processing-harness.ts](/d:/C_Project/openclaw_compact_context/internal/evaluation/context-processing-harness.ts)
  - [x] ֧�ֵ��������� `parse / spans / concepts / node candidates / summary candidates`
  - [x] ���� [context-processing-harness.test.ts](/d:/C_Project/openclaw_compact_context/tests/context-processing-harness.test.ts)
  - [x] �ṩ `npm run test:context-processing`

- [x] TODO 6: �� `Attempt / Episode` �� raw-first builder ~5d #��� #ѧϰ @Codex 2026-03-20
  - [x] ��ǿ [context-processing-experience.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/context-processing-experience.ts)
  - [x] �� span/step ����ֱ������ failure / procedure / critical step hint
  - [x] Ϊ raw-first ������ʾ������ [context-processing-experience.test.ts](/d:/C_Project/openclaw_compact_context/tests/context-processing-experience.test.ts)

- [x] TODO 7: ��汾���뻺����� ~4d #��� #���� @Codex 2026-03-21
  - [x] ���� [context-processing-versions.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/context-processing-versions.ts)
  - [x] �̶� parser / lexicon / classifier / planner / materializer version
  - [x] Ϊ pipeline ���� cache key �� cache hit diagnostics

- [x] TODO 8: ���˹�У���������Ĵ������� ~4d #��� #���� @Codex 2026-03-22
  - [x] ���� [context-processing-corrections.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/context-processing-corrections.ts)
  - [x] ֧�� concept alias��noise policy��semantic classification У��
  - [x] `engine -> pipeline` ͬ���˹�У��
  - [x] У���ۼ���ͨ�� `explain` �鿴

- [x] TODO 9: ��ר��������׶α��� ~3d #���� #�ĵ� @Codex 2026-03-23
  - [x] �������Ĵ���ָ����� [evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/internal/evaluation/evaluation-harness.ts)
  - [x] ���� [observability-report.ts](/d:/C_Project/openclaw_compact_context/internal/evaluation/observability-report.ts) ��������ָ��ɼ�
  - [x] ����������ԡ��ܽ�滮��pipeline��harness ��ר���

- [x] TODO 10: ��������Ĵ�������������տ� ~2d #�ĵ� #���� @Codex 2026-03-24
  - [x] У������������ͼ��ר�� TODO
  - [x] ���뵼����� [index.ts](/d:/C_Project/openclaw_compact_context/src/index.ts)
  - [x] ȷ�� `npm test` �� `npm run test:evaluation` ͨ��

## ��ǰ����
�����Ĵ��������Ѿ��߱�һ���ɶ������е�������

`RawContextRecord -> route annotation -> utterance parse -> semantic spans -> concept normalize -> noise policy -> node candidates -> summary candidates -> materialization plan -> graph ingest / explain / evaluation`

ר�������ڣ�
- `npm run test:context-processing`
- `npm test`
- `npm run test:evaluation`




