import type { GraphNode, JsonObject } from '../types/core.js';
import type {
  ContextInputRouteKind,
  EvidenceAnchor,
  SemanticExtractionNodeTarget,
  SemanticSpan
} from '../types/context-processing.js';
import type { RawContextRecord, RawContextSourceType } from '../types/io.js';
import { normalizeConcepts } from './concept-normalizer.js';
import { getSemanticExtractionContract, resolveContextInputRoute } from './context-processing-contracts.js';
import { normalizeUtteranceText, parseContextRecordUtterance } from './utterance-parser.js';

export interface SemanticSpanExtractionResult {
  route: ContextInputRouteKind;
  evidenceAnchor: EvidenceAnchor;
  semanticSpans: SemanticSpan[];
}

export function buildSemanticSpansFromRecord(record: RawContextRecord): SemanticSpanExtractionResult {
  const route = resolveContextInputRoute(record);
  const parseResult = parseContextRecordUtterance(record);
  const contract = getSemanticExtractionContract(route);
  const evidenceAnchor = buildEvidenceAnchorFromRecord(record);

  return {
    route,
    evidenceAnchor,
    semanticSpans: parseResult.clauses.map((clause) => {
      const conceptNormalization = normalizeConcepts(clause.text);

      return {
        id: buildSemanticSpanId(evidenceAnchor, clause.id),
        route,
        text: clause.text,
        normalizedText: clause.normalizedText,
        sentenceId: clause.sentenceId,
        clauseId: clause.id,
        startOffset: clause.startOffset,
        endOffset: clause.endOffset,
        anchor: {
          ...evidenceAnchor,
          startOffset: clause.startOffset,
          endOffset: clause.endOffset,
          sentenceId: clause.sentenceId,
          clauseId: clause.id
        },
        candidateNodeTypes: inferCandidateNodeTypes(
          clause.text,
          route,
          contract.supportedNodeTypes,
          conceptNormalization.matches.length > 0
        ),
        conceptMatches: conceptNormalization.matches
      };
    })
  };
}

export function buildSemanticSpansFromGraphNode(
  node: GraphNode,
  sourceNode: GraphNode = node
): SemanticSpanExtractionResult {
  return buildSemanticSpansFromRecord(buildRawContextRecordFromNode(node, sourceNode));
}

function buildRawContextRecordFromNode(targetNode: GraphNode, sourceNode: GraphNode): RawContextRecord {
  const payload = asRecord(sourceNode.payload);
  const metadata = asJsonObject(payload?.metadata);
  const sessionId = readPayloadString(payload, 'sessionId') ?? readPayloadString(asRecord(targetNode.payload), 'sessionId');
  const role = readPayloadRole(payload);
  const sourceType = resolveSourceType(sourceNode, payload);

  return {
    id: sourceNode.provenance?.rawSourceId ?? sourceNode.id,
    ...(sessionId ? { sessionId } : {}),
    scope: sourceNode.scope,
    sourceType,
    ...(role ? { role } : {}),
    content: readSourceText(sourceNode, payload),
    ...(metadata ? { metadata } : {}),
    ...(sourceNode.sourceRef ? { sourceRef: sourceNode.sourceRef } : {}),
    ...(sourceNode.provenance ? { provenance: sourceNode.provenance } : {})
  };
}

function buildEvidenceAnchorFromRecord(record: RawContextRecord): EvidenceAnchor {
  return {
    ...(record.provenance?.rawSourceId ?? record.id ? { recordId: record.provenance?.rawSourceId ?? record.id } : {}),
    ...(record.sourceRef?.sourcePath ? { sourcePath: record.sourceRef.sourcePath } : {}),
    ...(record.sourceRef?.sourceSpan ? { sourceSpan: record.sourceRef.sourceSpan } : {})
  };
}

function buildSemanticSpanId(anchor: EvidenceAnchor, clauseId: string): string {
  const base = anchor.recordId ?? anchor.sourcePath ?? 'semantic-span';
  return `${base}:${clauseId}`;
}

