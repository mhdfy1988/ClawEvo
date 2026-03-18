# �׶� 2 �����̵㣺����ɡ����ڶ���������߽�

## 1. �ĵ�Ŀ��

����ĵ������ش��������⣺

1. �׶� 2 �����Ƿ��Ѿ�������ʽ�տ�
2. ��Щ�����Ѿ���׶� 2 ��������Щ����Ӧת��׶� 3

����������漸���ĵ�һ�𿴣�
- �׶� 2 ִ�мƻ�: [stage-2-execution-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-execution-plan.zh-CN.md)
- �׶� 2 ���ڱ���: [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-exit-report.zh-CN.md)
- �׶� 2 ��β TODO: [stage-2-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-todo.zh-CN.md)
- ����·��ͼ: [context-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/context-roadmap.zh-CN.md)

## 2. ��ǰ����

���ڵ�ǰ���롢���Ժ��ĵ�״̬���׶� 2 ���Զ���Ϊ��

`�׶� 2 �������β���������������㣬��Ŀ����׶� 3 ׼���׶Ρ�`

�������˵��
- `2.1` ����ɲ��ȶ����
- `2.2` ����ɲ��γ� artifact sidecar �ջ�
- `2.3` ����ɲ��� compressed tool result �Ľṹ�ֶν��� ingest
- `2.4` ����ɣ�compiler / explain / gateway debug �������γɱջ�
- �׶� 2 ��ʣ�����Ѿ������ǡ�������β�������ǽ׶� 3 ����ǿ����

## 3. �׶� 2 ԭĿ��ؿ�

�׶� 2 ����Ŀ���ǣ�

`��ϵͳ��ֻ��ѹ�������ģ����ܴ�Դͷ�������������͡��ṹ������ tool result�����ȶ��ؽ��͡�Ϊʲô�����Ϊʲôѹ����Ϊʲô��ѡ�С���`

��Ӧ�����ֵ����ǣ�
1. `2.1` ��ȷ `tool_result_persist` �������
2. `2.2` ���� `tool_result_persist`���ѳ���������� transcript �����
3. `2.3` ���� ingest �ṹ�������� compressed tool result ���ṹ������
4. `2.4` ���� compiler / explain / gateway debug �Ĳþ���ɽ�����

## 4. ��ǰ��ɶ�����

## 4.1 ���۱�

- `2.1 tool result policy`: �����
- `2.2 tool_result_persist ����`: �����
- `2.3 ingest �ṹ��������`: �����
- `2.4 compiler / explain / debug ����`: �����

## 4.2 ����ζ��ʲô

�׶� 2 ����·���Ѿ���ͨ��

`tool result / transcript -> provenance ��� -> ingest ��ͼ -> runtime bundle compile -> explain / debug / artifact �ز�`

��ǰϵͳ�Ѿ�����ֻ�ǡ���ѹ��һ�� prompt�������Ǿ߱��˸�����������������
- Դͷ����
- �ṹ������
- provenance ��׷��
- bundle ѡ��ɽ���
- ����ԭ�Ŀɻز�

## 5. �ѽ�������

## 5.1 `2.1` ����ɣ�tool result policy ����ȷ

�Ѿ��߱���
- `tool result` �ķ����ѹ��ԭ��
- �ر����ֶκ�ͬ
- ��׼ѹ������ṹ
- provenance / truncation / artifact Լ��

��Ӧ�ĵ���ʵ�֣�
- [tool-result-policy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/architecture/tool-result-policy.zh-CN.md)
- [tool-result-policy.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/tool-result-policy.ts)

## 5.2 `2.2` ����ɣ�artifact sidecar ���γɻز�ջ�

�Ѿ��߱���
- `tool_result_persist` hook ��������
- ���� tool result ��д�� transcript ǰ��ѹ��
- ԭʼ���Ŀ����䵽 content-addressed artifact sidecar
- explain / metadata �ᱣ���ȶ��ز�·��
- �ṩ��С��������������`pruneStaleArtifacts()`

