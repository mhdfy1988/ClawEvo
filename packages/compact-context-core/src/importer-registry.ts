import type {
  ImportSourceCatalog,
  ImportSourceKind,
  ImporterRegistryContract,
  ImporterRegistryEntry
} from './contracts.js';

const IMPORT_SOURCE_CATALOG_VERSION = 'import_source_catalog.v1';

const BUILTIN_IMPORTERS: readonly ImporterRegistryEntry[] = [
  {
    id: 'document-default',
    sourceKind: 'document',
    label: 'Document Importer',
    description: 'Parse markdown/text documents, normalize document metadata, and materialize source entities.',
    parser: 'document_parser',
    normalizer: 'document',
    materializer: 'source_entities',
    acceptedFormats: ['md', 'txt', 'html', 'pdf'],
    supportsIncremental: true,
    emitsSourceEntities: true,
    dedupeStrategy: 'content_hash + source_path',
    versionStrategy: 'source checksum or document content hash',
    normalizationNotes: ['trim textual content', 'preserve document path/uri metadata', 'dedupe repeated document records'],
    inspectMethods: ['compact-context.inspect_runtime_window', 'compact-context.get_import_job']
  },
  {
    id: 'repo-structure-default',
    sourceKind: 'repo_structure',
    label: 'Repository Structure Importer',
    description: 'Parse repository manifests and file trees, normalize repo metadata, and materialize source entities.',
    parser: 'repo_structure_parser',
    normalizer: 'repo_structure',
    materializer: 'source_entities',
    acceptedFormats: ['json', 'tree', 'manifest'],
    supportsIncremental: true,
    emitsSourceEntities: true,
    dedupeStrategy: 'repo_root + source_path',
    versionStrategy: 'repo root + file tree hash',
    normalizationNotes: ['preserve repoRoot/sourcePath', 'classify file/module/api hints', 'dedupe repeated tree entries'],
    inspectMethods: ['compact-context.get_import_job', 'compact-context.list_import_job_history']
  },
  {
    id: 'structured-input-default',
    sourceKind: 'structured_input',
    label: 'Structured Input Importer',
    description: 'Parse structured payloads, normalize records, and route them through runtime ingest.',
    parser: 'structured_payload_parser',
    normalizer: 'structured_input',
    materializer: 'runtime_ingest',
    acceptedFormats: ['json', 'jsonl', 'yaml'],
    supportsIncremental: false,
    emitsSourceEntities: false,
    dedupeStrategy: 'record id + normalized payload',
    versionStrategy: 'normalized payload hash',
    normalizationNotes: ['stable stringify structured payloads', 'coerce record metadata to deterministic ordering'],
    inspectMethods: ['compact-context.inspect_runtime_window', 'compact-context.get_import_job']
  }
] as const;

export class ImporterRegistry implements ImporterRegistryContract {
  private readonly importers: ImporterRegistryEntry[];

  constructor(importers: readonly ImporterRegistryEntry[] = BUILTIN_IMPORTERS) {
    this.importers = importers.map((entry) => ({
      ...entry,
      acceptedFormats: [...entry.acceptedFormats],
      normalizationNotes: [...entry.normalizationNotes],
      inspectMethods: [...entry.inspectMethods]
    }));
  }

  listImporters(): ImporterRegistryEntry[] {
    return this.importers.map((entry) => ({
      ...entry,
      acceptedFormats: [...entry.acceptedFormats],
      normalizationNotes: [...entry.normalizationNotes],
      inspectMethods: [...entry.inspectMethods]
    }));
  }

  getImporter(sourceKind: ImportSourceKind): ImporterRegistryEntry | undefined {
    const match = this.importers.find((entry) => entry.sourceKind === sourceKind);

    return match
      ? {
          ...match,
          acceptedFormats: [...match.acceptedFormats],
          normalizationNotes: [...match.normalizationNotes],
          inspectMethods: [...match.inspectMethods]
        }
      : undefined;
  }

  buildSourceCatalog(): ImportSourceCatalog {
    return {
      version: IMPORT_SOURCE_CATALOG_VERSION,
      generatedAt: new Date().toISOString(),
      importers: this.listImporters(),
      supportedSourceKinds: [...new Set(this.importers.map((entry) => entry.sourceKind))]
    };
  }
}

export function buildDefaultImporterRegistry(): ImporterRegistry {
  return new ImporterRegistry(BUILTIN_IMPORTERS);
}