function inferCandidateNodeTypes(
  text: string,
  route: ContextInputRouteKind,
  supportedTypes: readonly SemanticExtractionNodeTarget[],
  hasConceptMatch: boolean
): SemanticExtractionNodeTarget[] {
  const normalized = normalizeUtteranceText(text);
  const candidates = new Set<SemanticExtractionNodeTarget>();
  const add = (type: SemanticExtractionNodeTarget): void => {
    if (supportedTypes.includes(type)) {
      candidates.add(type);
    }
  };

  if (route === 'conversation') {
    add('Intent');
  } else if (route === 'tool_result') {
    add('State');
  } else if (route === 'transcript' || route === 'experience_trace') {
    add('Decision');
  } else {
    add('Topic');
  }

  if (isQuestionLike(normalized)) {
    add('Intent');
    add('Topic');
  }

  if (/\b(need|goal|want|trying to|aim to)\b|需要|目标|想要|打算|准备/u.test(normalized)) {
    add('Goal');
  }

  if (/\b(must|must not|should|should not|cannot|can not|can't|never|required|requirement)\b|必须|不能|不可以|不要|禁止|要求/u.test(normalized)) {
    add('Constraint');
    add('Rule');
  }

  if (/\b(step\b|next step|first|second|before|after|then)\b|第.{0,3}步|下一步|先|再|之后|然后/u.test(normalized)) {
    add('Step');
    add('Process');
  }

  if (/\b(process|workflow|pipeline|phase|stage)\b|流程|工作流|阶段|管线/u.test(normalized)) {
    add('Process');
  }

  if (/\b(risk|warning|blocked|failure|failed|error|exception|timeout|incident)\b|风险|警告|失败|错误|异常|超时|阻塞/u.test(normalized)) {
    add('Risk');
    add('State');
  }

  if (/\b(result|outcome|success|succeeded|completed)\b|结果|产出|成功|完成/u.test(normalized)) {
    add('Outcome');
  }

  if (/\b(tool|cli|command|api|script|artifact)\b|工具|命令|脚本|接口|产物/u.test(normalized)) {
    add('Tool');
  }

  if (/\b(mode|strict mode|debug mode|compatibility)\b|模式|调试模式|严格模式|兼容模式/u.test(normalized)) {
    add('Mode');
  }

  if (/\b(skill|pattern|playbook|procedure)\b|技能|模式|经验|流程卡片/u.test(normalized)) {
    add('Skill');
  }

  if (
    /\b(provenance|checkpoint|knowledge graph|context compression|prompt|bundle|trace)\b|知识图谱|上下文压缩|来源追踪|检查点|提示词|上下文包/u.test(
      normalized
    )
  ) {
    add('Topic');
    add('Concept');
  }

  if (hasConceptMatch) {
    add('Topic');
    add('Concept');
  }

  if (candidates.size === 0) {
    for (const fallbackType of defaultFallbackTypes(route, supportedTypes)) {
      candidates.add(fallbackType);
    }
  }

  return [...candidates];
}

function defaultFallbackTypes(
  route: ContextInputRouteKind,
  supportedTypes: readonly SemanticExtractionNodeTarget[]
): SemanticExtractionNodeTarget[] {
  const preferredByRoute: Record<ContextInputRouteKind, SemanticExtractionNodeTarget[]> = {
    conversation: ['Intent', 'Topic'],
    tool_result: ['State', 'Risk'],
    transcript: ['Decision', 'Topic'],
    document: ['Rule', 'Topic'],
    experience_trace: ['Decision', 'State'],
    system: ['Rule', 'Constraint']
  };

  return preferredByRoute[route].filter((type) => supportedTypes.includes(type));
}

function resolveSourceType(sourceNode: GraphNode, payload: Record<string, unknown> | undefined): RawContextSourceType {
  const payloadSourceType = readPayloadString(payload, 'sourceType');

  if (isRawContextSourceType(payloadSourceType)) {
    return payloadSourceType;
  }

  const sourceStage = sourceNode.provenance?.sourceStage;

  if (
    sourceStage === 'tool_output_raw' ||
    sourceStage === 'tool_result_persist' ||
    sourceStage === 'tool_output_summary'
  ) {
    return 'tool_output';
  }

  if (sourceStage === 'document_raw' || sourceStage === 'document_extract') {
    return 'document';
  }

  switch (sourceNode.type) {
    case 'Rule':
    case 'Constraint':
    case 'Mode':
      return 'rule';
    case 'Process':
    case 'Step':
      return 'workflow';
    case 'Skill':
      return 'skill';
    case 'Tool':
    case 'State':
    case 'Risk':
    case 'Outcome':
      return 'tool_output';
    case 'Evidence':
      return sourceNode.sourceRef?.sourceType === 'document' ? 'document' : 'conversation';
    default:
      return 'conversation';
  }
}

function readSourceText(sourceNode: GraphNode, payload: Record<string, unknown> | undefined): string {
  const content = readPayloadString(payload, 'content');

  if (content) {
    return content;
  }

  const contentPreview = readPayloadString(payload, 'contentPreview');

  if (contentPreview) {
    return contentPreview;
  }

  return sourceNode.label;
}

function readPayloadRole(
  payload: Record<string, unknown> | undefined
): RawContextRecord['role'] | undefined {
  const role = readPayloadString(payload, 'role');
  return role === 'user' || role === 'assistant' || role === 'system' || role === 'tool' ? role : undefined;
}

function readPayloadString(payload: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = payload?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asJsonObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? ({ ...(value as JsonObject) } as JsonObject) : undefined;
}

function isQuestionLike(text: string): boolean {
  return /\?$|怎么|如何|为何|为什么|哪一步|哪个|什么|what|why|how|which/u.test(text);
}

function isRawContextSourceType(value: string | undefined): value is RawContextSourceType {
  return (
    value === 'conversation' ||
    value === 'document' ||
    value === 'rule' ||
    value === 'workflow' ||
    value === 'skill' ||
    value === 'tool_output' ||
    value === 'system'
  );
}
