import { createHash, randomUUID } from 'node:crypto';

import type {
  ControlPlaneRuntimeSnapshotRef,
  ImportBatchRunResult,
  ImportDeadLetterRecord,
  ImportFailureTrace,
  ImportIncrementalState,
  ImportJob,
  ImportJobAttempt,
  ImportJobAttemptAction,
  ImportJobDebugContext,
  ImportJobFlow,
  ImportJobResult,
  ImportJobSchedule,
  ImportMaterializationMode,
  ImportNormalizationMode,
  ImportParserKind,
  ImportRunDueJobsResult,
  ImportSchedulerPolicy,
  ImportServiceContract,
  ImportSourceDescriptor,
  ImportSourceKind,
  ImportStageTrace,
  ImportVersionInfo,
  PendingImportJobRecord
} from './contracts.js';
import { DEFAULT_IMPORT_SCHEDULER_POLICY } from './contracts.js';
import type { IngestResult, RawContextInput } from '../types/io.js';

const DEFAULT_IMPORT_STAGE_ORDER = ['parse', 'normalize', 'materialize'] as const;
const DEFAULT_IMPORT_SCHEMA_VERSION = 'import_job.v1';
const DEFAULT_IMPORT_PARSER_VERSION = 'import-parser.v1';
const DEFAULT_IMPORT_NORMALIZER_VERSION = 'import-normalizer.v1';
const DEFAULT_IMPORT_MATERIALIZER_VERSION = 'import-materializer.v1';

type ImportEngine = {
  ingest(input: RawContextInput): Promise<IngestResult>;
};

type ImportExecutionHooks = {
  parse?: (record: PendingImportJobRecord) => Promise<RawContextInput>;
  normalize?: (ingestInput: RawContextInput, record: PendingImportJobRecord) => Promise<RawContextInput>;
  materialize?: (
    normalizedInput: RawContextInput,
    record: PendingImportJobRecord,
    engine: ImportEngine
  ) => Promise<IngestResult>;
};

export class ImportService implements ImportServiceContract {
  private readonly jobs = new Map<string, PendingImportJobRecord>();

  async createJob(input: {
    sessionId: string;
    workspaceId?: string;
    sourceKind: ImportSourceKind;
    source?: Partial<ImportSourceDescriptor>;
    flow?: Partial<ImportJobFlow>;
    versionInfo?: Partial<ImportVersionInfo>;
    incremental?: Partial<ImportIncrementalState>;
    requestedBy?: string;
    createdAt?: string;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    input: RawContextInput;
  }): Promise<ImportJob> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const source = resolveImportSourceDescriptor(input.sourceKind, input.source);
    const job: ImportJob = {
      id: `import_${randomUUID()}`,
      sessionId: input.sessionId,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      sourceKind: input.sourceKind,
      source,
      flow: resolveImportJobFlow(input.sourceKind, input.flow),
      incremental: resolveImportIncrementalState(input.incremental),
      versionInfo: resolveImportVersionInfo(input.sourceKind, source, input.input, input.versionInfo),
      ...(input.requestedBy ? { requestedBy: input.requestedBy } : {}),
      createdAt,
      status: 'pending',
      attemptCount: 0,
      schedulerPolicy: cloneSchedulerPolicy(DEFAULT_IMPORT_SCHEDULER_POLICY),
      retryCount: 0,
      paused: false,
      debugContext: buildImportJobDebugContext(input.sessionId),
      ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
    };

    this.jobs.set(job.id, {
      job,
      input: input.input,
      history: [],
      schedules: [],
      deadLetters: []
    });

