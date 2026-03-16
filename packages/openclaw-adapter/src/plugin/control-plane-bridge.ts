import type { ControlPlaneFacadeContract } from '@openclaw-compact-context/contracts';

export interface PluginControlPlaneBridge {
  facade: ControlPlaneFacadeContract;
}

export function createPluginControlPlaneBridge(facade: ControlPlaneFacadeContract): PluginControlPlaneBridge {
  return {
    facade
  };
}
