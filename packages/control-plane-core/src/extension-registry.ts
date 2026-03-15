import {
  type ExtensionRegistryContract,
  type ImporterRegistryContract,
  type PlatformCapabilityManifest,
  type PlatformExtensionCapability,
  type PlatformExtensionManifest,
  type PlatformExtensionNegotiationResult,
  type PlatformSigningStatus
} from './contracts.js';

const HOST_EXTENSION_API_VERSION = 'control-plane-extension.v1';
const HOST_PLATFORM_VERSION = 'stage-9.v1';

const HOST_CAPABILITIES: readonly PlatformExtensionCapability[] = [
  'import_job_runner',
  'governance_policy',
  'observability_metric',
  'workspace_view',
  'event_consumer',
  'sdk_client'
] as const;

const BUILTIN_CORE_EXTENSIONS: readonly PlatformExtensionManifest[] = [
  {
    id: 'builtin.governance.core',
    label: 'Builtin Governance Core',
    description: 'Built-in governance proposal, review, apply, rollback, and global lifecycle policies.',
    kind: 'governance',
    source: 'builtin',
    version: 'stage-9.v1',
    apiVersion: HOST_EXTENSION_API_VERSION,
    providerNeutral: true,
    capabilities: ['governance_policy', 'workspace_view'],
    status: 'active',
    signature: 'sig:builtin-governance-core'
  },
  {
    id: 'builtin.observability.core',
    label: 'Builtin Observability Core',
    description: 'Built-in dashboard, history, thresholds, subscriptions, and release comparison surfaces.',
    kind: 'observability',
    source: 'builtin',
    version: 'stage-9.v1',
    apiVersion: HOST_EXTENSION_API_VERSION,
    providerNeutral: true,
    capabilities: ['observability_metric', 'event_consumer'],
    status: 'active',
    signature: 'sig:builtin-observability-core'
  }
] as const;

export class PlatformExtensionRegistry implements ExtensionRegistryContract {
  private readonly hostManifest: PlatformCapabilityManifest = {
    apiVersion: HOST_EXTENSION_API_VERSION,
    platformVersion: HOST_PLATFORM_VERSION,
    providerNeutral: true,
    capabilities: [...HOST_CAPABILITIES]
  };

  private readonly manifests = new Map<string, PlatformExtensionManifest>();

  constructor(importerRegistry: ImporterRegistryContract, initialExtensions: readonly PlatformExtensionManifest[] = []) {
    for (const manifest of BUILTIN_CORE_EXTENSIONS) {
      this.manifests.set(manifest.id, cloneManifest(manifest));
    }

    for (const importer of importerRegistry.listImporters()) {
      this.manifests.set(`builtin.importer.${importer.id}`, {
        id: `builtin.importer.${importer.id}`,
        label: importer.label,
        description: importer.description,
        kind: 'importer',
        source: 'builtin',
        version: importer.versionStrategy,
        apiVersion: HOST_EXTENSION_API_VERSION,
        providerNeutral: true,
        capabilities: ['import_job_runner'],
        status: 'active',
        signature: `sig:${importer.id}`,
        testContract: importer.inspectMethods.join(', ')
      });
    }

    for (const manifest of initialExtensions) {
      this.manifests.set(manifest.id, cloneManifest(manifest));
    }
  }

  getHostManifest(): PlatformCapabilityManifest {
    return {
      ...this.hostManifest,
      capabilities: [...this.hostManifest.capabilities]
    };
  }

  listExtensions(): PlatformExtensionManifest[] {
    return [...this.manifests.values()].map(cloneManifest);
  }

  registerExtension(input: Omit<PlatformExtensionManifest, 'status'> & { status?: PlatformExtensionManifest['status'] }): PlatformExtensionManifest {
    const manifest: PlatformExtensionManifest = {
      ...input,
      capabilities: [...input.capabilities],
      providerNeutral: input.providerNeutral === true,
      status: input.status ?? 'active'
    };
    this.manifests.set(manifest.id, manifest);
    return cloneManifest(manifest);
  }

  negotiateExtension(input: {
    extensionId: string;
    requestedApiVersion: string;
    requiredCapabilities?: readonly PlatformExtensionCapability[];
  }): PlatformExtensionNegotiationResult {
    const manifest = this.manifests.get(input.extensionId);

    if (!manifest) {
      return {
        extensionId: input.extensionId,
        requestedApiVersion: input.requestedApiVersion,
        compatible: false,
        missingCapabilities: [...(input.requiredCapabilities ?? [])],
        warnings: ['extension is not registered'],
        signingStatus: 'unsigned'
      };
    }

    const missingCapabilities = (input.requiredCapabilities ?? []).filter(
      (capability) => !manifest.capabilities.includes(capability)
    );
    const compatible = manifest.status === 'active' && manifest.apiVersion === input.requestedApiVersion && missingCapabilities.length === 0;
    const warnings: string[] = [];

    if (!manifest.providerNeutral) {
      warnings.push('extension is not marked provider-neutral');
    }
    if (manifest.status !== 'active') {
      warnings.push(`extension status is ${manifest.status}`);
    }
    if (manifest.apiVersion !== input.requestedApiVersion) {
      warnings.push(`requested api ${input.requestedApiVersion} does not match manifest api ${manifest.apiVersion}`);
    }

    return {
      extensionId: manifest.id,
      requestedApiVersion: input.requestedApiVersion,
      compatible,
      ...(compatible ? { negotiatedApiVersion: manifest.apiVersion } : {}),
      missingCapabilities,
      warnings,
      signingStatus: resolveSigningStatus(manifest.signature)
    };
  }
}

export function buildDefaultExtensionRegistry(importerRegistry: ImporterRegistryContract): PlatformExtensionRegistry {
  return new PlatformExtensionRegistry(importerRegistry);
}

function cloneManifest(manifest: PlatformExtensionManifest): PlatformExtensionManifest {
  return {
    ...manifest,
    capabilities: [...manifest.capabilities]
  };
}

function resolveSigningStatus(signature: string | undefined): PlatformSigningStatus {
  if (!signature) {
    return 'unsigned';
  }
  if (signature.startsWith('sig:')) {
    return 'trusted';
  }
  return signature.startsWith('sha256:') ? 'unverified' : 'unsigned';
}