    return job;
  }

  async runJob(input: {
    jobId: string;
    engine: ImportEngine;
    parse?: (record: PendingImportJobRecord) => Promise<RawContextInput>;
    normalize?: (ingestInput: RawContextInput, record: PendingImportJobRecord) => Promise<RawContextInput>;
    materialize?: (
      normalizedInput: RawContextInput,
      record: PendingImportJobRecord,
      engine: ImportEngine
    ) => Promise<IngestResult>;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    completedAt?: string;
  }): Promise<ImportJobResult> {
    return this.executeJobAttempt('run', input.jobId, input.engine, input, input.runtimeSnapshot, input.completedAt);
  }

  async retryJob(input: {
    jobId: string;
    engine: ImportEngine;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    completedAt?: string;
  }): Promise<ImportJobResult> {
    return this.executeJobAttempt('retry', input.jobId, input.engine, {}, input.runtimeSnapshot, input.completedAt);
  }

  async rerunJob(input: {
    jobId: string;
    engine: ImportEngine;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    completedAt?: string;
  }): Promise<ImportJobResult> {
    return this.executeJobAttempt('rerun', input.jobId, input.engine, {}, input.runtimeSnapshot, input.completedAt);
  }

  async scheduleJob(input: {
    jobId: string;
    dueAt: string;
    createdAt?: string;
    createdBy?: string;
    note?: string;
  }): Promise<ImportJobSchedule> {
    const record = this.requireJob(input.jobId);
    assertScheduleAllowed(record.job);
    const schedule: ImportJobSchedule = {
      id: `import_schedule_${randomUUID()}`,
      jobId: record.job.id,
      dueAt: input.dueAt,
      createdAt: input.createdAt ?? new Date().toISOString(),
      status: 'pending',
      ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      ...(input.note ? { note: input.note } : {})
    };

    this.updateRecord(record.job.id, {
      ...record,
      job: {
        ...record.job,
        status: 'scheduled',
        nextScheduledAt: input.dueAt
      },
      schedules: [schedule, ...record.schedules]
    });
    return schedule;
  }

  async configureSchedulerPolicy(input: {
    jobId: string;
    policy: Partial<ImportSchedulerPolicy>;
  }): Promise<ImportJob> {
    const record = this.requireJob(input.jobId);
    const job = {
      ...record.job,
      schedulerPolicy: {
        ...record.job.schedulerPolicy,
        ...sanitizeSchedulerPolicy(input.policy)
      }
    };
    this.updateRecord(input.jobId, {
      ...record,
      job
    });
    return job;
  }

  async runDueJobs(input: {
    engine: ImportEngine;
    now?: string;
    limit?: number;
  }): Promise<ImportRunDueJobsResult> {
    const now = input.now ?? new Date().toISOString();
    const dueSchedules = [...this.jobs.values()]
      .filter((record) => !record.job.paused && !record.job.deadLetteredAt)
      .flatMap((record) => record.schedules)
      .filter((schedule) => schedule.status === 'pending' && schedule.dueAt <= now)
      .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
    const selected =
      typeof input.limit === 'number' && input.limit > 0 ? dueSchedules.slice(0, input.limit) : dueSchedules;
    const results: ImportJobResult[] = [];
    const failures: ImportRunDueJobsResult['failures'] = [];

    for (const schedule of selected) {
      const record = this.requireJob(schedule.jobId);
      this.updateSchedule(schedule.jobId, {
        ...schedule,
        dispatchedAt: now
      });

      try {
        const result = await this.executeJobAttempt(
          inferScheduledAction(record.job),
          schedule.jobId,
          input.engine,
          {},
          record.job.runtimeSnapshot,
          now
        );
        this.updateSchedule(schedule.jobId, {
          ...schedule,
          dispatchedAt: now,
          status: 'completed',
          completedAt: now
        });
        results.push(result);
      } catch (error) {
        this.updateSchedule(schedule.jobId, {
          ...schedule,
          dispatchedAt: now,
          status: 'failed',
          completedAt: now,
          error: error instanceof Error ? error.message : String(error)
        });
        failures.push({
          scheduleId: schedule.id,
          jobId: schedule.jobId,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      processedCount: selected.length,
      completedCount: results.length,
      failedCount: failures.length,
      scheduleIds: selected.map((schedule) => schedule.id),
      results,
      failures
    };
  }

  async batchRunJobs(input: {
    jobIds: readonly string[];
    engine: ImportEngine;
    runtimeSnapshot?: ControlPlaneRuntimeSnapshotRef;
    completedAt?: string;
  }): Promise<ImportBatchRunResult> {
    const updatedJobIds: string[] = [];
    const failedJobIds: string[] = [];

    for (const jobId of input.jobIds) {
      try {
        const record = this.requireJob(jobId);
        const action = inferBatchAction(record.job);
        if (action === 'retry') {
          await this.retryJob({
            jobId,
            engine: input.engine,
            ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {}),
            ...(input.completedAt ? { completedAt: input.completedAt } : {})
          });
        } else if (action === 'rerun') {
          await this.rerunJob({
            jobId,
            engine: input.engine,
            ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {}),
            ...(input.completedAt ? { completedAt: input.completedAt } : {})
          });
        } else {
          await this.runJob({
            jobId,
            engine: input.engine,
            ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {}),
            ...(input.completedAt ? { completedAt: input.completedAt } : {})
          });
        }
        updatedJobIds.push(jobId);
      } catch {
        failedJobIds.push(jobId);
      }
    }

    return {
      action: 'run',
      requestedCount: input.jobIds.length,
      updatedJobIds,
      failedJobIds
    };
  }

  async stopJobs(jobIds: readonly string[]): Promise<ImportBatchRunResult> {
    const updatedJobIds: string[] = [];
    const failedJobIds: string[] = [];

    for (const jobId of jobIds) {
      try {
        const record = this.requireJob(jobId);
        this.updateRecord(jobId, {
          ...record,
          job: {
            ...record.job,
            paused: true,
            nextScheduledAt: undefined,
            status: record.job.status === 'running' ? 'running' : 'pending'
          },
          schedules: cancelPendingSchedules(record.schedules, new Date().toISOString())
        });
        updatedJobIds.push(jobId);
      } catch {
        failedJobIds.push(jobId);
      }
    }

    return {
      action: 'stop',
      requestedCount: jobIds.length,
      updatedJobIds,
      failedJobIds
    };
  }

  async resumeJobs(input: {
    jobIds: readonly string[];
    dueAt?: string;
  }): Promise<ImportBatchRunResult> {
    const updatedJobIds: string[] = [];
    const failedJobIds: string[] = [];

    for (const jobId of input.jobIds) {
      try {
        const record = this.requireJob(jobId);
        if (record.job.deadLetteredAt) {
          throw new Error(`cannot resume dead-lettered import job: ${jobId}`);
        }

        const schedules = input.dueAt
          ? [
              {
                id: `import_schedule_${randomUUID()}`,
                jobId,
                dueAt: input.dueAt,
                createdAt: new Date().toISOString(),
                status: 'pending',
                note: 'resumed by control-plane'
              } satisfies ImportJobSchedule,
              ...record.schedules
            ]
          : record.schedules;
        const status =
          record.job.status === 'running' ? 'running' : input.dueAt ? 'scheduled' : record.job.status === 'failed' ? 'pending' : record.job.status;

        this.updateRecord(jobId, {
          ...record,
          job: {
            ...record.job,
            paused: false,
            deadLetteredAt: undefined,
            nextScheduledAt: input.dueAt ?? record.job.nextScheduledAt,
            status
          },
          schedules
        });
        updatedJobIds.push(jobId);
      } catch {
        failedJobIds.push(jobId);
      }
    }

    return {
      action: 'resume',
      requestedCount: input.jobIds.length,
      updatedJobIds,
      failedJobIds
    };
  }

  async getJob(jobId: string): Promise<PendingImportJobRecord | undefined> {
    return this.jobs.get(jobId);
  }

  async listJobs(limit = 50): Promise<ImportJob[]> {
    return [...this.jobs.values()]
      .map((record) => record.job)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async getJobHistory(jobId: string, limit = 50): Promise<ImportJobAttempt[]> {
    return this.requireJob(jobId).history.slice(0, limit);
  }

  async listDeadLetters(limit = 50): Promise<ImportDeadLetterRecord[]> {
    return [...this.jobs.values()]
      .flatMap((record) => record.deadLetters)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  private requireJob(jobId: string): PendingImportJobRecord {
    const record = this.jobs.get(jobId);
    if (!record) {
      throw new Error(`unknown import job: ${jobId}`);
    }
    return record;
  }

  private updateRecord(jobId: string, nextRecord: PendingImportJobRecord): void {
    const retentionLimit = nextRecord.job.schedulerPolicy.historyRetentionLimit;
    this.jobs.set(jobId, {
      ...nextRecord,
      history: nextRecord.history.slice(0, Math.max(1, retentionLimit))
    });
  }

  private updateSchedule(jobId: string, nextSchedule: ImportJobSchedule): void {
    const record = this.requireJob(jobId);
    const schedules = record.schedules.map((schedule) => (schedule.id === nextSchedule.id ? nextSchedule : schedule));
    const nextScheduledAt = schedules
      .filter((schedule) => schedule.status === 'pending')
      .map((schedule) => schedule.dueAt)
      .sort()
      .at(0);
    this.updateRecord(jobId, {
      ...record,
      job: {
        ...record.job,
        nextScheduledAt,
        status: nextScheduledAt ? 'scheduled' : record.job.status
      },
      schedules
    });
  }

  private async executeJobAttempt(
    action: ImportJobAttemptAction,
    jobId: string,
    engine: ImportEngine,
    hooks: ImportExecutionHooks,
    runtimeSnapshot: ControlPlaneRuntimeSnapshotRef | undefined,
    completedAtOverride: string | undefined
  ): Promise<ImportJobResult> {
    const record = this.requireJob(jobId);
    assertAttemptAllowed(record.job, action);
    const startedAt = new Date().toISOString();
    const attemptNumber = record.history.length + 1;
    const runningRecord: PendingImportJobRecord = {
      ...record,
      job: {
        ...record.job,
        status: 'running',
        paused: false,
        attemptCount: attemptNumber,
        lastAttemptAction: action,
        lastRunAt: startedAt,
        nextScheduledAt: undefined,
        deadLetteredAt: undefined,
        ...(runtimeSnapshot ? { runtimeSnapshot } : {})
      }
    };
    this.updateRecord(jobId, runningRecord);

    const stageTrace: ImportStageTrace[] = [];
    try {
      const parsedInput = await runImportStage(
        'parse',
        stageTrace,
        async () => (hooks.parse ? hooks.parse(runningRecord) : defaultParseInput(runningRecord)),
        (result) => ({ recordCount: result.records.length, warningCount: 0 })
      );
      const normalizedInput = await runImportStage(
        'normalize',
        stageTrace,
        async () => (hooks.normalize ? hooks.normalize(parsedInput, runningRecord) : defaultNormalizeInput(parsedInput, runningRecord)),
        (result) => ({ recordCount: result.records.length, warningCount: 0 })
      );
      const normalizedRecord: PendingImportJobRecord = {
        ...runningRecord,
        job: {
          ...runningRecord.job,
          versionInfo: resolveImportVersionInfo(
            runningRecord.job.sourceKind,
            runningRecord.job.source,
            normalizedInput,
            runningRecord.job.versionInfo
          )
        },
        normalizedInput
      };
      this.updateRecord(jobId, normalizedRecord);

      const ingestResult = await runImportStage(
        'materialize',
        stageTrace,
        async () =>
          hooks.materialize
            ? hooks.materialize(normalizedInput, normalizedRecord, engine)
            : engine.ingest(normalizedInput),
        (result) => ({ recordCount: normalizedInput.records.length, warningCount: result.warnings.length })
      );

      const completedAt = completedAtOverride ?? new Date().toISOString();
      const result: ImportJobResult = {
        jobId,
        status: 'completed',
        attemptNumber,
        attemptAction: action,
        ingestedRecordCount: normalizedInput.records.length,
        persistedNodeCount: ingestResult.persistedNodeIds.length,
        persistedEdgeCount: ingestResult.persistedEdgeIds.length,
        warnings: [...ingestResult.warnings],
        completedAt,
        flow: normalizedRecord.job.flow,
        versionInfo: normalizedRecord.job.versionInfo,
        stageTrace,
        ...(runtimeSnapshot ?? normalizedRecord.job.runtimeSnapshot
          ? { runtimeSnapshot: runtimeSnapshot ?? normalizedRecord.job.runtimeSnapshot }
          : {}),
        ...(normalizedRecord.job.debugContext ? { debugContext: normalizedRecord.job.debugContext } : {})
      };
      this.updateRecord(jobId, {
        ...normalizedRecord,
        job: {
          ...normalizedRecord.job,
          status: 'completed',
          completedAt,
          error: undefined,
          failureTrace: undefined,
          retryCount: 0
        },
        schedules: cancelPendingSchedules(normalizedRecord.schedules, completedAt),
        result,
        history: [
          buildImportJobAttempt({
            jobId,
            attemptNumber,
            action,
            completedAt,
            stageTrace,
            warnings: result.warnings
          }),
          ...normalizedRecord.history
        ]
      });
      return result;
    } catch (error) {
      const completedAt = completedAtOverride ?? new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      const failureTrace = buildImportFailureTrace(stageTrace, message, completedAt);
      const retryCount = runningRecord.job.retryCount + 1;
      const deadLettered =
        !failureTrace.retriable || retryCount >= runningRecord.job.schedulerPolicy.deadLetterAfterRetryCount;
      const schedules = deadLettered
        ? cancelPendingSchedules(runningRecord.schedules, completedAt)
        : maybeScheduleRetry(runningRecord.schedules, runningRecord.job, retryCount, completedAt);
      const nextScheduledAt = schedules
        .filter((schedule) => schedule.status === 'pending')
        .map((schedule) => schedule.dueAt)
        .sort()
        .at(0);

      this.updateRecord(jobId, {
        ...runningRecord,
        job: {
          ...runningRecord.job,
          status: nextScheduledAt ? 'scheduled' : 'failed',
          completedAt,
          error: message,
          failureTrace,
          retryCount,
          nextScheduledAt,
          ...(deadLettered ? { deadLetteredAt: completedAt } : {})
        },
        schedules,
        deadLetters: deadLettered
          ? [buildDeadLetterRecord(jobId, retryCount, message, completedAt), ...runningRecord.deadLetters]
          : runningRecord.deadLetters,
        history: [
          buildImportJobAttempt({
            jobId,
            attemptNumber,
            action,
            completedAt,
            stageTrace,
            warnings: [],
            error: message,
            failureTrace
          }),
          ...runningRecord.history
        ]
      });
      throw error;
    }
  }
}

function defaultParseInput(record: PendingImportJobRecord): RawContextInput {
  switch (record.job.sourceKind) {
    case 'document':
      return {
        ...record.input,
        records: record.input.records.map((item) => ({
          ...item,
          sourceType: 'document',
          content: item.content.trim(),
          metadata: {
            ...(asPlainRecord(item.metadata) ?? {}),
            importSourceKind: 'document',
            ...(record.job.source.path ? { importPath: record.job.source.path } : {}),
            ...(record.job.source.uri ? { importUri: record.job.source.uri } : {})
          }
        }))
      };
    case 'repo_structure':
      return {
        ...record.input,
        records: record.input.records.map((item) => ({
          ...item,
          sourceType: 'document',
          metadata: {
            ...(asPlainRecord(item.metadata) ?? {}),
            importSourceKind: 'repo_structure',
            ...(record.job.source.repoRoot ? { repoRoot: record.job.source.repoRoot } : {}),
            ...(item.sourceRef?.sourcePath ? { sourcePath: item.sourceRef.sourcePath } : {}),
            entityHint: inferRepoEntityHint(item.sourceRef?.sourcePath)
          }
        }))
      };
    case 'structured_input':
    default:
      return {
        ...record.input,
        records: record.input.records.map((item) => ({
          ...item,
          content: stableText(item.content),
          metadata: {
            ...(asPlainRecord(item.metadata) ?? {}),
            importSourceKind: 'structured_input'
          }
        }))
      };
  }
}

function defaultNormalizeInput(input: RawContextInput, record: PendingImportJobRecord): RawContextInput {
  const seen = new Set<string>();
  const normalizedRecords = input.records
    .map((item) => normalizeSourceSpecificRecord(item, record.job.sourceKind))
    .filter((item) => {
      const key = buildSourceSpecificDedupeKey(item, record.job.sourceKind);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => (left.id ?? '').localeCompare(right.id ?? ''));

  return {
    ...input,
    records: normalizedRecords
  };
}

function resolveImportSourceDescriptor(
  sourceKind: ImportSourceKind,
  source: Partial<ImportSourceDescriptor> | undefined
): ImportSourceDescriptor {
  return {
    kind: sourceKind,
    ...(source?.path ? { path: source.path } : {}),
    ...(source?.uri ? { uri: source.uri } : {}),
    ...(source?.repoRoot ? { repoRoot: source.repoRoot } : {}),
    ...(source?.format ? { format: source.format } : {}),
    ...(source?.checksum ? { checksum: source.checksum } : {})
  };
}

function resolveImportJobFlow(sourceKind: ImportSourceKind, flow: Partial<ImportJobFlow> | undefined): ImportJobFlow {
  const defaults = defaultImportJobFlow(sourceKind);
  return {
    parser: flow?.parser ?? defaults.parser,
    normalizer: flow?.normalizer ?? defaults.normalizer,
    materializer: flow?.materializer ?? defaults.materializer,
    stageOrder: flow?.stageOrder?.length ? [...flow.stageOrder] : [...defaults.stageOrder]
  };
}

function defaultImportJobFlow(sourceKind: ImportSourceKind): ImportJobFlow {
  switch (sourceKind) {
    case 'document':
      return { parser: 'document_parser', normalizer: 'document', materializer: 'source_entities', stageOrder: DEFAULT_IMPORT_STAGE_ORDER };
    case 'repo_structure':
      return { parser: 'repo_structure_parser', normalizer: 'repo_structure', materializer: 'source_entities', stageOrder: DEFAULT_IMPORT_STAGE_ORDER };
    case 'structured_input':
    default:
      return { parser: 'structured_payload_parser', normalizer: 'structured_input', materializer: 'runtime_ingest', stageOrder: DEFAULT_IMPORT_STAGE_ORDER };
  }
}

function resolveImportVersionInfo(
  sourceKind: ImportSourceKind,
  source: ImportSourceDescriptor,
  input: RawContextInput,
  overrides: Partial<ImportVersionInfo> | undefined
): ImportVersionInfo {
  const derivedSourceVersion = buildSourceVersion(sourceKind, source, input);
  return {
    schemaVersion: DEFAULT_IMPORT_SCHEMA_VERSION,
    parserVersion: DEFAULT_IMPORT_PARSER_VERSION,
    normalizerVersion: DEFAULT_IMPORT_NORMALIZER_VERSION,
    materializerVersion: DEFAULT_IMPORT_MATERIALIZER_VERSION,
    dedupeKey: buildImportDedupeKey(sourceKind, input),
    recordVersion: `${input.records.length}`,
    sourceVersion: derivedSourceVersion,
    ...(overrides?.sourceVersion ? { sourceVersion: overrides.sourceVersion } : {}),
    ...(overrides?.schemaVersion ? { schemaVersion: overrides.schemaVersion } : {}),
    ...(overrides?.parserVersion ? { parserVersion: overrides.parserVersion } : {}),
    ...(overrides?.normalizerVersion ? { normalizerVersion: overrides.normalizerVersion } : {}),
    ...(overrides?.materializerVersion ? { materializerVersion: overrides.materializerVersion } : {}),
    ...(overrides?.dedupeKey ? { dedupeKey: overrides.dedupeKey } : {}),
    ...(overrides?.recordVersion ? { recordVersion: overrides.recordVersion } : {})
  };
}

function resolveImportIncrementalState(
  incremental: Partial<ImportIncrementalState> | undefined
): ImportIncrementalState {
  return {
    enabled: incremental?.enabled === true,
    ...(incremental?.previousJobId ? { previousJobId: incremental.previousJobId } : {}),
    ...(incremental?.cursor ? { cursor: incremental.cursor } : {}),
    ...(incremental?.changedRecordIds?.length ? { changedRecordIds: [...incremental.changedRecordIds] } : {})
  };
}

async function runImportStage<T>(
  stage: ImportStageTrace['stage'],
  trace: ImportStageTrace[],
  operation: () => Promise<T>,
  summarize: (result: T) => {
    recordCount?: number;
    warningCount?: number;
  }
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await operation();
    const completedAt = new Date().toISOString();
    const summary = summarize(result);
    trace.push({
      stage,
      status: 'completed',
      completedAt,
      durationMs: Date.now() - startedAt,
      ...(typeof summary.recordCount === 'number' ? { recordCount: summary.recordCount } : {}),
      ...(typeof summary.warningCount === 'number' ? { warningCount: summary.warningCount } : {})
    });
    return result;
  } catch (error) {
    trace.push({
      stage,
      status: 'failed',
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt
    });
    throw error;
  }
}

function buildImportFailureTrace(
  trace: readonly ImportStageTrace[],
  message: string,
  failedAt: string
): ImportFailureTrace {
  const failedStage = [...trace].reverse().find((item) => item.status === 'failed')?.stage ?? 'materialize';
  return {
    stage: failedStage,
    failedAt,
    message,
    retriable: failedStage !== 'parse'
  };
}

function buildImportDedupeKey(sourceKind: ImportSourceKind, input: RawContextInput): string {
  const recordIds = input.records.map((record) => record.id).sort().join('|');
  return `${sourceKind}:${input.sessionId}:${input.workspaceId ?? 'workspace:none'}:${recordIds}`;
}

function buildSourceVersion(sourceKind: ImportSourceKind, source: ImportSourceDescriptor, input: RawContextInput): string {
  const digest = createDigest(
    sourceKind === 'document'
      ? `${source.path ?? source.uri ?? 'document:none'}|${source.checksum ?? ''}|${input.records.map((record) => record.content).join('|')}`
      : sourceKind === 'repo_structure'
        ? `${source.repoRoot ?? 'repo:none'}|${input.records
            .map((record) => `${record.sourceRef?.sourcePath ?? ''}:${record.content}`)
            .sort()
            .join('|')}`
        : input.records.map((record) => `${record.id}:${stableText(record.content)}`).sort().join('|')
  );
  return `${sourceKind}:${digest}`;
}

function buildImportJobAttempt(input: {
  jobId: string;
  attemptNumber: number;
  action: ImportJobAttemptAction;
  completedAt: string;
  stageTrace: ImportStageTrace[];
  warnings: string[];
  error?: string;
  failureTrace?: ImportFailureTrace;
}): ImportJobAttempt {
  return {
    id: `import_attempt_${randomUUID()}`,
    jobId: input.jobId,
    attemptNumber: input.attemptNumber,
    action: input.action,
    startedAt: inferAttemptStartedAt(input.stageTrace, input.completedAt),
    completedAt: input.completedAt,
    status: input.failureTrace ? 'failed' : 'completed',
    stageTrace: [...input.stageTrace],
    warnings: [...input.warnings],
    ...(input.error ? { error: input.error } : {}),
    ...(input.failureTrace ? { failureTrace: input.failureTrace } : {})
  };
}

function inferAttemptStartedAt(stageTrace: readonly ImportStageTrace[], fallback: string): string {
  const [firstStage] = stageTrace;
  return firstStage?.completedAt ?? fallback;
}

function buildImportJobDebugContext(sessionId: string): ImportJobDebugContext {
  return {
    sessionId,
    inspectRuntimeWindowMethod: 'compact-context.inspect_runtime_window',
    getImportJobMethod: 'compact-context.get_import_job',
    listImportHistoryMethod: 'compact-context.list_import_job_history'
  };
}

function assertScheduleAllowed(job: ImportJob): void {
  if (job.status === 'running') {
    throw new Error(`cannot schedule import job ${job.id} while it is running`);
  }
  if (job.deadLetteredAt) {
    throw new Error(`cannot schedule dead-lettered import job: ${job.id}`);
  }
}

function assertAttemptAllowed(job: ImportJob, action: ImportJobAttemptAction): void {
  if (job.paused) {
    throw new Error(`import job ${job.id} is paused`);
  }
  if (job.deadLetteredAt) {
    throw new Error(`import job ${job.id} is dead-lettered`);
  }
  if (job.status === 'running') {
    throw new Error(`import job ${job.id} is already running`);
  }
  if (action === 'run' && job.status !== 'pending' && job.status !== 'scheduled') {
    throw new Error(`import job ${job.id} must be pending or scheduled before run`);
  }
  if (action === 'retry') {
    if (job.status !== 'failed' && job.status !== 'scheduled') {
      throw new Error(`import job ${job.id} must be failed before retry`);
    }
    if (!job.failureTrace?.retriable) {
      throw new Error(`import job ${job.id} is not retriable`);
    }
    if (job.retryCount >= job.schedulerPolicy.maxRetryCount) {
      throw new Error(`import job ${job.id} reached max retry count`);
    }
  }
}

function inferScheduledAction(job: ImportJob): ImportJobAttemptAction {
  if (job.status === 'failed' && job.failureTrace?.retriable) {
    return 'retry';
  }
  return job.attemptCount > 0 ? 'rerun' : 'run';
}

function inferBatchAction(job: ImportJob): ImportJobAttemptAction {
  if (job.status === 'failed' && job.failureTrace?.retriable && job.retryCount < job.schedulerPolicy.maxRetryCount) {
    return 'retry';
  }
  return job.attemptCount > 0 ? 'rerun' : 'run';
}

function sanitizeSchedulerPolicy(policy: Partial<ImportSchedulerPolicy>): Partial<ImportSchedulerPolicy> {
  const next: Partial<ImportSchedulerPolicy> = {};
  if (typeof policy.maxRetryCount === 'number' && policy.maxRetryCount >= 0) {
    next.maxRetryCount = Math.floor(policy.maxRetryCount);
  }
  if (typeof policy.initialBackoffMs === 'number' && policy.initialBackoffMs >= 0) {
    next.initialBackoffMs = Math.floor(policy.initialBackoffMs);
  }
  if (typeof policy.maxBackoffMs === 'number' && policy.maxBackoffMs >= 0) {
    next.maxBackoffMs = Math.floor(policy.maxBackoffMs);
  }
  if (typeof policy.deadLetterAfterRetryCount === 'number' && policy.deadLetterAfterRetryCount >= 0) {
    next.deadLetterAfterRetryCount = Math.floor(policy.deadLetterAfterRetryCount);
  }
  if (typeof policy.historyRetentionLimit === 'number' && policy.historyRetentionLimit > 0) {
    next.historyRetentionLimit = Math.floor(policy.historyRetentionLimit);
  }
  return next;
}

function cloneSchedulerPolicy(policy: ImportSchedulerPolicy): ImportSchedulerPolicy {
  return {
    maxRetryCount: policy.maxRetryCount,
    initialBackoffMs: policy.initialBackoffMs,
    maxBackoffMs: policy.maxBackoffMs,
    deadLetterAfterRetryCount: policy.deadLetterAfterRetryCount,
    historyRetentionLimit: policy.historyRetentionLimit
  };
}

function maybeScheduleRetry(
  schedules: readonly ImportJobSchedule[],
  job: ImportJob,
  retryCount: number,
  now: string
): ImportJobSchedule[] {
  if (retryCount > job.schedulerPolicy.maxRetryCount) {
    return [...schedules];
  }

  const dueAt = new Date(Date.parse(now) + computeBackoffMs(job.schedulerPolicy, retryCount)).toISOString();
  const retrySchedule: ImportJobSchedule = {
    id: `import_schedule_${randomUUID()}`,
    jobId: job.id,
    dueAt,
    createdAt: now,
    status: 'pending',
    note: `automatic retry ${retryCount}`
  };

  return [retrySchedule, ...cancelPendingSchedules(schedules, now)];
}

function cancelPendingSchedules(schedules: readonly ImportJobSchedule[], completedAt: string): ImportJobSchedule[] {
  return schedules.map((schedule) =>
    schedule.status === 'pending'
      ? {
          ...schedule,
          status: 'cancelled',
          completedAt
        }
      : schedule
  );
}

function computeBackoffMs(policy: ImportSchedulerPolicy, retryCount: number): number {
  const candidate = policy.initialBackoffMs * 2 ** Math.max(0, retryCount - 1);
  return Math.min(candidate, policy.maxBackoffMs);
}

function buildDeadLetterRecord(
  jobId: string,
  retryCount: number,
  reason: string,
  createdAt: string
): ImportDeadLetterRecord {
  return {
    id: `import_dead_letter_${randomUUID()}`,
    jobId,
    createdAt,
    reason,
    retryCount,
    error: reason
  };
}

export function inferImportParserKind(sourceKind: ImportSourceKind): ImportParserKind {
  return defaultImportJobFlow(sourceKind).parser;
}

export function inferImportNormalizationMode(sourceKind: ImportSourceKind): ImportNormalizationMode {
  return defaultImportJobFlow(sourceKind).normalizer;
}

export function inferImportMaterializationMode(sourceKind: ImportSourceKind): ImportMaterializationMode {
  return defaultImportJobFlow(sourceKind).materializer;
}

function normalizeSourceSpecificRecord(
  record: RawContextInput['records'][number],
  sourceKind: ImportSourceKind
): RawContextInput['records'][number] {
  switch (sourceKind) {
    case 'document':
      return {
        ...record,
        content: record.content.trim()
      };
    case 'repo_structure':
      return {
        ...record,
        content: stableText(record.content),
        metadata: {
          ...(asPlainRecord(record.metadata) ?? {}),
          entityHint: inferRepoEntityHint(record.sourceRef?.sourcePath)
        }
      };
    case 'structured_input':
    default:
      return {
        ...record,
        content: stableText(record.content)
      };
  }
}

function buildSourceSpecificDedupeKey(
  record: RawContextInput['records'][number],
  sourceKind: ImportSourceKind
): string {
  switch (sourceKind) {
    case 'document':
      return `${record.sourceRef?.sourcePath ?? record.id}:${createDigest(record.content)}`;
    case 'repo_structure':
      return `${record.sourceRef?.sourcePath ?? record.id}:${record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata) ? String(record.metadata.entityHint ?? '') : ''}`;
    case 'structured_input':
    default:
      return `${record.id}:${createDigest(stableText(record.content))}`;
  }
}

function inferRepoEntityHint(sourcePath: string | undefined): string {
  if (!sourcePath) {
    return 'RepoEntity';
  }
  const normalized = sourcePath.toLowerCase();
  if (normalized.endsWith('.ts') || normalized.endsWith('.tsx') || normalized.endsWith('.js')) {
    return normalized.includes('/api/') || normalized.includes('\\api\\') ? 'API' : 'File';
  }
  if (normalized.endsWith('.md')) {
    return 'Document';
  }
  if (normalized.endsWith('.json') || normalized.endsWith('.yaml') || normalized.endsWith('.yml')) {
    return 'Module';
  }
  return 'RepoEntity';
}

function createDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function stableText(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function asPlainRecord(value: unknown): Record<string, string | number | boolean | null> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, string | number | boolean | null>) }
    : undefined;
}
