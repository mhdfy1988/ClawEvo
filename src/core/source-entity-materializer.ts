import { createHash } from 'node:crypto';

import type {
  EdgeType,
  GraphEdge,
  GraphNode,
  JsonObject,
  NodeType,
  ProvenanceRef,
  Scope,
  SourceRef
} from '../types/core.js';
import type { ContextInputRouteKind } from '../types/context-processing.js';
import type { RawContextRecord } from '../types/io.js';
import { buildNodeGovernance } from './governance.js';
import { buildEdgeGovernance, getDefaultEdgeConfidence } from './relation-contract.js';

type SourceEntityNodeType = Extract<NodeType, 'Document' | 'Repo' | 'Module' | 'File' | 'API' | 'Command'>;
type SourceEntityEdgeType = Extract<EdgeType, 'documents' | 'contains' | 'defines'>;

interface SourceEntitySpec {
  kind: SourceEntityNodeType;
  key: string;
  label: string;
  parentKey?: string;
  relationToParent?: SourceEntityEdgeType;
  sourcePath?: string;
  sourceSpan?: string;
  payload?: JsonObject;
  explicit?: boolean;
}

interface MaterializeSourceEntitiesInput {
  record: RawContextRecord;
  route: ContextInputRouteKind;
  sessionId: string;
  workspaceId?: string;
  evidenceNodeId: string;
  evidenceNodeLabel: string;
  sourceRef?: SourceRef;
  provenance?: ProvenanceRef;
}

interface MaterializeSourceEntitiesResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const SOURCE_ENTITY_KINDS = new Set<SourceEntityNodeType>([
  'Document',
  'Repo',
  'Module',
  'File',
  'API',
  'Command'
]);

const SOURCE_ENTITY_RELATIONS = new Set<SourceEntityEdgeType>(['documents', 'contains', 'defines']);

export function materializeSourceEntities(
  input: MaterializeSourceEntitiesInput
): MaterializeSourceEntitiesResult {
  const specs = dedupeSourceEntitySpecs(buildSourceEntitySpecs(input));

  if (specs.length === 0) {
    return {
      nodes: [],
      edges: []
    };
  }

  const nodeByKey = new Map<string, GraphNode>();
  const nodes: GraphNode[] = [];
  const now = input.record.createdAt ?? new Date().toISOString();
  const derivedProvenance = buildSourceEntityProvenance(input.provenance, input.evidenceNodeId);
  const admissionKind = resolveSourceAdmissionKind(input.record.metadata);

  for (const spec of specs) {
    const nodeId = hashId('source-entity', input.record.scope, spec.kind, spec.key);
    const sourceRef = buildEntitySourceRef(spec, input.sourceRef, input.record.sourceType);
    const explicit = spec.explicit === true;
    const confidence = explicit ? 0.97 : 0.93;

    const node: GraphNode = {
      id: nodeId,
      type: spec.kind,
      scope: input.record.scope,
      kind: resolveSourceEntityKnowledgeKind(spec.kind),
      label: spec.label,
      payload: {
        sessionId: input.sessionId,
        workspaceId: input.workspaceId ?? null,
        sourceType: input.record.sourceType,
        entityKey: spec.key,
        entityKind: spec.kind,
        admissionKind,
        recordId: input.record.id ?? null,
        metadata: {
          ...(spec.payload ?? {}),
          explicit,
          evidenceNodeId: input.evidenceNodeId,
          evidenceNodeLabel: input.evidenceNodeLabel
        }
      },
      strength: 'soft',
      confidence,
      sourceRef,
      provenance: derivedProvenance,
      governance: buildNodeGovernance({
        type: spec.kind,
        scope: input.record.scope,
        strength: 'soft',
        confidence,
        freshness: 'active',
        validFrom: now,
        provenance: derivedProvenance,
        sourceType: input.record.sourceType,
        workspaceId: input.workspaceId
      }),
      version: `v:${hashId('source-entity-version', spec.kind, spec.key, spec.label).slice(0, 12)}`,
      freshness: 'active',
      validFrom: now,
      updatedAt: now
    };

    nodeByKey.set(spec.key, node);
    nodes.push(node);
  }

  const edges: GraphEdge[] = [];
  const documentNodes = nodes.filter((node) => node.type === 'Document');

  for (const spec of specs) {
    if (!spec.parentKey || !spec.relationToParent) {
      continue;
    }

    const parentNode = nodeByKey.get(spec.parentKey);
    const childNode = nodeByKey.get(spec.key);

    if (!parentNode || !childNode) {
      continue;
    }

    edges.push(
      buildSourceEntityEdge(
        parentNode.id,
        childNode.id,
        spec.relationToParent,
        input.record.scope,
        input.sessionId,
        input.workspaceId,
        parentNode.sourceRef ?? childNode.sourceRef,
        now
      )
    );
  }

  for (const documentNode of documentNodes) {
    edges.push(
      buildSourceEntityEdge(
        documentNode.id,
        input.evidenceNodeId,
        'documents',
        input.record.scope,
        input.sessionId,
        input.workspaceId,
        documentNode.sourceRef,
        now
      )
    );

    for (const sourceNode of nodes) {
      if (sourceNode.id === documentNode.id) {
        continue;
      }

      edges.push(
        buildSourceEntityEdge(
          documentNode.id,
          sourceNode.id,
          'documents',
          input.record.scope,
          input.sessionId,
          input.workspaceId,
          documentNode.sourceRef ?? sourceNode.sourceRef,
          now
        )
      );
    }
  }

  return {
    nodes: dedupeNodes(nodes),
    edges: dedupeEdges(edges)
  };
}

