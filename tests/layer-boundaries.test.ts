import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import * as runtime from '@openclaw-compact-context/runtime-core/runtime';
import * as contextProcessing from '@openclaw-compact-context/runtime-core/context-processing';
import * as governance from '@openclaw-compact-context/runtime-core/governance';
import * as infrastructure from '@openclaw-compact-context/runtime-core/infrastructure';
import * as adapters from '@openclaw-compact-context/openclaw-adapter';
import * as openclawAdapter from '@openclaw-compact-context/openclaw-adapter/openclaw/context-engine-adapter';
import * as openclawArtifacts from '@openclaw-compact-context/openclaw-adapter/openclaw/tool-result-artifact-store';
import * as controlPlaneCore from '@openclaw-compact-context/control-plane-core';
import * as controlPlaneShell from '@openclaw-compact-context/control-plane-shell';
import * as contracts from '@openclaw-compact-context/contracts';
import * as runtimeCore from '@openclaw-compact-context/runtime-core';

test('layer boundaries expose runtime, context-processing, governance, infrastructure, adapters, and control-plane entrypoints', () => {
  assert.equal(typeof runtime.ContextEngine, 'function');
  assert.equal(typeof runtime.IngestPipeline, 'function');

  assert.equal(typeof contextProcessing.processContextRecord, 'function');
  assert.equal(typeof contextProcessing.parseContextRecordUtterance, 'function');

  assert.equal(typeof governance.assessPromotedKnowledgeGovernance, 'function');
  assert.equal(typeof governance.assessHigherScopeRecallAdmission, 'function');

  assert.equal(typeof infrastructure.InMemoryGraphStore, 'function');
  assert.equal(typeof infrastructure.readCompressedToolResultMetadata, 'function');

  assert.equal('normalizePluginConfig' in adapters, false);
  assert.equal(typeof openclawAdapter.normalizePluginConfig, 'function');
  assert.equal(typeof openclawArtifacts.ToolResultArtifactStore, 'function');
  assert.equal(typeof controlPlaneCore.ControlPlaneFacade, 'function');
  assert.equal(typeof controlPlaneCore.ImportService, 'function');
  assert.equal(typeof controlPlaneCore.ImporterRegistry, 'function');
  assert.equal(typeof controlPlaneCore.PlatformExtensionRegistry, 'function');
  assert.equal(typeof controlPlaneCore.AutonomyService, 'function');
  assert.equal(typeof controlPlaneCore.WorkspaceCatalogService, 'function');
  assert.equal(typeof controlPlaneCore.PlatformEventService, 'function');
  assert.equal(typeof controlPlaneShell.ControlPlaneClient, 'function');
  assert.equal(typeof controlPlaneShell.ControlPlaneHttpServer, 'function');
});

test('workspace entrypoints expose shared contracts and keep shell-only APIs out of core packages', () => {
  assert.equal(typeof contracts.RUNTIME_API_BOUNDARY, 'object');
  assert.equal(typeof runtimeCore.ContextEngine, 'function');
  assert.equal(typeof controlPlaneCore.ControlPlaneFacade, 'function');
  assert.equal('ControlPlaneHttpServer' in controlPlaneCore, false);
  assert.equal('ControlPlaneFacade' in adapters, false);
});

test('internal source files no longer import src/core compatibility shims', async () => {
  const sourceRoot = path.resolve(process.cwd(), 'src');
  const sourceRootExists = await access(sourceRoot)
    .then(() => true)
    .catch(() => false);

  if (!sourceRootExists) {
    assert.equal(sourceRootExists, false);
    return;
  }

  const files = await collectTypescriptFiles(sourceRoot);
  const offenders: string[] = [];

  for (const file of files) {
    const relativePath = path.relative(sourceRoot, file).replace(/\\/g, '/');

    if (relativePath.startsWith('core/') || relativePath === 'tests/layer-boundaries.test.ts') {
      continue;
    }

    const content = await readFile(file, 'utf8');

    if (content.includes('../core/') || content.includes('./core/')) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(offenders, []);
});

async function collectTypescriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true
  });
  const files: string[] = [];

  for (const entry of entries) {
    const resolved = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTypescriptFiles(resolved)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(resolved);
    }
  }

  return files;
}



