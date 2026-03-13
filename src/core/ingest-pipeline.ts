import { createHash, randomUUID } from 'node:crypto';

import type {
  EdgeType,
  GraphEdge,
  GraphNode,
  JsonObject,
  KnowledgeKind,
  KnowledgeStrength,
  NodeType,
  ProvenanceRef,
  Scope,
  SourceRef
} from '../types/core.js';
import type { IngestResult, RawContextInput, RawContextRecord, RawContextSourceType } from '../types/io.js';
import type { GraphStore } from './graph-store.js';

export class IngestPipeline {
  constructor(private readonly graphStore: GraphStore) {}

  async ingest(input: RawContextInput): Promise<IngestResult> {
    const candidateNodes: GraphNode[] = [];
    const candidateEdges: GraphEdge[] = [];
    const warnings: string[] = [];

    for (const record of input.records) {
      const evidenceNode = this.buildEvidenceNode(record, input.sessionId, input.workspaceId);
      candidateNodes.push(evidenceNode);

      const semanticNode = this.buildSemanticNode(record, evidenceNode.id, input.sessionId, input.workspaceId);

      if (semanticNode) {
        candidateNodes.push(semanticNode);
        candidateEdges.push(
          this.buildEdge(
            semanticNode.id,
            evidenceNode.id,
            'supported_by',
            semanticNode.scope,
            semanticNode.sourceRef,
            input.sessionId,
            input.workspaceId
          )
        );
      } else if (record.sourceType !== 'conversation') {
        warnings.push(`No semantic node generated for source type "${record.sourceType}".`);
      }
    }

    await this.graphStore.upsertNodes(candidateNodes);
    await this.graphStore.upsertEdges(candidateEdges);

    return {
      candidateNodes,
      candidateEdges,
      persistedNodeIds: candidateNodes.map((node) => node.id),
      persistedEdgeIds: candidateEdges.map((edge) => edge.id),
      warnings
    };
  }

  private buildEvidenceNode(record: RawContextRecord, sessionId: string, workspaceId?: string): GraphNode {
    const now = record.createdAt ?? new Date().toISOString();
    const sourceRef = this.buildSourceRef(record);
    const provenance = this.buildEvidenceProvenance(record, sourceRef);
    const structuredToolResult = buildStructuredToolResultPayload(record.metadata);

    return {
      id: record.id ?? randomUUID(),
      type: 'Evidence',
      scope: record.scope,
      kind: 'fact',
      label: this.makeLabel(record.sourceType, record.content),
      payload: {
        sessionId,
        workspaceId: workspaceId ?? null,
        role: record.role ?? 'system',
        content: record.content,
        metadata: record.metadata ?? {},
        ...(structuredToolResult ? { toolResult: structuredToolResult } : {})
      },
      strength: 'soft',
      confidence: 1,
      sourceRef,
      provenance,
      version: 'v1',
      freshness: 'active',
      validFrom: now,
      updatedAt: now
    };
  }

  private buildSemanticNode(
    record: RawContextRecord,
    evidenceNodeId: string,
    sessionId: string,
    workspaceId?: string
  ): GraphNode | undefined {
    const nodeType = this.resolveNodeType(record);

    if (!nodeType) {
      return undefined;
    }

    const now = record.createdAt ?? new Date().toISOString();
    const sourceRef = this.buildSourceRef(record);
    const kind = this.resolveKind(nodeType);
    const strength = this.resolveStrength(record.sourceType, record.metadata);
    const evidenceId = record.id ?? hashId(record.sourceType, record.createdAt ?? '', record.content, sessionId);
    const semanticIdentity = this.buildSemanticIdentity(record, nodeType, sessionId, sourceRef, evidenceId);
    const provenance = this.buildSemanticProvenance(record, sourceRef, evidenceNodeId);
    const structuredToolResult = buildStructuredToolResultPayload(record.metadata);

    return {
      id: semanticIdentity.nodeId,
      type: nodeType,
      scope: record.scope,
      kind,
      label: this.makeLabel(sourceTypeForLabel(record.sourceType, nodeType), record.content),
      payload: {
        sessionId,
        workspaceId: workspaceId ?? null,
        sourceType: record.sourceType,
        contentPreview: record.content.slice(0, 400),
        metadata: {
          ...(record.metadata ?? {}),
          ...(semanticIdentity.semanticGroupKey ? { semanticGroupKey: semanticIdentity.semanticGroupKey } : {})
        },
        ...(structuredToolResult ? { toolResult: structuredToolResult } : {})
      },
      strength,
      confidence: this.resolveConfidence(record.sourceType),
      sourceRef,
      provenance,
      version: semanticIdentity.version,
      freshness: 'active',
      validFrom: now,
      updatedAt: now
    };
  }