function buildSourceEntitySpecs(input: MaterializeSourceEntitiesInput): SourceEntitySpec[] {
  const implicitSpecs = buildImplicitSourceEntitySpecs(input);
  const explicitSpecs = readExplicitSourceEntitySpecs(input.record.metadata);
  return implicitSpecs.concat(explicitSpecs);
}

function buildImplicitSourceEntitySpecs(input: MaterializeSourceEntitiesInput): SourceEntitySpec[] {
  const metadata = input.record.metadata;
  const documentSpecs: SourceEntitySpec[] = [];
  const repoSpecs: SourceEntitySpec[] = [];
  const repoKey = readPreferredKey(metadata, 'repoKey', 'repoPath', 'repoName');
  const moduleKey = readPreferredKey(metadata, 'moduleKey', 'modulePath', 'moduleName');
  const fileKey = readPreferredKey(metadata, 'fileKey', 'filePath');
  const apiKey = readPreferredKey(metadata, 'apiKey', 'apiName');
  const commandValue = readMetadataString(metadata, 'commandName') ?? readMetadataString(metadata, 'command');
  const commandKey = readPreferredKey(metadata, 'commandKey') ?? normalizeSourceEntityKey(commandValue);

  const documentKind = readMetadataString(metadata, 'documentKind');
  const structuredInputKind = readMetadataString(metadata, 'structuredInputKind');
  const structuredInputFormat = readMetadataString(metadata, 'structuredInputFormat');
  const curatedBy = readMetadataString(metadata, 'curatedBy');
  const curatedReason = readMetadataString(metadata, 'curatedReason');
  const hasDocumentSignal =
    input.route === 'document' ||
    Boolean(documentKind) ||
    Boolean(readMetadataString(metadata, 'documentTitle')) ||
    Boolean(readMetadataString(metadata, 'documentKey')) ||
    Boolean(readMetadataString(metadata, 'documentPath')) ||
    Boolean(structuredInputKind) ||
    Boolean(structuredInputFormat) ||
    Boolean(curatedBy) ||
    Boolean(curatedReason);
  const documentTitle = hasDocumentSignal
    ? readMetadataString(metadata, 'documentTitle') ??
      inferDocumentTitle(input.record.content) ??
      input.sourceRef?.sourcePath ??
      input.record.id
    : undefined;
  const documentKey =
    readPreferredKey(metadata, 'documentKey') ??
    (hasDocumentSignal ? normalizeSourceEntityKey(input.sourceRef?.sourcePath ?? documentTitle) : undefined);

  if (
    hasDocumentSignal ||
    documentKind ||
    documentTitle ||
    structuredInputKind ||
    structuredInputFormat ||
    curatedBy ||
    curatedReason
  ) {
    documentSpecs.push({
      kind: 'Document',
      key: documentKey ?? hashId('document', input.record.sourceType, input.record.content),
      label: `document:${documentTitle ?? 'source document'}`,
      sourcePath: input.sourceRef?.sourcePath ?? readMetadataString(metadata, 'documentPath'),
      payload: {
        ...(documentKind ? { documentKind } : {}),
        ...(documentTitle ? { title: documentTitle } : {}),
        ...(structuredInputKind ? { structuredInputKind } : {}),
        ...(structuredInputFormat ? { structuredInputFormat } : {}),
        ...(curatedBy ? { curatedBy } : {}),
        ...(curatedReason ? { curatedReason } : {})
      }
    });
  }

  if (repoKey) {
    repoSpecs.push({
      kind: 'Repo',
      key: repoKey,
      label: `repo:${readMetadataString(metadata, 'repoName') ?? repoKey}`,
      sourcePath: readMetadataString(metadata, 'repoPath'),
      payload: {
        ...(readMetadataString(metadata, 'repoName') ? { repoName: readMetadataString(metadata, 'repoName') } : {}),
        ...(readMetadataString(metadata, 'repoPath') ? { repoPath: readMetadataString(metadata, 'repoPath') } : {})
      }
    });
  }

  if (moduleKey) {
    repoSpecs.push({
      kind: 'Module',
      key: moduleKey,
      label: `module:${readMetadataString(metadata, 'moduleName') ?? readMetadataString(metadata, 'modulePath') ?? moduleKey}`,
      parentKey: repoKey,
      relationToParent: repoKey ? 'contains' : undefined,
      sourcePath: readMetadataString(metadata, 'modulePath'),
      payload: {
        ...(readMetadataString(metadata, 'moduleName') ? { moduleName: readMetadataString(metadata, 'moduleName') } : {}),
        ...(readMetadataString(metadata, 'modulePath') ? { modulePath: readMetadataString(metadata, 'modulePath') } : {})
      }
    });
  }

  if (fileKey) {
    repoSpecs.push({
      kind: 'File',
      key: fileKey,
      label: `file:${readMetadataString(metadata, 'filePath') ?? fileKey}`,
      parentKey: moduleKey ?? repoKey,
      relationToParent: moduleKey || repoKey ? 'contains' : undefined,
      sourcePath: readMetadataString(metadata, 'filePath'),
      payload: {
        ...(readMetadataString(metadata, 'filePath') ? { filePath: readMetadataString(metadata, 'filePath') } : {})
      }
    });
  }

  if (apiKey) {
    repoSpecs.push({
      kind: 'API',
      key: apiKey,
      label: `api:${readMetadataString(metadata, 'apiName') ?? apiKey}`,
      parentKey: fileKey ?? moduleKey,
      relationToParent: fileKey || moduleKey ? 'defines' : undefined,
      sourcePath: readMetadataString(metadata, 'filePath') ?? readMetadataString(metadata, 'modulePath'),
      sourceSpan: readMetadataString(metadata, 'apiName'),
      payload: {
        ...(readMetadataString(metadata, 'apiName') ? { apiName: readMetadataString(metadata, 'apiName') } : {}),
        ...(readMetadataString(metadata, 'apiSignature') ? { apiSignature: readMetadataString(metadata, 'apiSignature') } : {})
      }
    });
  }

  if (commandKey) {
    repoSpecs.push({
      kind: 'Command',
      key: commandKey,
      label: `command:${commandValue ?? commandKey}`,
      parentKey: fileKey ?? repoKey,
      relationToParent: fileKey || repoKey ? 'defines' : undefined,
      sourcePath: readMetadataString(metadata, 'filePath'),
      sourceSpan: commandValue,
      payload: {
        ...(commandValue ? { command: commandValue } : {}),
        ...(structuredInputKind ? { structuredInputKind } : {}),
        ...(structuredInputFormat ? { structuredInputFormat } : {})
      }
    });
  }

  return documentSpecs.concat(repoSpecs);
}

