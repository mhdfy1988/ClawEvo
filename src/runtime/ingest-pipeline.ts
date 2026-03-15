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
import type {
  ContextInputRouteKind,
  SemanticSpan
} from '../types/context-processing.js';
import type { IngestResult, RawContextInput, RawContextRecord, RawContextSourceType } from '../types/io.js';
import type { GraphStore } from '../infrastructure/graph-store.js';
import { applyConflictGovernance, buildNodeGovernance, normalizeNodeGovernance } from '../governance/governance.js';
import { buildEdgeGovernance, getDefaultEdgeConfidence } from '../governance/relation-contract.js';
import { resolveContextInputRoute } from '../context-processing/context-processing-contracts.js';
import { processContextRecord } from '../context-processing/context-processing-pipeline.js';
import { materializeSemanticNodeCandidate, resolveCandidateConceptMatch } from '../context-processing/semantic-node-materializer.js';
import { materializeSourceEntities } from '../context-processing/source-entity-materializer.js';

export class IngestPipeline {
  constructor(private readonly graphStore: GraphStore) {}

  async ingest(input: RawContextInput): Promise<IngestResult> {
    const candidateNodes: GraphNode[] = [];
    const candidateEdges: GraphEdge[] = [];
    const warnings: string[] = [];

    for (const record of input.records) {
      const evidenceNode = this.buildEvidenceNode(record, input.sessionId, input.workspaceId);
      candidateNodes.push(evidenceNode);
      const sourceEntityArtifacts = this.buildSourceEntityArtifacts(
        record,
        evidenceNode,
        input.sessionId,
        input.workspaceId
      );
      candidateNodes.push(...sourceEntityArtifacts.nodes);
      candidateEdges.push(...sourceEntityArtifacts.edges);

      const semanticNodes = this.buildSemanticNodes(record, evidenceNode.id, input.sessionId, input.workspaceId);

      if (semanticNodes.length > 0) {
        for (const semanticNode of semanticNodes) {
          const conflictArtifacts = await this.detectConflictArtifacts(
            semanticNode,
            candidateNodes,
            input.sessionId,
            input.workspaceId
          );
          candidateNodes.push(conflictArtifacts.node);
          candidateNodes.push(...conflictArtifacts.updatedNodes);
          candidateEdges.push(
            this.buildEdge(
              conflictArtifacts.node.id,
              evidenceNode.id,
              'supported_by',
              conflictArtifacts.node.scope,
              conflictArtifacts.node.sourceRef,
              input.sessionId,
              input.workspaceId
            )
          );
          candidateEdges.push(...conflictArtifacts.edges);
        }
      } else if (record.sourceType !== 'conversation') {
        warnings.push(`No semantic node generated for source type "${record.sourceType}".`);
      }
    }

    candidateEdges.push(...(await this.buildStructuredRelationEdges(candidateNodes, input.sessionId, input.workspaceId)));

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
    const payloadMetadata = stripContextContractMetadata(record.metadata);

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
        metadata: payloadMetadata,
        ...(structuredToolResult ? { toolResult: structuredToolResult } : {})
      },
      strength: 'soft',
      confidence: 1,
      sourceRef,
      provenance,
      governance: buildNodeGovernance({
        type: 'Evidence',
        scope: record.scope,
        strength: 'soft',
        confidence: 1,
        freshness: 'active',
        validFrom: now,
        provenance,
        sourceType: record.sourceType,
        workspaceId
      }),
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
    const confidence = this.resolveConfidence(record.sourceType);
    const freshness = 'active';
    const conflictSetKey = this.resolveConflictSetKey(record, nodeType, semanticIdentity.semanticGroupKey);
    const overridePriority = this.resolveOverridePriority(record, nodeType, strength, provenance);
    const payloadMetadata = stripContextContractMetadata(record.metadata);

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
          ...payloadMetadata,
          ...(semanticIdentity.semanticGroupKey ? { semanticGroupKey: semanticIdentity.semanticGroupKey } : {})
        },
        ...(structuredToolResult ? { toolResult: structuredToolResult } : {})
      },
      strength,
      confidence,
      sourceRef,
      provenance,
      governance: buildNodeGovernance({
        type: nodeType,
        scope: record.scope,
        strength,
        confidence,
        freshness,
        validFrom: now,
        provenance,
        sourceType: record.sourceType,
        workspaceId,
        conflict:
          conflictSetKey || typeof overridePriority === 'number'
            ? {
                conflictStatus: 'none',
                resolutionState: 'unresolved',
                ...(conflictSetKey ? { conflictSetKey } : {}),
                ...(typeof overridePriority === 'number' ? { overridePriority } : {})
              }
            : undefined
      }),
      version: semanticIdentity.version,
      freshness,
      validFrom: now,
      updatedAt: now
    };
  }

  private buildSemanticNodes(
    record: RawContextRecord,
    evidenceNodeId: string,
    sessionId: string,
    workspaceId?: string
  ): GraphNode[] {
    const primaryNode = this.buildSemanticNode(record, evidenceNodeId, sessionId, workspaceId);
    const spanNodes = this.buildSemanticSpanNodes(
      record,
      evidenceNodeId,
      sessionId,
      workspaceId,
      primaryNode?.type
    );

    return dedupeGraphNodes([...(primaryNode ? [primaryNode] : []), ...spanNodes]);
  }

  private buildSourceEntityArtifacts(
    record: RawContextRecord,
    evidenceNode: GraphNode,
    sessionId: string,
    workspaceId?: string
  ): {
    nodes: GraphNode[];
    edges: GraphEdge[];
  } {
    return materializeSourceEntities({
      record,
      route: resolveContextInputRoute(record),
      sessionId,
      workspaceId,
      evidenceNodeId: evidenceNode.id,
      evidenceNodeLabel: evidenceNode.label,
      sourceRef: evidenceNode.sourceRef,
      provenance: evidenceNode.provenance
    });
  }

  private buildSemanticSpanNodes(
    record: RawContextRecord,
    evidenceNodeId: string,
    sessionId: string,
    workspaceId: string | undefined,
    primaryNodeType?: NodeType
  ): GraphNode[] {
    const processing = processContextRecord(record, { primaryNodeType });
    const supplementalNodes: GraphNode[] = [];
    const spansById = new Map(processing.semanticSpans.map((span) => [span.id, span]));

    for (const candidate of processing.materializationPlan.materializeNodeCandidates) {
      const span = spansById.get(candidate.spanId);

      if (!span) {
        continue;
      }

      supplementalNodes.push(
        this.buildSemanticSpanNode(
          record,
          evidenceNodeId,
          sessionId,
          workspaceId,
          processing.route,
          span,
          candidate.nodeType,
          resolveCandidateConceptMatch(candidate, span)
        )
      );
    }

    return dedupeGraphNodes(supplementalNodes);
  }

  private buildSemanticSpanNode(
    record: RawContextRecord,
    evidenceNodeId: string,
    sessionId: string,
    workspaceId: string | undefined,
    route: ContextInputRouteKind,
    span: SemanticSpan,
    nodeType: NodeType,
    conceptMatch?: import('../types/context-processing.js').ConceptMatch
  ): GraphNode {
    const sourceRef = this.buildSourceRef(record);
    const kind = this.resolveKind(nodeType);
    const provenance = this.buildSemanticProvenance(record, sourceRef, evidenceNodeId);
    const baseStrength = this.resolveStrength(record.sourceType, record.metadata);
    const overridePriority = this.resolveOverridePriority(record, nodeType, baseStrength, provenance);

    return materializeSemanticNodeCandidate({
      record,
      evidenceNodeId,
      sessionId,
      workspaceId,
      route,
      span,
      nodeType,
      conceptMatch,
      baseStrength,
      baseConfidence: this.resolveConfidence(record.sourceType),
      kind,
      sourceRef,
      provenance,
      overridePriority
    });
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
    const governance = buildEdgeGovernance(type);

    return {
      id: hashId('edge', fromId, toId, type, scope),
      fromId,
      toId,
      type,
      scope,
      strength: 'soft',
      confidence: getDefaultEdgeConfidence(type),
      payload: {
        sessionId,
        workspaceId: workspaceId ?? null
      },
      sourceRef,
      governance,
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
      case 'Command':
        return 'process';
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
      case 'FailureSignal':
        return 'state';
      case 'Attempt':
      case 'Episode':
      case 'ProcedureCandidate':
      case 'Pattern':
      case 'SuccessfulProcedure':
        return 'process';
      case 'FailurePattern':
        return 'inference';
      case 'Document':
      case 'Repo':
      case 'Module':
      case 'File':
      case 'API':
      case 'Decision':
      case 'Evidence':
      case 'Tool':
      case 'Topic':
      case 'Concept':
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

  private resolveConflictSetKey(
    record: RawContextRecord,
    nodeType: NodeType,
    semanticGroupKey?: string
  ): string | undefined {
    const explicit = readMetadataString(record.metadata, 'conflictSetKey');

    if (explicit) {
      return explicit;
    }

    if (isRuleLikeType(nodeType)) {
      return semanticGroupKey;
    }

    return undefined;
  }

  private resolveOverridePriority(
    record: RawContextRecord,
    nodeType: NodeType,
    strength: KnowledgeStrength,
    provenance: ProvenanceRef
  ): number | undefined {
    const explicit = record.metadata?.overridePriority;

    if (typeof explicit === 'number' && Number.isFinite(explicit)) {
      return explicit;
    }

    if (!isRuleLikeType(nodeType)) {
      return undefined;
    }

    return strengthPriority(strength) + originPriority(provenance.originKind);
  }

  private async detectConflictArtifacts(
    node: GraphNode,
    candidateNodes: GraphNode[],
    sessionId: string,
    workspaceId?: string
  ): Promise<{
    node: GraphNode;
    updatedNodes: GraphNode[];
    edges: GraphEdge[];
  }> {
    if (!isConflictRelevantType(node.type)) {
      return {
        node,
        updatedNodes: [],
        edges: []
      };
    }

    const existingNodes = await this.graphStore.queryNodes({
      sessionId,
      limit: 200
    });
    const comparisons = dedupeGraphNodes(
      candidateNodes
        .concat(existingNodes)
        .filter((candidate) => candidate.type !== 'Evidence' && candidate.id !== node.id)
    );
    const updates = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    let currentNode = node;

    for (const originalOther of comparisons) {
      const other = updates.get(originalOther.id) ?? originalOther;
      const relation = evaluateConflictRelation(currentNode, other);

      if (!relation) {
        continue;
      }

      if (relation.kind === 'supersedes') {
        currentNode = applyConflictGovernance(currentNode, {
          conflictStatus: 'confirmed',
          resolutionState: 'selected',
          conflictSetKey: relation.conflictSetKey,
          conflictingNodeIds: mergeNodeIds(
            normalizeNodeGovernance(currentNode).conflict?.conflictingNodeIds,
            other.id
          )
        });

        updates.set(
          other.id,
          applyConflictGovernance(other, {
            conflictStatus: 'superseded',
            resolutionState: 'suppressed',
            conflictSetKey: relation.conflictSetKey,
            supersededByNodeId: currentNode.id,
            conflictingNodeIds: mergeNodeIds(normalizeNodeGovernance(other).conflict?.conflictingNodeIds, currentNode.id),
            freshness: 'superseded',
            validTo: currentNode.validFrom
          })
        );
        edges.push(
          this.buildEdge(
            currentNode.id,
            other.id,
            'supersedes',
            currentNode.scope,
            currentNode.sourceRef,
            sessionId,
            workspaceId
          )
        );
        continue;
      }

      currentNode = applyConflictGovernance(currentNode, {
        conflictStatus: 'confirmed',
        resolutionState: relation.winnerId === currentNode.id ? 'selected' : 'suppressed',
        conflictSetKey: relation.conflictSetKey,
        conflictingNodeIds: mergeNodeIds(
          normalizeNodeGovernance(currentNode).conflict?.conflictingNodeIds,
          other.id
        )
      });

      updates.set(
        other.id,
        applyConflictGovernance(other, {
          conflictStatus: 'confirmed',
          resolutionState: relation.winnerId === other.id ? 'selected' : 'suppressed',
          conflictSetKey: relation.conflictSetKey,
          conflictingNodeIds: mergeNodeIds(normalizeNodeGovernance(other).conflict?.conflictingNodeIds, currentNode.id)
        })
      );

      edges.push(
        this.buildEdge(
          currentNode.id,
          other.id,
          'conflicts_with',
          currentNode.scope,
          currentNode.sourceRef,
          sessionId,
          workspaceId
        )
      );
      edges.push(
        this.buildEdge(
          other.id,
          currentNode.id,
          'conflicts_with',
          other.scope,
          other.sourceRef,
          sessionId,
          workspaceId
        )
      );

      if (relation.kind === 'overrides') {
        const winner = relation.winnerId === currentNode.id ? currentNode : updates.get(other.id) ?? other;
        const loser = relation.winnerId === currentNode.id ? updates.get(other.id) ?? other : currentNode;

        edges.push(
          this.buildEdge(
            winner.id,
            loser.id,
            'overrides',
            winner.scope,
            winner.sourceRef,
            sessionId,
            workspaceId
          )
        );
      }
    }

    return {
      node: currentNode,
      updatedNodes: [...updates.values()],
      edges
    };
  }

  private async buildStructuredRelationEdges(
    candidateNodes: GraphNode[],
    sessionId: string,
    workspaceId?: string
  ): Promise<GraphEdge[]> {
    const existingNodes = await this.graphStore.queryNodes({
      sessionId,
      limit: 200
    });
    const semanticNodes = dedupeGraphNodes(
      candidateNodes
        .concat(existingNodes)
        .filter((node) => node.type !== 'Evidence')
    );
    const semanticCandidateNodes = dedupeGraphNodes(candidateNodes.filter((node) => node.type !== 'Evidence'));
    const nodeByRef = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    for (const node of semanticNodes) {
      nodeByRef.set(node.id, node);

      const rawSourceId = node.provenance?.rawSourceId ?? normalizeNodeGovernance(node).traceability.rawSourceId;

      if (rawSourceId && !nodeByRef.has(rawSourceId) && !isSourceEntityNodeType(node.type)) {
        nodeByRef.set(rawSourceId, node);
      }
    }

    for (const sourceNode of semanticCandidateNodes) {
      const metadata = readPayloadMetadata(sourceNode.payload);

      for (const targetNode of resolveRelationTargets(nodeByRef, readMetadataStringArray(metadata, 'requiresNodeIds'), [
        'Rule',
        'Constraint',
        'Mode'
      ])) {
        edges.push(
          this.buildEdge(
            sourceNode.id,
            targetNode.id,
            'requires',
            sourceNode.scope,
            sourceNode.sourceRef,
            sessionId,
            workspaceId
          )
        );
      }

      for (const targetNode of resolveRelationTargets(nodeByRef, readMetadataStringArray(metadata, 'nextStepNodeIds'), [
        'Step',
        'Process'
      ])) {
        edges.push(
          this.buildEdge(
            sourceNode.id,
            targetNode.id,
            'next_step',
            sourceNode.scope,
            sourceNode.sourceRef,
            sessionId,
            workspaceId
          )
        );
      }
    }

    return dedupeGraphEdges(edges);
  }
}

interface ConflictRelation {
  kind: 'supersedes' | 'conflicts' | 'overrides';
  conflictSetKey: string;
  winnerId: string;
}

function sourceTypeForLabel(sourceType: RawContextSourceType, nodeType: NodeType): RawContextSourceType {
  if (nodeType === 'Document') {
    return 'document';
  }

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
    nodeType === 'Document' ||
    nodeType === 'Repo' ||
    nodeType === 'Module' ||
    nodeType === 'File' ||
    nodeType === 'API' ||
    nodeType === 'Command' ||
    nodeType === 'Tool' ||
    nodeType === 'Topic' ||
    nodeType === 'Concept'
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

function dedupeGraphNodes(nodes: GraphNode[]): GraphNode[] {
  const seen = new Set<string>();
  const deduped: GraphNode[] = [];

  for (const node of nodes) {
    if (seen.has(node.id)) {
      continue;
    }

    seen.add(node.id);
    deduped.push(node);
  }

  return deduped;
}

function dedupeGraphEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  const deduped: GraphEdge[] = [];

  for (const edge of edges) {
    if (seen.has(edge.id)) {
      continue;
    }

    seen.add(edge.id);
    deduped.push(edge);
  }

  return deduped;
}

function resolveRelationTargets(
  nodeByRef: Map<string, GraphNode>,
  refs: string[],
  allowedTypes: NodeType[]
): GraphNode[] {
  const targets: GraphNode[] = [];

  for (const ref of refs) {
    const node = nodeByRef.get(ref);

    if (!node || !allowedTypes.includes(node.type)) {
      continue;
    }

    targets.push(node);
  }

  return dedupeGraphNodes(targets);
}

function isConflictRelevantType(nodeType: NodeType): boolean {
  return (
    nodeType === 'Rule' ||
    nodeType === 'Constraint' ||
    nodeType === 'Mode' ||
    nodeType === 'Decision' ||
    nodeType === 'State' ||
    nodeType === 'Process' ||
    nodeType === 'Step' ||
    nodeType === 'Risk'
  );
}

function isRuleLikeType(nodeType: NodeType): boolean {
  return nodeType === 'Rule' || nodeType === 'Constraint' || nodeType === 'Mode';
}

function isSourceEntityNodeType(nodeType: NodeType): boolean {
  return (
    nodeType === 'Document' ||
    nodeType === 'Repo' ||
    nodeType === 'Module' ||
    nodeType === 'File' ||
    nodeType === 'API' ||
    nodeType === 'Command'
  );
}

function evaluateConflictRelation(left: GraphNode, right: GraphNode): ConflictRelation | undefined {
  if (left.scope !== right.scope || !isConflictRelevantType(right.type)) {
    return undefined;
  }

  const leftGovernance = normalizeNodeGovernance(left);
  const rightGovernance = normalizeNodeGovernance(right);
  const conflictSetKey = leftGovernance.conflict?.conflictSetKey;

  if (!conflictSetKey || conflictSetKey !== rightGovernance.conflict?.conflictSetKey) {
    return undefined;
  }

  if (left.type === right.type && shouldSupersede(left, right)) {
    return {
      kind: 'supersedes',
      conflictSetKey,
      winnerId: left.id
    };
  }

  if (!areComparableConflictTypes(left.type, right.type)) {
    return undefined;
  }

  if (!isOppositeSemantic(left, right)) {
    return undefined;
  }

  const winnerId = chooseConflictWinner(left, right);

  if (isRuleLikeType(left.type) && isRuleLikeType(right.type) && winnerId) {
    return {
      kind: 'overrides',
      conflictSetKey,
      winnerId
    };
  }

  return {
    kind: 'conflicts',
    conflictSetKey,
    winnerId
  };
}

function shouldSupersede(left: GraphNode, right: GraphNode): boolean {
  if (left.type !== right.type) {
    return false;
  }

  if (isOppositeSemantic(left, right)) {
    return false;
  }

  if (left.updatedAt === right.updatedAt) {
    return left.id > right.id;
  }

  return left.updatedAt > right.updatedAt;
}

function areComparableConflictTypes(left: NodeType, right: NodeType): boolean {
  if (left === right) {
    return true;
  }

  return isRuleLikeType(left) && isRuleLikeType(right);
}

function isOppositeSemantic(left: GraphNode, right: GraphNode): boolean {
  const leftPolarity = inferPolarity(extractConflictText(left));
  const rightPolarity = inferPolarity(extractConflictText(right));

  return leftPolarity !== 'neutral' && rightPolarity !== 'neutral' && leftPolarity !== rightPolarity;
}

function chooseConflictWinner(left: GraphNode, right: GraphNode): string {
  const leftGovernance = normalizeNodeGovernance(left);
  const rightGovernance = normalizeNodeGovernance(right);
  const leftPriority = leftGovernance.conflict?.overridePriority ?? 0;
  const rightPriority = rightGovernance.conflict?.overridePriority ?? 0;

  if (leftPriority !== rightPriority) {
    return leftPriority > rightPriority ? left.id : right.id;
  }

  const provenanceDelta =
    originPriority(leftGovernance.knowledgeState) - originPriority(rightGovernance.knowledgeState);

  if (provenanceDelta !== 0) {
    return provenanceDelta > 0 ? left.id : right.id;
  }

  if (left.confidence !== right.confidence) {
    return left.confidence > right.confidence ? left.id : right.id;
  }

  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt > right.updatedAt ? left.id : right.id;
  }

  return left.id.localeCompare(right.id) <= 0 ? left.id : right.id;
}

