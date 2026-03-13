import type { GraphEdge, GraphNode } from '../types/core.js';
import type { GraphEdgeFilter, GraphNodeFilter } from '../types/io.js';
import { normalizeNodeGovernance } from './governance.js';
import { normalizeEdgeGovernance } from './relation-contract.js';
import { matchesTextFilter } from './text-search.js';

export interface GraphStore {
  upsertNodes(nodes: GraphNode[]): Promise<void>;
  upsertEdges(edges: GraphEdge[]): Promise<void>;
  getNode(id: string): Promise<GraphNode | undefined>;
  getNodesByIds(ids: string[]): Promise<GraphNode[]>;
  queryNodes(filter?: GraphNodeFilter): Promise<GraphNode[]>;
  queryEdges(filter?: GraphEdgeFilter): Promise<GraphEdge[]>;
  getEdgesForNode(nodeId: string): Promise<GraphEdge[]>;
  getEdgesForNodes(nodeIds: string[]): Promise<GraphEdge[]>;
  close(): Promise<void>;
}

export class InMemoryGraphStore implements GraphStore {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges = new Map<string, GraphEdge>();

  async upsertNodes(nodes: GraphNode[]): Promise<void> {
    for (const node of nodes) {
      this.nodes.set(node.id, {
        ...node,
        governance: normalizeNodeGovernance(node)
      });
    }
  }

  async upsertEdges(edges: GraphEdge[]): Promise<void> {
    for (const edge of edges) {
      this.edges.set(edge.id, {
        ...edge,
        governance: normalizeEdgeGovernance(edge)
      });
    }
  }

  async getNode(id: string): Promise<GraphNode | undefined> {
    return this.nodes.get(id);
  }

  async getNodesByIds(ids: string[]): Promise<GraphNode[]> {
    return ids
      .map((id) => this.nodes.get(id))
      .filter((node): node is GraphNode => Boolean(node));
  }

  async queryNodes(filter: GraphNodeFilter = {}): Promise<GraphNode[]> {
    const items = [...this.nodes.values()]
      .filter((node) => matchesNodeFilter(node, filter))
      .sort((left, right) => compareGraphNodeOrder(left, right));

    return typeof filter.limit === 'number' ? items.slice(0, filter.limit) : items;
  }

  async queryEdges(filter: GraphEdgeFilter = {}): Promise<GraphEdge[]> {
    const items = [...this.edges.values()]
      .filter((edge) => matchesEdgeFilter(edge, filter))
      .sort((left, right) => compareGraphEdgeOrder(left, right));

    return typeof filter.limit === 'number' ? items.slice(0, filter.limit) : items;
  }

  async getEdgesForNode(nodeId: string): Promise<GraphEdge[]> {
    return [...this.edges.values()].filter((edge) => edge.fromId === nodeId || edge.toId === nodeId);
  }

  async getEdgesForNodes(nodeIds: string[]): Promise<GraphEdge[]> {
    if (nodeIds.length === 0) {
      return [];
    }

    const nodeIdSet = new Set(nodeIds);
    return [...this.edges.values()].filter((edge) => nodeIdSet.has(edge.fromId) || nodeIdSet.has(edge.toId));
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}

function matchesNodeFilter(node: GraphNode, filter: GraphNodeFilter): boolean {
  if (filter.types && !filter.types.includes(node.type)) {
    return false;
  }

  if (filter.scopes && !filter.scopes.includes(node.scope)) {
    return false;
  }

  if (filter.freshness && !filter.freshness.includes(node.freshness)) {
    return false;
  }

  if (filter.originKinds && !filter.originKinds.includes(node.provenance?.originKind ?? 'raw')) {
    return false;
  }

  if (filter.sessionId && readPayloadValue(node.payload, 'sessionId') !== filter.sessionId) {
    return false;
  }

  if (filter.workspaceId && readPayloadValue(node.payload, 'workspaceId') !== filter.workspaceId) {
    return false;
  }

  if (filter.text) {
    const payload = JSON.stringify(node.payload);

    if (!matchesTextFilter(node.label, filter.text) && !matchesTextFilter(payload, filter.text)) {
      return false;
    }
  }

  return true;
}

function matchesEdgeFilter(edge: GraphEdge, filter: GraphEdgeFilter): boolean {
  if (filter.types && !filter.types.includes(edge.type)) {
    return false;
  }

  if (filter.scopes && !filter.scopes.includes(edge.scope)) {
    return false;
  }

  if (filter.nodeId && edge.fromId !== filter.nodeId && edge.toId !== filter.nodeId) {
    return false;
  }

  if (filter.sessionId && readPayloadValue(edge.payload, 'sessionId') !== filter.sessionId) {
    return false;
  }

  if (filter.workspaceId && readPayloadValue(edge.payload, 'workspaceId') !== filter.workspaceId) {
    return false;
  }

  return true;
}

function readPayloadValue(payload: GraphNode['payload'] | GraphEdge['payload'] | undefined, key: string): string | undefined {
  if (!payload) {
    return undefined;
  }

  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

function compareGraphNodeOrder(left: GraphNode, right: GraphNode): number {
  const updatedAtDelta = right.updatedAt.localeCompare(left.updatedAt);

  if (updatedAtDelta !== 0) {
    return updatedAtDelta;
  }

  const labelDelta = left.label.localeCompare(right.label);

  if (labelDelta !== 0) {
    return labelDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareGraphEdgeOrder(left: GraphEdge, right: GraphEdge): number {
  const updatedAtDelta = right.updatedAt.localeCompare(left.updatedAt);

  if (updatedAtDelta !== 0) {
    return updatedAtDelta;
  }

  return left.id.localeCompare(right.id);
}
