import {
  type GovernanceProposal,
  type ImportJob,
  type ObservabilityDashboardSnapshot,
  type WorkspaceAggregateView,
  type WorkspaceCatalogEntry,
  type WorkspaceCatalogServiceContract,
  type WorkspaceIsolationPolicy
} from './contracts.js';

export class WorkspaceCatalogService implements WorkspaceCatalogServiceContract {
  private readonly policies = new Map<string, WorkspaceIsolationPolicy>();

  saveIsolationPolicy(input: {
    workspaceId: string;
    isolationMode: WorkspaceIsolationPolicy['isolationMode'];
    authorityMode: WorkspaceIsolationPolicy['authorityMode'];
    sharedGlobalRead?: boolean;
    sharedGlobalWrite?: boolean;
    savedAt?: string;
    savedBy?: string;
  }): WorkspaceIsolationPolicy {
    const policy: WorkspaceIsolationPolicy = {
      workspaceId: input.workspaceId,
      isolationMode: input.isolationMode,
      authorityMode: input.authorityMode,
      sharedGlobalRead: input.sharedGlobalRead ?? true,
      sharedGlobalWrite: input.sharedGlobalWrite ?? false,
      savedAt: input.savedAt ?? new Date().toISOString(),
      ...(input.savedBy ? { savedBy: input.savedBy } : {})
    };
    this.policies.set(policy.workspaceId, policy);
    return { ...policy };
  }

  listIsolationPolicies(): WorkspaceIsolationPolicy[] {
    return [...this.policies.values()].sort((left, right) => left.workspaceId.localeCompare(right.workspaceId));
  }

  buildCatalog(input: {
    jobs: readonly ImportJob[];
    proposals: readonly GovernanceProposal[];
    snapshots: readonly ObservabilityDashboardSnapshot[];
  }): WorkspaceCatalogEntry[] {
    const jobWorkspaceMap = new Map<string, { sessionIds: Set<string>; importJobCount: number; lastActivityAt?: string }>();

    for (const job of input.jobs) {
      const workspaceId = job.workspaceId ?? `session:${job.sessionId}`;
      const current = jobWorkspaceMap.get(workspaceId) ?? {
        sessionIds: new Set<string>(),
        importJobCount: 0,
        lastActivityAt: undefined
      };
      current.sessionIds.add(job.sessionId);
      current.importJobCount += 1;
      current.lastActivityAt = maxIso(current.lastActivityAt, job.completedAt ?? job.lastRunAt ?? job.createdAt);
      jobWorkspaceMap.set(workspaceId, current);
    }

    const snapshotWorkspaceMap = new Map<string, number>();
    for (const snapshot of input.snapshots) {
      for (const sessionId of snapshot.sessionIds) {
        const workspaceId = findWorkspaceIdBySession(jobWorkspaceMap, sessionId) ?? `session:${sessionId}`;
        snapshotWorkspaceMap.set(workspaceId, (snapshotWorkspaceMap.get(workspaceId) ?? 0) + 1);
      }
    }

    const proposalWorkspaceMap = new Map<string, number>();
    for (const proposal of input.proposals) {
      const workspaceId = proposal.targetScope === 'global' ? 'global' : proposal.targetScope === 'workspace' ? 'workspace:shared' : `session:${proposal.contextSessionId ?? 'unknown'}`;
      proposalWorkspaceMap.set(workspaceId, (proposalWorkspaceMap.get(workspaceId) ?? 0) + 1);
    }

    const workspaceIds = new Set<string>([
      ...jobWorkspaceMap.keys(),
      ...snapshotWorkspaceMap.keys(),
      ...proposalWorkspaceMap.keys(),
      ...this.policies.keys()
    ]);

    return [...workspaceIds]
      .map((workspaceId) => {
        const policy = this.policies.get(workspaceId) ?? defaultPolicy(workspaceId);
        const jobEntry = jobWorkspaceMap.get(workspaceId);
        return {
          workspaceId,
          sessionIds: [...(jobEntry?.sessionIds ?? [])].sort(),
          importJobCount: jobEntry?.importJobCount ?? 0,
          proposalCount: proposalWorkspaceMap.get(workspaceId) ?? 0,
          snapshotCount: snapshotWorkspaceMap.get(workspaceId) ?? 0,
          ...(jobEntry?.lastActivityAt ? { lastActivityAt: jobEntry.lastActivityAt } : {}),
          isolationMode: policy.isolationMode,
          authorityMode: policy.authorityMode
        } satisfies WorkspaceCatalogEntry;
      })
      .sort((left, right) => left.workspaceId.localeCompare(right.workspaceId));
  }

  getWorkspaceSummary(input: {
    workspaceId: string;
    jobs: readonly ImportJob[];
    proposals: readonly GovernanceProposal[];
    snapshots: readonly ObservabilityDashboardSnapshot[];
  }): WorkspaceCatalogEntry | undefined {
    return this.buildCatalog(input).find((entry) => entry.workspaceId === input.workspaceId);
  }

  buildAggregate(input: { catalog: readonly WorkspaceCatalogEntry[] }): WorkspaceAggregateView {
    return {
      workspaceCount: input.catalog.length,
      activeWorkspaceIds: input.catalog.filter((entry) => entry.importJobCount > 0 || entry.snapshotCount > 0).map((entry) => entry.workspaceId),
      totalImportJobs: input.catalog.reduce((total, entry) => total + entry.importJobCount, 0),
      totalProposals: input.catalog.reduce((total, entry) => total + entry.proposalCount, 0),
      totalSnapshots: input.catalog.reduce((total, entry) => total + entry.snapshotCount, 0),
      sharedGlobalWriteWorkspaceIds: input.catalog
        .filter((entry) => (this.policies.get(entry.workspaceId) ?? defaultPolicy(entry.workspaceId)).sharedGlobalWrite)
        .map((entry) => entry.workspaceId)
    };
  }
}

function defaultPolicy(workspaceId: string): WorkspaceIsolationPolicy {
  return {
    workspaceId,
    isolationMode: workspaceId === 'global' ? 'shared_global' : 'isolated',
    authorityMode: workspaceId === 'global' ? 'global_reviewer' : 'workspace_reviewer',
    sharedGlobalRead: true,
    sharedGlobalWrite: workspaceId === 'global',
    savedAt: new Date(0).toISOString()
  };
}

function findWorkspaceIdBySession(
  jobWorkspaceMap: ReadonlyMap<string, { sessionIds: Set<string> }>,
  sessionId: string
): string | undefined {
  for (const [workspaceId, entry] of jobWorkspaceMap.entries()) {
    if (entry.sessionIds.has(sessionId)) {
      return workspaceId;
    }
  }
  return undefined;
}

function maxIso(left: string | undefined, right: string | undefined): string | undefined {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left >= right ? left : right;
}