��Ӧʵ�֣�
- [hook-coordinator.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/hook-coordinator.ts)
- [tool-result-artifact-store.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/tool-result-artifact-store.ts)
- [tool-result-artifact-store.test.ts](/d:/C_Project/openclaw_compact_context/tests/tool-result-artifact-store.test.ts)

## 5.3 `2.3` ����ɣ�compressed tool result �ѱ��ṹ������

�Ѿ��߱���
- `keySignals / affectedPaths / error / truncation` ���� ingest �����ı�
- evidence / semantic node �ᱣ��ṹ�� `toolResult` �غ�
- sourceRef ������ʹ�� artifact path / content hash
- ��ʹ����������ժҪ��Ҳ������ metadata �ƶ� `Risk`

��Ӧʵ�֣�
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- [ingest-and-compiler.test.ts](/d:/C_Project/openclaw_compact_context/tests/ingest-and-compiler.test.ts)

## 5.4 `2.4` ����ɣ�compiler / explain / gateway debug ���γɱջ�

�Ѿ��߱���
- ����Ԥ���
- `raw-first / compressed-fallback`
- bundle diagnostics
- included / skipped explain
- `inspect_bundle`
- `query_nodes + explain + queryMatch`
- token-overlap ƥ��͸��ȵ�����
- tool result �ü�ԭ�� explain

��Ӧʵ�֣�
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)
- [gateway-debug-usage.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/operations/gateway-debug-usage.zh-CN.md)

## 6. ��С���ս��

�׶� 2 ��ǰ��С�ɶ��⸴���Ľ���ǣ�

- ѹ����������֤:
  - oversized failure tool result �� `8602` �ַ�ѹ�� `3029`
  - ѹ����Լ `35.2%`
- artifact sidecar ����֤:
  - ���� content-addressed ����
  - ���� prune helper
  - ���� sidecar ����
- explain ��������֤:
  - provenance
  - selection
  - `policyId / reason / droppedSections`
  - `artifact / sourcePath / sourceUrl / rawSourceId`
- ingest �ṹ�����ѿ���֤:
  - metadata ��ֱ���ƶ� `Risk / Evidence / Tool / State`
- �ع���߿���֤:
  - `tsc --noEmit` ͨ��
  - `tsc -p tsconfig.json` ͨ��
  - ȫ�� `36` �����ͨ��

��ϸ˵������
- [stage-2-exit-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-2-exit-report.zh-CN.md)

## 7. �׶� 2 ���ڶ���

����·��ͼ���׶� 2 �ĳ�����Ҫ���ļ��£�

1. `tool result` �����Ƿ��ܿ�
2. ingest �����Ƿ���������
3. bundle �����Ƿ������½�
4. provenance ��ѹ�������Ƿ���һ�����

��ǰ���ս����
- `tool result �����ܿ�`: ������
- `ingest ��������`: ������
- `bundle �����½�`: ������
- `provenance + ѹ���ɽ���`: ������

���ۣ�

`�׶� 2 �ĳ��������Ѿ����㣬������ʽ�տڡ�`

## 8. ��Щ����ת��׶� 3

������Щ������Ϊ�׶� 2 �������Ӧת��׶� 3��
- �������ġ�Ϊʲôĳ����ʷû�б��������
- ��ǿ�Ĺ�ϵ��֪����������
- ��ϵͳ�Ľ׶�ָ���Զ��ɼ�
- ��ϸ���ȵĳ��ڼ�����Ժ�ͼ����ǿ

## 9. ��һ������

��һ������������ڽ׶� 2 �ĵ���׷����β����ǣ�

1. ����׶� 2 �ĵ���Ϊ�ȶ�����
2. �½��׶� 3 TODO / ִ�мƻ�
3. �ѡ���ʷ������͡�������ǿ��ָ���Զ�����ת�ɽ׶� 3 ������

## 10. һ�仰����

`�׶� 2 �Ѿ���ɴӡ���ѹ�������������������͡��ɻز顱�����������Խ���׶� 3��`




