# Ŀ¼�ܹ��ع���һ��

����ĵ����������׶� 6 `TODO 7` ��һ���Ѿ���ص�Ŀ¼�ֲ㷽����

��ش��룺
- [runtime/index.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/runtime/index.ts)
- [context-processing/index.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/context-processing/index.ts)
- [governance/index.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/governance/index.ts)
- [infrastructure/index.ts](/d:/C_Project/openclaw_compact_context/packages/runtime-core/src/infrastructure/index.ts)
- [index.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/index.ts)
- [index.ts](/d:/C_Project/openclaw_compact_context/packages/openclaw-adapter/src/index.ts)
- [layer-boundaries.test.ts](/d:/C_Project/openclaw_compact_context/tests/layer-boundaries.test.ts)

## 1. һ�仰Ŀ��
`��һ���ع�����д�����������Ȱѷֲ���ڽ��������� runtime / context-processing / governance / infrastructure / adapters ����ʽ�߽硣`

## 2. �µķֲ����
��ǰ�Ѿ�������

```text
src/
  runtime/
  context-processing/
  governance/
  infrastructure/
  adapters/
```

### 2.1 `src/runtime`
���أ�
- `ContextEngine`
- `IngestPipeline`
- `ContextCompiler`
- `AuditExplainer`
- `CheckpointManager`
- `SkillCrystallizer`
- `experience-learning`

### 2.2 `src/context-processing`
���أ�
- parser
- concept normalizer
- noise policy
- semantic spans
- semantic classifier
- node materializer
- summary planner
- context-processing pipeline

### 2.3 `src/governance`
���أ�
- governance
- relation contract
- knowledge promotion
- manual corrections
- memory lifecycle
- scope policy

### 2.4 `src/infrastructure`
���أ�
- graph store
- sqlite graph store
- context persistence
- tool-result artifact store

### 2.5 `src/adapters`
���أ�
- OpenClaw adapter �߽�
- transcript loader
- tool-result policy
- hook coordinator

## 3. Ϊʲô��һ�ֲ�ֱ�Ӵ���
��һ�ֿ���û�аѾ��ļ�ȫ�� physically move �ߣ�ԭ���ǣ�
- ��ǰ runtime �����Ѿ��ȶ�
- ֱ�Ӵ��ģ move ���ո�
- ���� import ·���ܶ࣬óȻȫ�Ļ�ѽ׶� 6 ��ɴ���������

������һ�ֵĲ����ǣ�

`�Ƚ��±߽���� + �����·������`

## 4. ��һ�ֵ��ջ�
��һ��֮����Ŀ�Ѿ��������������֣�
- ����ʱ����
- �����Ĵ�������
- ��������
- ������ʩ����
- ���������

��Ժ���ļ������ر���Ҫ��
- control plane service ��������
- ����ƽ̨����
- Web UI / console �н�
- ���� move �ļ�ʱ����·

## 5. ���ݲ���
��ǰ���ݲ����ǣ�
1. ��·����������
2. ��·����ʼ��Ϊ�Ƽ��߽�
3. root export �ݲ�ǿ��ֻ���²㼶
4. ͨ�� [layer-boundaries.test.ts](/d:/C_Project/openclaw_compact_context/tests/layer-boundaries.test.ts) ��֤�±߽�ɵ���

## 6. ��ǰ�߽�
��һ���Ѿ���ɣ�
- �²㼶Ŀ¼
- �ֲ����
- ���ݱ���
- �����ع�

��һ�ֻ�û����
- ���ģ move ���ļ�
- �����·�� import
- root export �ս�
- ��Ŀ¼��д���Բ���

## 7. �Խ׶� 6 ������
`TODO 7` ��һ����ɺ���Ŀ�Ѿ������ǡ��������������ѽ� src/core����������ʽ�����˷ֲ��ݽ�״̬��`


