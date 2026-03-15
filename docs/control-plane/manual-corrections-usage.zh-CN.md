# 人工校正使用说明
这份文档用于说明当前项目里人工校正的最小入口、支持的校正类型，以及它们会如何回流到 `context processing / compiler / explain / evaluation` 主链。

## 当前入口
- gateway:
  - `compact-context.apply_corrections`
  - `compact-context.list_corrections`
- engine:
  - `ContextEngine.applyManualCorrections(...)`
  - `ContextEngine.listManualCorrections(...)`

## 校正记录结构
每条人工校正都使用统一结构：

```ts
{
  id: string,
  targetKind:
    | 'concept_alias'
    | 'promotion_decision'
    | 'noise_policy'
    | 'semantic_classification'
    | 'node_suppression'
    | 'label_override',
  targetId: string,
  action: 'apply' | 'rollback',
  author: string,
  reason: string,
  createdAt: string,
  metadata?: Record<string, string | number | boolean | null>
}
```

## 支持的校正类型
### 1. `concept_alias`
用途：
- 给 canonical concept 增加或回滚 alias

典型场景：
- 把 `kg graph` 收敛到 `knowledge_graph`
- 把项目内部缩写补进已有 concept

### 2. `promotion_decision`
用途：
- 覆盖自动知识晋升结果

可用决策：
- `promote`
- `hold`
- `retire`

典型场景：
- 某个 `SuccessfulProcedure` 还不够稳定，不允许继续晋升
- 某个 `FailurePattern` 已经确认稳定，可以提升到更高治理级别

### 3. `noise_policy`
用途：
- 覆盖 span 的噪音处置方式

可用 disposition：
- `drop`
- `evidence_only`
- `hint_only`
- `materialize`

典型场景：
- 把一类 acknowledgement 强制压成 `drop`
- 把弱主题短句改成 `hint_only`

### 4. `semantic_classification`
用途：
- 手动包含或排除某个 span 的语义分类

可用 operation：
- `include`
- `exclude`

典型场景：
- 强制把某个 workflow clause 认成 `Step`
- 把误判成 `Goal` 的 span 排除掉

### 5. `node_suppression`
用途：
- 在 runtime bundle 选择前手动压制某个节点

典型场景：
- 某条 `Rule` 已经确认会误导当前 bundle，但暂时不想删图节点
- 某个 `Topic` 或 `SuccessfulProcedure` 需要先退出运行时召回

说明：
- 节点仍然保留在图里
- `explain` 会直接说明该节点被人工压制
- rollback 后会重新参与编译

### 6. `label_override`
用途：
- 覆盖节点或 span 候选的显示标签

典型场景：
- 修正一条 `Rule / Constraint / Step` 的措辞
- 在不改原始 evidence 的前提下，给运行时和 explain 更清晰的标签

说明：
- 原始 evidence 不会被改写
- override 会影响 `compiler / explain`
- 如果 target 命中 context-processing span，也会影响后续 node candidate 生成

## rollback 规则
- 所有人工校正都支持 `action: 'rollback'`
- rollback 不是删除历史，而是生成一条新的反向校正记录
- 同一 target 上按 `createdAt -> id` 正向重放，得到最终生效状态

## 回流位置
人工校正当前会回流到这些环节：
- `concept normalizer`
- `context processing pipeline`
- `runtime compiler`
- `audit explain`
- `evaluation harness`

这意味着：
- alias 校正会影响 concept 归一
- noise / semantic 校正会影响 span -> node candidate
- suppression / label override 会影响 bundle 选择与 explain
- evaluation fixture 也可以带着 correction 一起运行

## 最小示例
### 压制一条规则
```json
{
  "corrections": [
    {
      "id": "suppress-rule-1",
      "targetKind": "node_suppression",
      "targetId": "rule:preserve-provenance",
      "action": "apply",
      "author": "tester",
      "reason": "temporarily suppress this rule from runtime selection",
      "createdAt": "2026-03-20T09:01:00.000Z",
      "metadata": {
        "suppressed": true
      }
    }
  ]
}
```

### 覆盖一条规则标签
```json
{
  "corrections": [
    {
      "id": "label-rule-1",
      "targetKind": "label_override",
      "targetId": "rule:preserve-provenance",
      "action": "apply",
      "author": "tester",
      "reason": "clarify the rule wording",
      "createdAt": "2026-03-20T09:02:00.000Z",
      "metadata": {
        "label": "Rule: preserve provenance before transcript persistence."
      }
    }
  ]
}
```

### 回滚压制
```json
{
  "corrections": [
    {
      "id": "suppress-rule-rollback-1",
      "targetKind": "node_suppression",
      "targetId": "rule:preserve-provenance",
      "action": "rollback",
      "author": "tester",
      "reason": "allow the rule back into runtime selection",
      "createdAt": "2026-03-20T09:03:00.000Z",
      "metadata": {
        "suppressed": true
      }
    }
  ]
}
```

## 当前边界
当前人工校正已经可以覆盖：
- alias
- promotion
- noise
- semantic classification
- node suppression
- label override

还没有做深的包括：
- 图级 rule rewrite
- 边级 correction
- 人工 authoring UI
- correction 趋势化观测面板
