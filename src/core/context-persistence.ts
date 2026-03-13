import type { SessionCheckpoint, SessionDelta, SkillCandidate } from '../types/core.js';

export interface ContextPersistenceStore {
  saveCheckpoint(checkpoint: SessionCheckpoint): Promise<void>;
  saveDelta(delta: SessionDelta): Promise<void>;
  getLatestCheckpoint(sessionId: string): Promise<SessionCheckpoint | undefined>;
  listCheckpoints(sessionId: string, limit?: number): Promise<SessionCheckpoint[]>;
  listDeltas(sessionId: string, limit?: number): Promise<SessionDelta[]>;
  saveSkillCandidates(sessionId: string, candidates: SkillCandidate[]): Promise<void>;
  listSkillCandidates(sessionId: string, limit?: number): Promise<SkillCandidate[]>;
  close(): Promise<void>;
}

export class InMemoryContextPersistenceStore implements ContextPersistenceStore {
  private readonly checkpointsBySession = new Map<string, SessionCheckpoint[]>();
  private readonly deltasBySession = new Map<string, SessionDelta[]>();
  private readonly skillsBySession = new Map<string, SkillCandidate[]>();

  async saveCheckpoint(checkpoint: SessionCheckpoint): Promise<void> {
    const items = this.checkpointsBySession.get(checkpoint.sessionId) ?? [];
    this.checkpointsBySession.set(checkpoint.sessionId, upsertById(items, checkpoint));
  }

  async saveDelta(delta: SessionDelta): Promise<void> {
    const items = this.deltasBySession.get(delta.sessionId) ?? [];
    this.deltasBySession.set(delta.sessionId, upsertById(items, delta));
  }

  async getLatestCheckpoint(sessionId: string): Promise<SessionCheckpoint | undefined> {
    const items = this.checkpointsBySession.get(sessionId) ?? [];
    return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  }

  async listCheckpoints(sessionId: string, limit = 20): Promise<SessionCheckpoint[]> {
    return [...(this.checkpointsBySession.get(sessionId) ?? [])]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async listDeltas(sessionId: string, limit = 20): Promise<SessionDelta[]> {
    return [...(this.deltasBySession.get(sessionId) ?? [])]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async saveSkillCandidates(sessionId: string, candidates: SkillCandidate[]): Promise<void> {
    if (candidates.length === 0) {
      return;
    }

    const items = this.skillsBySession.get(sessionId) ?? [];
    let nextItems = items;

    for (const candidate of candidates) {
      nextItems = upsertById(nextItems, candidate);
    }

    this.skillsBySession.set(sessionId, nextItems);
  }

  async listSkillCandidates(sessionId: string, limit = 20): Promise<SkillCandidate[]> {
    return [...(this.skillsBySession.get(sessionId) ?? [])]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const filtered = items.filter((item) => item.id !== nextItem.id);
  filtered.push(nextItem);
  return filtered;
}