function extractConflictText(node: GraphNode): string {
  const contentPreview = readPayloadString(node.payload, 'contentPreview');
  return normalizeSemanticText(contentPreview ?? node.label);
}

function inferPolarity(text: string): 'positive' | 'negative' | 'neutral' {
  if (
    /\b(must not|should not|do not|don't|never|forbid|forbidden|disable|stop|remove|avoid)\b/.test(text) ||
    /不要|不能|不可|禁止|禁用|停止|移除|避免/.test(text)
  ) {
    return 'negative';
  }

  if (
    /\b(must|should|enable|continue|keep|preserve|use|required)\b/.test(text) ||
    /必须|应该|启用|继续|保留|使用|要求/.test(text)
  ) {
    return 'positive';
  }

  return 'neutral';
}

function strengthPriority(strength: KnowledgeStrength): number {
  switch (strength) {
    case 'hard':
      return 40;
    case 'soft':
      return 20;
    case 'heuristic':
    default:
      return 10;
  }
}

function originPriority(originKind: ProvenanceRef['originKind']): number {
  switch (originKind) {
    case 'raw':
      return 3;
    case 'compressed':
      return 2;
    case 'derived':
    default:
      return 1;
  }
}

function mergeNodeIds(existing: string[] | undefined, nodeId: string): string[] {
  return Array.from(new Set([...(existing ?? []), nodeId]));
}

function isKnowledgeStrength(value: string): value is KnowledgeStrength {
  return value === 'hard' || value === 'soft' || value === 'heuristic';
}

function isNodeType(value: string): value is NodeType {
  return (
    value === 'Document' ||
    value === 'Repo' ||
    value === 'Module' ||
    value === 'File' ||
    value === 'API' ||
    value === 'Command' ||
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
    value === 'Mode' ||
    value === 'Topic' ||
    value === 'Concept' ||
    value === 'Attempt' ||
    value === 'Episode' ||
    value === 'FailureSignal' ||
    value === 'ProcedureCandidate' ||
    value === 'Pattern' ||
    value === 'FailurePattern' ||
    value === 'SuccessfulProcedure'
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

function readPayloadMetadata(payload: JsonObject | undefined): JsonObject | undefined {
  if (!payload) {
    return undefined;
  }

  const value = payload.metadata;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function readPayloadString(payload: JsonObject | undefined, key: string): string | undefined {
  if (!payload) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
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

function stripContextContractMetadata(metadata: JsonObject | undefined): JsonObject {
  if (!metadata) {
    return {};
  }

  const nextMetadata: JsonObject = { ...metadata };
  delete nextMetadata.contextRoute;
  delete nextMetadata.contextContractVersion;
  return nextMetadata;
}
