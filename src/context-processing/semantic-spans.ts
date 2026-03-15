import type { GraphNode, JsonObject } from '../types/core.js';
import type {
  ContextInputRouteKind,
  EvidenceAnchor,
  SemanticSpan,
  UtteranceParseResult
} from '../types/context-processing.js';
import type { RawContextRecord, RawContextSourceType } from '../types/io.js';
import { normalizeConcepts } from './concept-normalizer.js';
import { getSemanticExtractionContract, resolveContextInputRoute } from './context-processing-contracts.js';
import { classifySemanticSpan } from './semantic-classifier.js';
import { parseContextRecordUtterance } from './utterance-parser.js';

export interface SemanticSpanExtractionResult {
  route: ContextInputRouteKind;
  parseResult: UtteranceParseResult;
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
    parseResult,
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
        candidateNodeTypes: classifySemanticSpan(
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
  const sessionId =
    readPayloadString(payload, 'sessionId') ?? readPayloadString(asRecord(targetNode.payload), 'sessionId');
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