  private buildEdge(
    fromId: string,
    toId: string,
    type: EdgeType,
    scope: Scope,
    sourceRef: SourceRef | undefined,
    sessionId: string,
    workspaceId?: string
  ): GraphEdge {
    const now = new Date().toISOString();

    return {
      id: hashId('edge', fromId, toId, type, scope),
      fromId,
      toId,
      type,
      scope,
      strength: 'soft',
      confidence: 1,
      payload: {
        sessionId,
        workspaceId: workspaceId ?? null
      },
      sourceRef,
      version: 'v1',
      validFrom: now,
      updatedAt: now
    };
  }

  private resolveNodeType(record: RawContextRecord): NodeType | undefined {
    const metadataType = record.metadata?.nodeType;

    if (typeof metadataType === 'string' && isNodeType(metadataType)) {
      return metadataType;
    }

    const inferredNodeType = inferNodeTypeFromRecord(record);

    if (inferredNodeType) {
      return inferredNodeType;
    }

    const mapping: Partial<Record<RawContextSourceType, NodeType>> = {
      rule: 'Rule',
      workflow: 'Process',
      skill: 'Skill',
      tool_output: 'State',
      system: 'Rule'
    };

    return mapping[record.sourceType];
  }

  private resolveKind(nodeType: NodeType): KnowledgeKind {
    switch (nodeType) {
      case 'Rule':
      case 'Constraint':
      case 'Mode':
        return 'norm';
      case 'Process':
      case 'Step':
      case 'Skill':
        return 'process';
      case 'Risk':
        return 'inference';
      case 'State':
      case 'Goal':
      case 'Intent':
      case 'Outcome':
        return 'state';
      case 'Decision':
      case 'Evidence':
      case 'Tool':
      default:
        return 'fact';
    }
  }

  private resolveStrength(sourceType: RawContextSourceType, metadata?: JsonObject): KnowledgeStrength {
    const metadataStrength = metadata?.strength;

    if (typeof metadataStrength === 'string' && isKnowledgeStrength(metadataStrength)) {
      return metadataStrength;
    }

    switch (sourceType) {
      case 'system':
      case 'rule':
        return 'hard';
      case 'workflow':
      case 'skill':
        return 'soft';
      default:
        return 'heuristic';
    }
  }

  private resolveConfidence(sourceType: RawContextSourceType): number {
    switch (sourceType) {
      case 'system':
      case 'rule':
        return 1;
      case 'workflow':
      case 'skill':
        return 0.9;
      case 'tool_output':
        return 0.95;
      default:
        return 0.7;
    }
  }

  private buildSourceRef(record: RawContextRecord): SourceRef {
    const defaultHash = createHash('sha256').update(record.content).digest('hex');
    const metadataSourcePath =
      readMetadataString(record.metadata, 'toolArtifactPath') ?? readMetadataString(record.metadata, 'toolArtifactSourcePath');
    const metadataHash = readMetadataString(record.metadata, 'toolArtifactContentHash');

    return {
      sourceType: record.sourceType,
      sourcePath: record.sourceRef?.sourcePath ?? metadataSourcePath,
      sourceSpan: record.sourceRef?.sourceSpan,
      contentHash: record.sourceRef?.contentHash ?? metadataHash ?? defaultHash,
      extractor: record.sourceRef?.extractor ?? (record.metadata?.toolResultCompressed === true ? 'tool-result-policy' : 'ingest-pipeline')
    };
  }

