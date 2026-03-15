import { randomUUID } from 'node:crypto';

import type {
  ControlPlaneRuntimeSnapshotRef,
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
  ImportServiceContract,
  ImportSourceDescriptor,
  ImportSourceKind,
  ImportStageTrace,
  ImportVersionInfo,
  PendingImportJobRecord
} from './contracts.js';
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
    const flow = resolveImportJobFlow(input.sourceKind, input.flow);
    const versionInfo = resolveImportVersionInfo(input.sourceKind, input.input, input.versionInfo);
    const incremental = resolveImportIncrementalState(input.incremental);
    const debugContext = buildImportJobDebugContext(input.sessionId);
    const job: ImportJob = {
      id: `import_${randomUUID()}`,
      sessionId: input.sessionId,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      sourceKind: input.sourceKind,
      source,
      flow,
      incremental,
      versionInfo,
      ...(input.requestedBy ? { requestedBy: input.requestedBy } : {}),
      createdAt,
      status: 'pending',
      attemptCount: 0,
      debugContext,
      ...(input.runtimeSnapshot ? { runtimeSnapshot: input.runtimeSnapshot } : {})
    };

    this.jobs.set(job.id, {
      job,
      input: input.input,
      history: [],
      schedules: []
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
    const createdAt = input.createdAt ?? new Date().toISOString();
    const schedule: ImportJobSchedule = {
      id: `import_schedule_${randomUUID()}`,
      jobId: record.job.id,
      dueAt: input.dueAt,
      createdAt,
      status: 'pending',
      ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      ...(input.note ? { note: input.note } : {})
    };

    const updatedRecord: PendingImportJobRecord = {
      ...record,
      job: {
        ...record.job,
        status: 'scheduled',
        nextScheduledAt: input.dueAt
      },
      schedules: [schedule, ...record.schedules]
    };
    this.jobs.set(record.job.id, updatedRecord);
    return schedule;
  }

  async runDueJobs(input: {
    engine: ImportEngine;
    now?: string;
    limit?: number;
  }): Promise<ImportRunDueJobsResult> {
    const now = input.now ?? new Date().toISOString();
    const dueSchedules = [...this.jobs.values()]
      .flatMap((record) => record.schedules)
      .filter((schedule) => schedule.status === 'pending' && schedule.dueAt <= now)
      .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
    const selectedSchedules =
      typeof input.limit === 'number' && input.limit > 0 ? dueSchedules.slice(0, input.limit) : dueSchedules;

    const results: ImportJobResult[] = [];
    const failures: ImportRunDueJobsResult['failures'] = [];

    for (const schedule of selectedSchedules) {
      const record = this.requireJob(schedule.jobId);
      const action = inferScheduledAction(record.job);
      const updatedSchedule = {
        ...schedule,
        dispatchedAt: now
      };
      this.updateSchedule(record.job.id, updatedSchedule);

      try {
        const result = await this.executeJobAttempt(action, record.job.id, input.engine, {}, record.job.runtimeSnapshot, now);
        this.updateSchedule(record.job.id, {
          ...updatedSchedule,
          status: 'completed',
          completedAt: now
        });
        results.push(result);
      } catch (error) {
        this.updateSchedule(record.job.id, {
          ...updatedSchedule,
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
      processedCount: selectedSchedules.length,
      completedCount: results.length,
      failedCount: failures.length,
      scheduleIds: selectedSchedules.map((schedule) => schedule.id),
      results,
      failures
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
    const record = this.requireJob(jobId);

    return [...record.history]
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
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
    this.jobs.set(jobId, nextRecord);
  }

  private updateSchedule(jobId: string, nextSchedule: ImportJobSchedule): void {
    const record = this.requireJob(jobId);
    const schedules = record.schedules.map((schedule) => (schedule.id === nextSchedule.id ? nextSchedule : schedule));
    const latestPendingDueAt = schedules
      .filter((schedule) => schedule.status === 'pending')
      .map((schedule) => schedule.dueAt)
      .sort()
      .at(0);

    this.updateRecord(jobId, {
      ...record,
      job: {
        ...record.job,
        status: latestPendingDueAt ? 'scheduled' : record.job.status,
        nextScheduledAt: latestPendingDueAt
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
        attemptCount: attemptNumber,
        lastAttemptAction: action,
        lastRunAt: startedAt,
        nextScheduledAt: undefined,
        ...(runtimeSnapshot ? { runtimeSnapshot } : {})
      }
    };
    this.updateRecord(jobId, runningRecord);

    const stageTrace: ImportStageTrace[] = [];

    try {
      const parsedInput = await runImportStage(
        'parse',
        stageTrace,
        async () => (hooks.parse ? hooks.parse(runningRecord) : runningRecord.input),
        (result) => ({
          recordCount: result.records.length,
          warningCount: 0
        })
      );

      const normalizedInput = await runImportStage(
        'normalize',
        stageTrace,
        async () => (hooks.normalize ? hooks.normalize(parsedInput, runningRecord) : parsedInput),
        (result) => ({
          recordCount: result.records.length,
          warningCount: 0
        })
      );

      const normalizedRecord: PendingImportJobRecord = {
        ...runningRecord,
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
        (result) => ({
          recordCount: normalizedInput.records.length,
          warningCount: result.warnings.length
        })
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
      const attempt = buildImportJobAttempt({
        jobId,
        attemptNumber,
        action,
        completedAt,
        stageTrace,
        warnings: result.warnings
      });

      this.updateRecord(jobId, {
        ...normalizedRecord,
        job: {
          ...normalizedRecord.job,
          status: 'completed',
          completedAt,
          error: undefined,
          failureTrace: undefined
        },
        result,
        history: [attempt, ...normalizedRecord.history]
      });

      return result;
    } catch (error) {
      const completedAt = completedAtOverride ?? new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      const failureTrace = buildImportFailureTrace(stageTrace, message, completedAt);
      const failedAttempt = buildImportJobAttempt({
        jobId,
        attemptNumber,
        action,
        completedAt,
        stageTrace,
        warnings: [],
        error: message,
        failureTrace
      });

      this.updateRecord(jobId, {
        ...runningRecord,
        job: {
          ...runningRecord.job,
          status: 'failed',
          completedAt,
          error: message,
          failureTrace
        },
        history: [failedAttempt, ...runningRecord.history]
      });
      throw error;
    }
  }
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

function resolveImportJobFlow(
  sourceKind: ImportSourceKind,
  flow: Partial<ImportJobFlow> | undefined
): ImportJobFlow {
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
      return {
        parser: 'document_parser',
        normalizer: 'document',
        materializer: 'source_entities',
        stageOrder: DEFAULT_IMPORT_STAGE_ORDER
      };
    case 'repo_structure':
      return {
        parser: 'repo_structure_parser',
        normalizer: 'repo_structure',
        materializer: 'source_entities',
        stageOrder: DEFAULT_IMPORT_STAGE_ORDER
      };
    case 'structured_input':
    default:
      return {
        parser: 'structured_payload_parser',
        normalizer: 'structured_input',
        materializer: 'runtime_ingest',
        stageOrder: DEFAULT_IMPORT_STAGE_ORDER
      };
  }
}

function resolveImportVersionInfo(
  sourceKind: ImportSourceKind,
  input: RawContextInput,
  overrides: Partial<ImportVersionInfo> | undefined
): ImportVersionInfo {
  return {
    schemaVersion: DEFAULT_IMPORT_SCHEMA_VERSION,
    parserVersion: DEFAULT_IMPORT_PARSER_VERSION,
    normalizerVersion: DEFAULT_IMPORT_NORMALIZER_VERSION,
    materializerVersion: DEFAULT_IMPORT_MATERIALIZER_VERSION,
    dedupeKey: buildImportDedupeKey(sourceKind, input),
    recordVersion: `${input.records.length}`,
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
}

function assertAttemptAllowed(job: ImportJob, action: ImportJobAttemptAction): void {
  if (job.status === 'running') {
    throw new Error(`import job ${job.id} is already running`);
  }

  if (action === 'run' && job.status !== 'pending' && job.status !== 'scheduled') {
    throw new Error(`import job ${job.id} must be pending or scheduled before run`);
  }

  if (action === 'retry') {
    if (job.status !== 'failed') {
      throw new Error(`import job ${job.id} must be failed before retry`);
    }

    if (!job.failureTrace?.retriable) {
      throw new Error(`import job ${job.id} is not retriable`);
    }
  }
}

function inferScheduledAction(job: ImportJob): ImportJobAttemptAction {
  if (job.status === 'failed' && job.failureTrace?.retriable) {
    return 'retry';
  }

  return job.attemptCount > 0 ? 'rerun' : 'run';
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
