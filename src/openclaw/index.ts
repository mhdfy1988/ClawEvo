import type { OpenClawPluginDefinition } from './types.js';
import {
  ContextEngineRuntimeManager,
  OpenClawContextEngineAdapter,
  normalizePluginConfig,
  registerGatewayDebugMethods
} from './context-engine-adapter.js';
import { createDefaultPluginControlPlaneBridge } from '../plugin/control-plane-bridge.js';
import { registerLifecycleHooks } from './hook-coordinator.js';

const plugin: OpenClawPluginDefinition = {
  id: 'compact-context',
  name: 'Compact Context Engine',
  description: 'Knowledge-graph-backed context engine with compaction and skill crystallization.',
  version: '0.1.0',
  kind: 'context-engine',
  register(api) {
    const config = normalizePluginConfig(api.pluginConfig);
    const runtime = new ContextEngineRuntimeManager(
      config,
      api.logger,
      api.resolvePath,
      api.runtime?.state?.resolveStateDir ? () => api.runtime?.state?.resolveStateDir?.() : undefined
    );
    const controlPlaneBridge = createDefaultPluginControlPlaneBridge();

    api.registerContextEngine('compact-context', () => {
      return new OpenClawContextEngineAdapter(runtime, config, api.logger);
    });

    registerLifecycleHooks(api, runtime, config, api.logger);

    registerGatewayDebugMethods(runtime, config, api.logger, controlPlaneBridge.facade, (method, handler) => {
      api.registerGatewayMethod(method, handler);
    });
  }
};

export default plugin;