function readExplicitSourceEntitySpecs(metadata: JsonObject | undefined): SourceEntitySpec[] {
  const value = metadata?.graphSourceEntities;

  if (!Array.isArray(value)) {
    return [];
  }

  const specs: SourceEntitySpec[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const kind = isSourceEntityNodeType(record.kind) ? record.kind : undefined;
    const key = typeof record.key === 'string' && record.key.trim() ? normalizeSourceEntityKey(record.key) : undefined;
    const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : undefined;
    const parentKey =
      typeof record.parentKey === 'string' && record.parentKey.trim()
        ? normalizeSourceEntityKey(record.parentKey)
        : undefined;
    const relationToParent = isSourceEntityEdgeType(record.relation) ? record.relation : undefined;
    const payload =
      record.payload && typeof record.payload === 'object' && !Array.isArray(record.payload)
        ? (record.payload as JsonObject)
        : undefined;

    if (!kind || !key || !label) {
      continue;
    }

    specs.push({
      kind,
      key,
      label,
      ...(parentKey ? { parentKey } : {}),
      ...(relationToParent ? { relationToParent } : {}),
      ...(typeof record.sourcePath === 'string' ? { sourcePath: record.sourcePath } : {}),
      ...(typeof record.sourceSpan === 'string' ? { sourceSpan: record.sourceSpan } : {}),
      ...(payload ? { payload } : {}),
      explicit: true
    });
  }

  return specs;
}

