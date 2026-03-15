import { randomUUID } from 'node:crypto';

import type {
  ImportFailureTrace,
  ImportIncrementalState,
  ImportJob,
  ImportJobFlow,
  ImportJobResult,
  ImportMaterializationMode,
  ImportNormalizationMode,
  ImportParserKind,
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
    input: RawContextInput;
  }): Promise<ImportJob> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const source = resolveImportSourceDescriptor(input.sourceKind, input.source);
    const flow = resolveImportJobFlow(input.sourceKind, input.flow);
    const versionInfo = resolveImportVersionInfo(input.sourceKind, input.input, input.versionInfo);
    const incremental = resolveImportIncrementalState(input.incremental);
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
      status: 'pending'
    };

    this.jobs.set(job.id, {
      job,
      input: input.input
    });

    return job;
  }

  async runJob(input: {
    jobId: string;
    engine: {
      ingest(input: RawContextInput): Promise<IngestResult>;
    };
    parse?: (record: PendingImportJobRecord) => Promise<RawContextInput>;
    normalize?: (ingestInput: RawContextInput, record: PendingImportJobRecord) => Promise<RawContextInput>;
    materialize?: (
      normalizedInput: RawContextInput,
      record: PendingImportJobRecord,
      engine: {
        ingest(input: RawContextInput): Promise<IngestResult>;
      }
    ) => Promise<IngestResult>;
    completedAt?: string;
  }): Promise<ImportJobResult> {
    const record = this.requireJob(input.jobId);
    const running: PendingImportJobRecord = {
      ...record,
      job: {
        ...record.job,
        status: 'running',
        error: undefined,
        failureTrace: undefined
      }
    };
    this.jobs.set(record.job.id, running);

    const stageTrace: ImportStageTrace[] = [];

    try {
      const parsedInput = await runImportStage(
        'parse',
        stageTrace,
        async () => (input.parse ? input.parse(running) : record.input),
        (result) => ({
          recordCount: result.records.length,
          warningCount: 0
        })
      );

      const normalizedInput = await runImportStage(
        'normalize',
        stageTrace,
        async () => (input.normalize ? input.normalize(parsedInput, running) : parsedInput),
        (result) => ({
          recordCount: result.records.length,
          warningCount: 0
        })
      );

      const updatedRecord: PendingImportJobRecord = {
        ...running,
        normalizedInput
      };
      this.jobs.set(record.job.id, updatedRecord);

      const ingestResult = await runImportStage(
        'materialize',
        stageTrace,
        async () =>
          input.materialize
            ? input.materialize(normalizedInput, updatedRecord, input.engine)
            : input.engine.ingest(normalizedInput),
        (result) => ({
          recordCount: normalizedInput.records.length,
          warningCount: result.warnings.length
        })
      );

      const completedAt = input.completedAt ?? new Date().toISOString();
      const result: ImportJobResult = {
        jobId: record.job.id,
        status: 'completed',
        ingestedRecordCount: normalizedInput.records.length,
        persistedNodeCount: ingestResult.persistedNodeIds.length,
        persistedEdgeCount: ingestResult.persistedEdgeIds.length,
        warnings: [...ingestResult.warnings],
        completedAt,
        flow: record.job.flow,
        versionInfo: record.job.versionInfo,
        stageTrace
      };

      this.jobs.set(record.job.id, {
        ...updatedRecord,
        job: {
          ...updatedRecord.job,
          status: 'completed',
          completedAt,
          error: undefined,
          failureTrace: undefined
        },
        result
      });

      return result;
    } catch (error) {
      const failedAt = input.completedAt ?? new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      const failureTrace = buildImportFailureTrace(stageTrace, message, failedAt);

      this.jobs.set(record.job.id, {
        ...running,
        job: {
          ...running.job,
          status: 'failed',
          error: message,
          failureTrace
        },
        ...(running.normalizedInput ? { normalizedInput: running.normalizedInput } : {})
      });
      throw error;
    }
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

  private requireJob(jobId: string): PendingImportJobRecord {
    const record = this.jobs.get(jobId);

    if (!record) {
      throw new Error(`unknown import job: ${jobId}`);
    }

    return record;
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

export function inferImportParserKind(sourceKind: ImportSourceKind): ImportParserKind {
  return defaultImportJobFlow(sourceKind).parser;
}

export function inferImportNormalizationMode(sourceKind: ImportSourceKind): ImportNormalizationMode {
  return defaultImportJobFlow(sourceKind).normalizer;
}

export function inferImportMaterializationMode(sourceKind: ImportSourceKind): ImportMaterializationMode {
  return defaultImportJobFlow(sourceKind).materializer;
}