  private buildEvidenceProvenance(record: RawContextRecord, sourceRef: SourceRef): ProvenanceRef {
    const defaultProvenance = this.buildDefaultProvenance(record, sourceRef);
    const base = record.provenance ?? defaultProvenance;

    return {
      ...base,
      rawSourceId: base.rawSourceId ?? record.id,
      rawContentHash: base.rawContentHash ?? sourceRef.contentHash
    };
  }

  private buildSemanticProvenance(record: RawContextRecord, sourceRef: SourceRef, evidenceNodeId: string): ProvenanceRef {
    const base = this.buildEvidenceProvenance(record, sourceRef);
    const derivedFromNodeIds = Array.from(new Set([...(base.derivedFromNodeIds ?? []), evidenceNodeId]));

    return {
      ...base,
      producer: 'compact-context',
      derivedFromNodeIds
    };
  }

  private buildDefaultProvenance(record: RawContextRecord, sourceRef: SourceRef): ProvenanceRef {
    return {
      originKind: inferOriginKind(record),
      sourceStage: inferSourceStage(record),
      producer: 'compact-context',
      rawSourceId: record.id,
      rawContentHash: sourceRef.contentHash
    };
  }

  private buildSemanticIdentity(
    record: RawContextRecord,
    nodeType: NodeType,
    sessionId: string,
    sourceRef: SourceRef,
    fallbackEvidenceId: string
  ): {
    nodeId: string;
    version: string;
    semanticGroupKey?: string;
  } {
    const semanticGroupKey = resolveSemanticGroupKey(record, nodeType);
    const version = `v:${(sourceRef.contentHash ?? hashId(record.content)).slice(0, 12)}`;

    if (!semanticGroupKey) {
      return {
        nodeId: hashId('semantic', fallbackEvidenceId, nodeType),
        version: 'v1'
      };
    }

    return {
      nodeId: hashId('semantic', sessionId, nodeType, semanticGroupKey),
      version,
      semanticGroupKey
    };
  }

  private makeLabel(sourceType: RawContextSourceType, content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    const preview = normalized.slice(0, 96);

    return `${sourceType}:${preview || 'empty'}`;
  }
}

function sourceTypeForLabel(sourceType: RawContextSourceType, nodeType: NodeType): RawContextSourceType {
  if (nodeType === 'Rule' || nodeType === 'Constraint') {
    return 'rule';
  }

  if (nodeType === 'Process' || nodeType === 'Step') {
    return 'workflow';
  }

  if (nodeType === 'Outcome') {
    return 'workflow';
  }

  if (nodeType === 'Skill') {
    return 'skill';
  }

  return sourceType;
}

function inferOriginKind(record: RawContextRecord): ProvenanceRef['originKind'] {
  if (record.metadata?.transcriptType === 'compaction') {
    return 'compressed';
  }

  if (record.metadata?.toolResultCompressed === true) {
    return 'compressed';
  }

  return 'raw';
}

function inferSourceStage(record: RawContextRecord): ProvenanceRef['sourceStage'] {
  if (record.metadata?.toolResultCompressed === true) {
    return 'tool_result_persist';
  }

  switch (record.sourceType) {
    case 'tool_output':
      return 'tool_output_raw';
    case 'document':
    case 'rule':
      return 'document_raw';
    case 'workflow':
    case 'skill':
      return 'document_extract';
    case 'conversation':
    case 'system':
      return 'hook_message_snapshot';
    default:
      return 'legacy_unknown';
  }
}

function resolveSemanticGroupKey(record: RawContextRecord, nodeType: NodeType): string | undefined {
  const explicit = readMetadataString(record.metadata, 'semanticGroupKey');

  if (explicit) {
    return explicit;
  }

  if (!shouldUseStableSemanticKey(record, nodeType)) {
    return undefined;
  }

  const anchor = buildSemanticAnchor(record, nodeType);

  if (!anchor) {
    return undefined;
  }

  return [record.scope, record.sourceType, nodeType, anchor].join('|');
}