function buildSourceEntityProvenance(
  provenance: ProvenanceRef | undefined,
  evidenceNodeId: string
): ProvenanceRef | undefined {
  if (!provenance) {
    return undefined;
  }

  return {
    ...provenance,
    producer: 'compact-context:source-entity-materializer',
    derivedFromNodeIds: dedupeStrings([...(provenance.derivedFromNodeIds ?? []), evidenceNodeId])
  };
}

function buildEntitySourceRef(
  spec: SourceEntitySpec,
  recordSourceRef: SourceRef | undefined,
  sourceType: RawContextRecord['sourceType']
): SourceRef | undefined {
  if (!recordSourceRef && !spec.sourcePath && !spec.sourceSpan) {
    return undefined;
  }

  return {
    sourceType,
    sourcePath: spec.sourcePath ?? recordSourceRef?.sourcePath,
    sourceSpan: spec.sourceSpan ?? recordSourceRef?.sourceSpan,
    contentHash: recordSourceRef?.contentHash,
    extractor: 'source-entity-materializer'
  };
}

function buildSourceEntityEdge(
  fromId: string,
  toId: string,
  type: SourceEntityEdgeType,
  scope: Scope,
  sessionId: string,
  workspaceId: string | undefined,
  sourceRef: SourceRef | undefined,
  now: string
): GraphEdge {
  return {
    id: hashId('source-entity-edge', fromId, toId, type, scope),
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
    governance: buildEdgeGovernance(type),
    version: 'v1',
    validFrom: now,
    updatedAt: now
  };
}

function resolveSourceEntityKnowledgeKind(kind: SourceEntityNodeType): GraphNode['kind'] {
  return kind === 'Command' ? 'process' : 'fact';
}

function resolveSourceAdmissionKind(metadata: JsonObject | undefined): 'manual_curation' | 'structured_input' | 'source_capture' {
  if (readMetadataString(metadata, 'curatedBy') || metadata?.manualKnowledge === true) {
    return 'manual_curation';
  }

  if (readMetadataString(metadata, 'structuredInputKind') || readMetadataString(metadata, 'structuredInputFormat')) {
    return 'structured_input';
  }

  return 'source_capture';
}

function readPreferredKey(metadata: JsonObject | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readMetadataString(metadata, key);

    if (value) {
      return normalizeSourceEntityKey(value);
    }
  }

  return undefined;
}

function readMetadataString(metadata: JsonObject | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function inferDocumentTitle(content: string): string | undefined {
  const firstLine = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return undefined;
  }

  return firstLine.replace(/^#+\s*/u, '').slice(0, 96);
}

function normalizeSourceEntityKey(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase();

  return normalized || undefined;
}

function dedupeSourceEntitySpecs(specs: SourceEntitySpec[]): SourceEntitySpec[] {
  const byKey = new Map<string, SourceEntitySpec>();

  for (const spec of specs) {
    const identity = `${spec.kind}:${spec.key}`;
    const existing = byKey.get(identity);

    if (!existing) {
      byKey.set(identity, spec);
      continue;
    }

    byKey.set(identity, {
      ...existing,
      ...spec,
      payload: {
        ...(existing.payload ?? {}),
        ...(spec.payload ?? {})
      },
      explicit: existing.explicit || spec.explicit
    });
  }

  return [...byKey.values()];
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const byId = new Map<string, GraphNode>();

  for (const node of nodes) {
    byId.set(node.id, node);
  }

  return [...byId.values()];
}

function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const byId = new Map<string, GraphEdge>();

  for (const edge of edges) {
    byId.set(edge.id, edge);
  }

  return [...byId.values()];
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function isSourceEntityNodeType(value: unknown): value is SourceEntityNodeType {
  return typeof value === 'string' && SOURCE_ENTITY_KINDS.has(value as SourceEntityNodeType);
}

function isSourceEntityEdgeType(value: unknown): value is SourceEntityEdgeType {
  return typeof value === 'string' && SOURCE_ENTITY_RELATIONS.has(value as SourceEntityEdgeType);
}

function hashId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
