# �׶� 4 �ڶ���״̬

## ��ǰ����
��ǰ��׼ȷ���ж��ǣ�

`�׶� 4 �ڶ����������տ�������ɣ��׶� 5 Ԥ��Ҳ����ɵ�һ��������`

����ζ�ţ�
- �����Ĵ�������Ѿ�����ͣ������Ʋ㣬���ǽ����������
- `Utterance Parser / SemanticSpan / Evidence Anchor / Concept Normalizer / ��ڵ���ͼ` �Ѿ���ͨ
- compiler��explain��evaluation harness �ѿ�ʼ�ȶ���������������
- `Attempt / Episode / FailureSignal / ProcedureCandidate` �ѽ�����͡�������������

## �ڶ�������ɵķ�Χ

### 1. �����Ĵ�����Լ���������
- �ѹ̶� `summary contract / semantic extraction contract / bundle contract`
- �Ѱ� route ע��ӵ� `conversation / tool_result / transcript / document / experience_trace / system`
- `inspect_bundle` ���ѷ��ؽṹ�� `summaryContract / bundleContract`

��Ӧ���룺
- [context-processing-contracts.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/context-processing-contracts.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

### 2. ��Ȼ���Խ�����֤��ê��
- ��֧����Ӣ�� sentence split �� mixed-language clause split
- ������ `SemanticSpan / EvidenceAnchor`
- explain / trace ���ܻص�ԭ�䡢�Ӿ���ַ�ƫ��

��Ӧ���룺
- [utterance-parser.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/utterance-parser.ts)
- [semantic-spans.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/semantic-spans.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [trace-view.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/trace-view.ts)

### 3. ˫������һ���ڵ���ͼ
- �ѽ�����С bilingual alias map
- �Ѱ� `context compression / knowledge graph / provenance / checkpoint` ��һ�� canonical concept
- һ����Ϣ���ڿ����ȶ������� `Goal / Constraint / Risk / Topic / Concept` �ڵ�

��Ӧ���룺
- [concept-normalizer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/concept-normalizer.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)

### 4. �Դ�ѧϰ��һ��
- ���� `Attempt / Episode / FailureSignal / ProcedureCandidate`
- checkpoint / skill persistence �����Щ���� materialize ��ͼ
- compiler �ѿ�ʼ�� failure signal / procedure candidate ���� risk �� current process ������

��Ӧ���룺
- [experience-learning.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/experience-learning.ts)
- [context-engine.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/engine/context-engine.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)

### 5. Compiler summary / reason contract
- bundle summary �ѹ̶��ر��ֶ�
- diagnostics �Ѳ� `Summary contract / Bundle contract / Learning signals`
- selection reason ���ܽ��ͣ�
  - Ϊʲôѡ��
  - Ϊʲôûѡ��
  - Ϊʲô�� topic hint
  - Ϊʲô���� learning signal

��Ӧ���룺
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

### 6. �����Ĵ���ר������
- evaluation harness ����չ����
  - semantic node coverage
  - concept normalization coverage
  - clause split coverage
  - evidence anchor completeness
  - experience learning coverage
- �Ѳ� representative fixture �� bilingual fixture

��Ӧ���룺
- [evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/internal/evaluation/evaluation-harness.ts)
- [evaluation-harness-fixtures.ts](/d:/C_Project/openclaw_compact_context/tests/fixtures/evaluation-harness-fixtures.ts)
- [evaluation-harness.test.ts](/d:/C_Project/openclaw_compact_context/tests/evaluation-harness.test.ts)

## ��ǰ��֤���
- `npm test` ͨ��
- ȫ�����ԣ�`87` ��ͨ��
- `npm run test:evaluation` ͨ��
- evaluation harness��`3` ��ͨ��

## ��Ȼ����ı߽�
- `Topic / Concept` ��Ȼ���ܿ� hint���������� bundle
- ���� relation recall ��û�н�������
- `FailurePattern / SuccessfulProcedure` ��û�н��볤��֪ʶ��������
- workspace / global ��������临����δ������ʵ��

## �Ƽ���һ��
��ǰ����Ȼ����һ���ǣ�

1. ���ֽ׶� 4 �ڶ��ֽ���ȶ�
2. ����׶� 5 ��ʽʵ�� TODO
3. �Ѷ��� relation recall������֪ʶ�����������������˹�У����ڰ���ʵ��˳�����

��Ӧ��ڣ�
- [stage-5-prework.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-prework.zh-CN.md)
- [stage-5-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-status.zh-CN.md)
- [stage-5-pre-research-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-pre-research-report.zh-CN.md)
- [stage-5-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-todo.zh-CN.md)

## һ�仰����
`�׶� 4 �ڶ����Ѿ��ѡ���Ȼ���������� -> ����ԭ�� -> ͼ�׽ڵ�/�� -> compiler / explain / evaluation�����������������С�����֤��������`





