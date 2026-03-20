import type { OpenClawPluginApi, OpenClawPluginDefinition } from './types.js';
import type { ControlPlaneFacadeContract } from '@openclaw-compact-context/contracts';
import {
  ContextEngineRuntimeManager,
  OpenClawContextEngineAdapter,
  type NormalizedPluginConfig,
  normalizePluginConfig,
  registerGatewayDebugMethods
} from './context-engine-adapter.js';
import { registerLifecycleHooks } from './hook-coordinator.js';

export interface CreateOpenClawPluginOptions {
  resolveConfig?: (api: OpenClawPluginApi) => NormalizedPluginConfig;
}

export function createOpenClawPlugin(
  facade: ControlPlaneFacadeContract,
  options: CreateOpenClawPluginOptions = {}
): OpenClawPluginDefinition {
  return {
    id: 'compact-context',
    name: 'Compact Context Engine',
    description: 'Knowledge-graph-backed context engine with compaction and skill crystallization.',
    version: '0.1.0',
    kind: 'context-engine',
    register(api) {
      const config = options.resolveConfig?.(api) ?? normalizePluginConfig(api.pluginConfig);
      const runtime = new ContextEngineRuntimeManager(
        config,
        api.logger,
        api.resolvePath,
        api.runtime?.state?.resolveStateDir ? () => api.runtime?.state?.resolveStateDir?.() : undefined
      );

      api.registerContextEngine('compact-context', () => {
        return new OpenClawContextEngineAdapter(runtime, config, api.logger);
      });

      registerLifecycleHooks(api, runtime, config, api.logger);

      registerGatewayDebugMethods(runtime, config, api.logger, facade, (method, handler) => {
        api.registerGatewayMethod(method, handler);
      });
    }
  };
}

export default createOpenClawPlugin;