function shouldUseStableSemanticKey(record: RawContextRecord, nodeType: NodeType): boolean {
  if (record.metadata?.transcriptType === 'custom_message' || record.metadata?.transcriptType === 'compaction') {
    return true;
  }

  return (
    nodeType === 'Rule' ||
    nodeType === 'Constraint' ||
    nodeType === 'Process' ||
    nodeType === 'Step' ||
    nodeType === 'Risk' ||
    nodeType === 'Skill' ||
    nodeType === 'Mode' ||
    nodeType === 'Outcome' ||
    nodeType === 'Tool'
  );
}

function buildSemanticAnchor(record: RawContextRecord, nodeType: NodeType): string {
  const customHint = readMetadataString(record.metadata, 'customType');
  const toolErrorCode = readMetadataString(record.metadata, 'toolErrorCode');
  const toolKind = readMetadataString(record.metadata, 'toolResultKind');
  const toolName = readMetadataString(record.metadata, 'toolName');
  const toolSignals = readMetadataStringArray(record.metadata, 'toolKeySignals');
  const affectedPaths = readMetadataStringArray(record.metadata, 'toolAffectedPaths');
  const firstLine = normalizeSemanticText(record.content.split(/\r?\n/)[0] ?? '');
  const base = normalizeSemanticText(record.content);
  const anchor = (firstLine || base).slice(0, 72);

  return [
    nodeType.toLowerCase(),
    customHint,
    toolKind,
    toolName,
    toolErrorCode,
    toolSignals[0],
    affectedPaths[0],
    anchor
  ]
    .filter(Boolean)
    .join('|');
}

function normalizeSemanticText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function isKnowledgeStrength(value: string): value is KnowledgeStrength {
  return value === 'hard' || value === 'soft' || value === 'heuristic';
}

function isNodeType(value: string): value is NodeType {
  return (
    value === 'Rule' ||
    value === 'Constraint' ||
    value === 'Process' ||
    value === 'Step' ||
    value === 'Risk' ||
    value === 'Skill' ||
    value === 'State' ||
    value === 'Decision' ||
    value === 'Outcome' ||
    value === 'Evidence' ||
    value === 'Goal' ||
    value === 'Intent' ||
    value === 'Tool' ||
    value === 'Mode'
  );
}

function inferNodeTypeFromRecord(record: RawContextRecord): NodeType | undefined {
  const text = buildInferenceText(record);
  const customType = readMetadataString(record.metadata, 'customType')?.toLowerCase() ?? '';
  const sourceType = record.sourceType;

  if (sourceType === 'tool_output' && isFailedToolRecord(record, text)) {
    return 'Risk';
  }

  if (looksLikeStep(text, customType, sourceType)) {
    return 'Step';
  }

  if (looksLikeProcess(text, customType, sourceType)) {
    return 'Process';
  }

  if (looksLikeMode(text, customType, sourceType)) {
    return 'Mode';
  }

  if (looksLikeOutcome(text, customType, sourceType, record.metadata)) {
    return 'Outcome';
  }

  if (looksLikeTool(text, customType, sourceType, record.metadata)) {
    return 'Tool';
  }

  if (looksLikeConstraint(text, customType, sourceType)) {
    return 'Constraint';
  }

  if (looksLikeRisk(text, customType, sourceType)) {
    return 'Risk';
  }

  if (sourceType === 'rule' || sourceType === 'system') {
    if (/\brule\b|\bpolicy\b|\bguideline\b|\bconvention\b|规则|规范|准则/.test(text)) {
      return 'Rule';
    }
  }

  return undefined;
}

function buildInferenceText(record: RawContextRecord): string {
  const parts: string[] = [record.content];
  const metadata = record.metadata ?? {};

  for (const key of [
    'customType',
    'toolStatus',
    'toolResultKind',
    'toolSummary',
    'toolErrorCode',
    'toolCompressionReason',
    'toolArtifactPath',
    'toolArtifactSourcePath',
    'toolArtifactSourceUrl'
  ]) {
    const value = metadata[key];

    if (typeof value === 'string' && value.trim()) {
      parts.push(value);
    }
  }

  for (const key of ['toolKeySignals', 'toolAffectedPaths', 'toolDroppedSections']) {
    const values = readMetadataStringArray(metadata, key);

    if (values.length > 0) {
      parts.push(...values);
    }
  }

  return parts.join('\n').toLowerCase();
}

