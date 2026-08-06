/**
 * agents/index.ts — barrel export
 *
 * Side-effect imports register platform plugins (see docs/PLUGIN_ARCHITECTURE.md).
 * A plugin that is not ready to serve intents yet declares status: 'planned'
 * and only surfaces in /api/agents until its worker lands.
 */
export type { BaseWorker } from './base-worker';
export { AgentRegistry } from './registry';
export { GeneralWorker } from './general-worker';
export { WebWorker } from './web-worker';
export { VisionWorker } from './vision-worker';
export { registerPlugin, getPlugin, listPlugins, listPluginManifests } from './plugin';

import './plugins/agentfinance';
