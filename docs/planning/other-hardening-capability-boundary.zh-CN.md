# ����ר��������߽�

����ĵ������տڡ������Ĵ���֮�������ר��ᡱ��������ǰ�Ѿ����������Щ��Ȼֻ���ܿذ汾����Щ��û�н����������Լ���һ�׶�Ӧ����γнӡ�

����ĵ���
- [other-hardening-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/other-hardening-todo.zh-CN.md)
- [hardening-master-roadmap.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/hardening-master-roadmap.zh-CN.md)
- [stage-5-second-pass-status.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-status.zh-CN.md)
- [stage-5-second-pass-report.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/stages/stage-5-second-pass-report.zh-CN.md)

## ��ǰ����

��ǰ������ר��ᡱ�Ѿ���ɵڶ����տڣ���Ŀ�Ѿ��߱���

- ������ĳ��ڼ�����֪ʶ��������
- �ܿض��� recall ��·���þ�
- `session / workspace / global` �ĸ� scope ���ñ߽�
- ����Դ֪ʶͼ���������С����
- �˹�У������ compiler / explain / gateway / evaluation
- ͳһ�� observability snapshot / trend / report

��������Ȼ���ǡ�������չ��ͨ��ƽ̨������ǰ��̬��׼ȷ��˵�ǣ�

`�ѽ����������ɽ��͡�������������������Ա��ְ��������ܿر߽硣`

## ��ʵ��

### 1. ���ڼ�����֪ʶ��������

�Ѿ��߱���
- `Attempt -> Episode -> Pattern -> Skill / Rule / Process` ��ͳһ�����ж�
- `downgrade / retire / decay / rollback` ����������
- `failure_experience / local_procedure / stable_skill / hard_constraint_candidate` ����
- explain ��ֱ����ʾ��Ⱦ�������������

��Ӧ���룺
- [knowledge-promotion.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/knowledge-promotion.ts)
- [memory-lifecycle.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/memory-lifecycle.ts)
- [experience-learning.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/experience-learning.ts)

### 2. ���� recall ��·���þ�

�Ѿ��߱���
- �ܿ� 2-hop ����·����չ
- `path budget / pruning / ranking`
- explain ���·��ѡ����ü�ԭ��
- evaluation fixture ����·�������Ԥ����Ư��

��Ӧ���룺
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)
- [audit-explainer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/audit-explainer.ts)
- [evaluation-harness.ts](/d:/C_Project/openclaw_compact_context/internal/evaluation/evaluation-harness.ts)

### 3. �� scope �����������������

�Ѿ��߱���
- `session / workspace / global` �������� fallback ����
- ��ʧ��ģʽ�����ڵ� scope
- `workspace` �ɹ����̸����� `global` �ܿ� fallback
- explain ����ʾ scope fallback �� admission ����

��Ӧ���룺
- [scope-policy.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/scope-policy.ts)
- [knowledge-promotion.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/knowledge-promotion.ts)
- [context-compiler.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/context-compiler.ts)

### 4. ����Դ֪ʶͼ������

�Ѿ��߱���С��ͼ������
- �ĵ���ʵ�壺`Document`
- �ֿ�ṹ��ʵ�壺`Repo / Module / File / API / Command`
- �ṹ�������ͨ�� source-entity materialization ����ͼ��

��Ӧ���룺
- [source-entity-materializer.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/source-entity-materializer.ts)
- [ingest-pipeline.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/ingest-pipeline.ts)
- [evaluation-harness-fixtures.ts](/d:/C_Project/openclaw_compact_context/tests/fixtures/evaluation-harness-fixtures.ts)

### 5. �˹�У����ɹ۲���

�Ѿ��߱���
- alias / promotion / suppression / rule fix �ĳ־û�У��
- correction rollback �� trace
- gateway �� authoring �� list ����
- observability snapshot / trend / report
- second-pass ����������Ⱦ�ʡ������ʡ��������桢����Դ������

��Ӧ���룺
- [manual-corrections.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/manual-corrections.ts)
- [observability-report.ts](/d:/C_Project/openclaw_compact_context/internal/evaluation/observability-report.ts)
- [context-engine-adapter.ts](/d:/C_Project/openclaw_compact_context/src/openclaw/context-engine-adapter.ts)

## ��ʵ��

### 1. ���� recall �����ܿز���

��ǰ����ͨ��ͼ�������棬Ҳ����ѧϰ��·����������

�����У�
- ������ relation path
- ��ʽԤ��
- ��ȷ explain

��û�У�
- �����������
- �Զ�ѧϰ·��ģ��
- ��·���ϵ�����Ӧ�þ�

### 2. `global` д��������ƫ����

��ǰ�Ѿ����ܿؽ����� `global`������û�У�
- �����������
- ��ϸ���ȵ��˻�Эͬ����
- �����Ŷ�/��֯�����������

### 3. �˹�У���ѽ�����������������������Ʒ����

��ǰ�й�����ں� gateway ������ڣ�����û�У�
- ���ӻ��༭��
- �����������������
- ���Ѻõ���ʷ diff ��ָ�����

### 4. observability �ѿ�����׶α��棬�������� dashboard

��ǰ���У�
- snapshot
- trend
- report formatter

����û�У�
- ����չʾ����
- ʱ��Ա����
- �˹���������������������ͼ

## δʵ��

### 1. ͨ��ƽ̨�������

��û���������ɣ�
- ��Ʒ���˹�����ƽ̨
- ����ʽ `global` ֪ʶд��
- �������еĹ۲��̨

### 2. �����ɵ�֪ʶ�������

��ǰ����Դ���뻹����С��������δ������
- �������ĵ� ingestion workflow
- ����ֿ�����ɨ����ͼƽ̨
- CSV / JSON / ����Ķ���������

### 3. �������ѧϰ�� recall

��ǰ recall ���ɹ���Ԥ��� relation policy ��������δ������
- �Զ�·������
- ������ʷ����Ķ�̬·������
- �����ŵ�̽��ʽ�ٻ�

## �����н���

��һ�׶θ��ʺϽӵģ������ٿ�һ�֡�����ɢ���ܡ�������Χ��ƽ̨�����Ʒ��������

1. ƽ̨���˹�����
   - correction authoring UI
   - ������ع����
   - �ŶӼ�֪ʶά������

2. ������ĸ� scope ����
   - `global` ׼������
   - �� workspace �������
   - ����֪ʶ��ͻ����

3. dashboard �� observability
   - �������
   - �����ع�澯
   - recall / memory / promotion ������ͼ

4. �������Ķ���Դ��ͼƽ̨
   - �ĵ���������
   - �ֿ�ṹɨ��
   - �ṹ�������׼������

## һ�仰�ܽ�

`����ר����Ѿ��ѳ��ڼ������������ recall���� scope ���á�����Դ��ͼ���˹�У���� observability �յ��ˡ������ҿ��������״̬����һ�׶θô���������ת��ƽ̨�����Ʒ����`