function looksLikeConstraint(text: string, customType: string, sourceType: RawContextSourceType): boolean {
  if (/constraint|guardrail|restriction|约束|限制|禁止/.test(customType)) {
    return true;
  }

  if (sourceType === 'rule' || sourceType === 'system' || sourceType === 'conversation') {
    return (
      /\b(must|must not|should not|cannot|can't|never|forbid|forbidden|required|requirement|constraint)\b/.test(text) ||
      /必须|不能|不可|不要|禁止|约束|要求|严禁/.test(text)
    );
  }

  return false;
}

function looksLikeProcess(text: string, customType: string, sourceType: RawContextSourceType): boolean {
  if (/process|workflow|pipeline|roadmap|流程|工作流|阶段/.test(customType)) {
    return true;
  }

  if (sourceType === 'workflow') {
    return /\bprocess\b|\bworkflow\b|\bpipeline\b|\bphase\b|\bstage\b|\broadmap\b|流程|工作流|阶段|方案/.test(text);
  }

  return /\bprocess\b|\bworkflow\b|\bpipeline\b|\broadmap\b|流程|工作流|阶段计划/.test(text);
}

function looksLikeStep(text: string, customType: string, sourceType: RawContextSourceType): boolean {
  if (/step|task|milestone|步骤|下一步/.test(customType)) {
    return true;
  }

  if (
    /(?:^|\n)\s*(?:step\s*\d+|next step|\d+[\.\)]|第[一二三四五六七八九十\d]+步|下一步|先.+再.+)/m.test(text)
  ) {
    return true;
  }

  return sourceType === 'workflow' && /(?:^|\n)\s*(?:- |\* )/.test(text) && /步骤|step|todo|task/.test(text);
}

function looksLikeRisk(text: string, customType: string, sourceType: RawContextSourceType): boolean {
  if (/risk|warning|blocker|incident|风险|阻塞|警告|异常/.test(customType)) {
    return true;
  }

  if (sourceType === 'tool_output') {
    return /\b(error|failed|failure|warning|exception|timeout|conflict|blocked)\b|错误|失败|异常|冲突|阻塞|超时/.test(text);
  }

  return /\b(risk|warning|blocker|blocked|conflict|failure|issue)\b|风险|警告|阻塞|失败|冲突|问题/.test(text);
}

function looksLikeMode(text: string, customType: string, sourceType: RawContextSourceType): boolean {
  if (/mode|strict_mode|debug_mode|模式/.test(customType)) {
    return true;
  }

  if (sourceType === 'system' || sourceType === 'rule' || sourceType === 'workflow' || sourceType === 'conversation') {
    return /\b(mode|operating mode|debug mode|strict mode|compatibility mode)\b/.test(text) || /模式|调试模式|严格模式|兼容模式/.test(text);
  }

  return false;
}

function looksLikeOutcome(
  text: string,
  customType: string,
  sourceType: RawContextSourceType,
  metadata: JsonObject | undefined
): boolean {
  if (/outcome|result|产出|结果/.test(customType)) {
    return true;
  }

  if (sourceType === 'tool_output') {
    const status = readMetadataString(metadata, 'toolStatus')?.toLowerCase();

    if (status === 'success' || status === 'empty') {
      return /\b(completed|succeeded|generated|returned|created|applied|found)\b/.test(text) || /完成|成功|生成|返回|创建|应用|找到/.test(text);
    }
  }

  return (
    (sourceType === 'workflow' || sourceType === 'system' || sourceType === 'conversation') &&
    (/\b(expected outcome|outcome|result should be|success means|target result)\b/.test(text) ||
      /预期结果|结果应该|产出|目标结果|成功意味着/.test(text))
  );
}

function looksLikeTool(
  text: string,
  customType: string,
  sourceType: RawContextSourceType,
  metadata: JsonObject | undefined
): boolean {
  if (/tool|tooling|工具/.test(customType)) {
    return true;
  }

  if (sourceType === 'tool_output' && readMetadataString(metadata, 'toolName')) {
    return false;
  }

  return (
    (sourceType === 'system' || sourceType === 'conversation' || sourceType === 'workflow') &&
    (/\b(tool choice|preferred tool|use tool|tooling)\b/.test(text) || /工具选择|推荐工具|使用工具|工具链/.test(text))
  );
}

