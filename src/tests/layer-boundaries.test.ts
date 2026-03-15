import test from 'node:test';
import assert from 'node:assert/strict';

import * as runtime from '../runtime/index.js';
import * as contextProcessing from '../context-processing/index.js';
import * as governance from '../governance/index.js';
import * as infrastructure from '../infrastructure/index.js';
import * as adapters from '../adapters/index.js';
import * as controlPlane from '../control-plane/index.js';

test('layer boundaries expose runtime, context-processing, governance, infrastructure, adapters, and control-plane entrypoints', () => {
  assert.equal(typeof runtime.ContextEngine, 'function');
  assert.equal(typeof runtime.IngestPipeline, 'function');

  assert.equal(typeof contextProcessing.processContextRecord, 'function');
  assert.equal(typeof contextProcessing.parseContextRecordUtterance, 'function');

  assert.equal(typeof governance.assessPromotedKnowledgeGovernance, 'function');
  assert.equal(typeof governance.assessHigherScopeRecallAdmission, 'function');

  assert.equal(typeof infrastructure.InMemoryGraphStore, 'function');
  assert.equal(typeof infrastructure.ToolResultArtifactStore, 'function');

  assert.equal(typeof adapters.normalizePluginConfig, 'function');
  assert.equal(typeof controlPlane.ControlPlaneFacade, 'function');
  assert.equal(typeof controlPlane.ImportService, 'function');
  assert.equal(typeof controlPlane.ImporterRegistry, 'function');
  assert.equal(typeof controlPlane.PlatformExtensionRegistry, 'function');
  assert.equal(typeof controlPlane.AutonomyService, 'function');
  assert.equal(typeof controlPlane.WorkspaceCatalogService, 'function');
  assert.equal(typeof controlPlane.PlatformEventService, 'function');
  assert.equal(typeof controlPlane.ControlPlaneClient, 'function');
  assert.equal(typeof controlPlane.ControlPlaneHttpServer, 'function');
});