function isFailedToolRecord(record: RawContextRecord, text: string): boolean {
  const status = readMetadataString(record.metadata, 'toolStatus')?.toLowerCase();

  if (status === 'failure' || status === 'partial') {
    return true;
  }

  const exitCode = record.metadata?.toolExitCode;

  if (typeof exitCode === 'number' && exitCode !== 0) {
    return true;
  }

  return /\b(error|failed|failure|exception|timeout|warning)\b|错误|失败|异常|超时|警告/.test(text);
}

function readMetadataString(metadata: JsonObject | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readMetadataStringArray(metadata: JsonObject | undefined, key: string): string[] {
  const value = metadata?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function buildStructuredToolResultPayload(metadata: JsonObject | undefined): JsonObject | undefined {
  if (metadata?.toolResultCompressed !== true) {
    return undefined;
  }

  const keySignals = readMetadataStringArray(metadata, 'toolKeySignals');
  const affectedPaths = readMetadataStringArray(metadata, 'toolAffectedPaths');
  const droppedSections = readMetadataStringArray(metadata, 'toolDroppedSections');
  const toolName = readMetadataString(metadata, 'toolName');
  const toolStatus = readMetadataString(metadata, 'toolStatus');
  const toolResultKind = readMetadataString(metadata, 'toolResultKind');
  const toolSummary = readMetadataString(metadata, 'toolSummary');
  const toolPolicyId = readMetadataString(metadata, 'toolPolicyId');
  const toolCompressionReason = readMetadataString(metadata, 'toolCompressionReason');
  const toolArtifactPath = readMetadataString(metadata, 'toolArtifactPath');
  const toolArtifactSourcePath = readMetadataString(metadata, 'toolArtifactSourcePath');
  const toolArtifactSourceUrl = readMetadataString(metadata, 'toolArtifactSourceUrl');
  const toolArtifactContentHash = readMetadataString(metadata, 'toolArtifactContentHash');
  const toolErrorCode = readMetadataString(metadata, 'toolErrorCode');
  const toolExitCode = metadata?.toolExitCode;
  const toolByteLength = metadata?.toolByteLength;
  const toolLineCount = metadata?.toolLineCount;
  const toolItemCount = metadata?.toolItemCount;

  return {
    compressed: true,
    ...(toolName ? { toolName } : {}),
    ...(toolStatus ? { status: toolStatus } : {}),
    ...(toolResultKind ? { resultKind: toolResultKind } : {}),
    ...(toolSummary ? { summary: toolSummary } : {}),
    ...(keySignals.length > 0 ? { keySignals } : {}),
    ...(affectedPaths.length > 0 ? { affectedPaths } : {}),
    truncation: {
      ...(toolPolicyId ? { policyId: toolPolicyId } : {}),
      ...(toolCompressionReason ? { reason: toolCompressionReason } : {}),
      ...(droppedSections.length > 0 ? { droppedSections } : {})
    },
    artifact: {
      ...(toolArtifactPath ? { path: toolArtifactPath } : {}),
      ...(toolArtifactSourcePath ? { sourcePath: toolArtifactSourcePath } : {}),
      ...(toolArtifactSourceUrl ? { sourceUrl: toolArtifactSourceUrl } : {}),
      ...(toolArtifactContentHash ? { contentHash: toolArtifactContentHash } : {})
    },
    error: {
      ...(toolErrorCode ? { code: toolErrorCode } : {}),
      ...(typeof toolExitCode === 'number' ? { exitCode: toolExitCode } : {})
    },
    metrics: {
      ...(typeof toolByteLength === 'number' ? { byteLength: toolByteLength } : {}),
      ...(typeof toolLineCount === 'number' ? { lineCount: toolLineCount } : {}),
      ...(typeof toolItemCount === 'number' ? { itemCount: toolItemCount } : {})
    }
  };
}
