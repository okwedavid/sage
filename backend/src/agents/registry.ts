/**
 * agents/registry.ts
 * OWNS: Plugin-based agent registry (phone book)
 * EXPOSES: registerWorker(), lookup(), getWorker()
 */
import { BaseWorker } from './base-worker';
import { TaskType, OutputFormat } from '../core/enums';
import { findClaimingPlugin } from './plugin';

interface RegistryEntry {
  [key: string]: string;
}

export interface WorkerResult {
  worker: BaseWorker;
  name: string;
}

export class AgentRegistry {
  private registry: Record<string, RegistryEntry> = {
    [OutputFormat.TEXT]: { default: 'GeneralWorker' },
    [OutputFormat.MARKDOWN]: {
      [TaskType.RESEARCH]: 'WebWorker',
      [TaskType.ANALYZE]: 'WebWorker',
      default: 'GeneralWorker',
    },
    [OutputFormat.PYTHON]: {
      [TaskType.BUILD]: 'GeneralWorker',
      [TaskType.DEBUG]: 'GeneralWorker',
      default: 'GeneralWorker',
    },
    [OutputFormat.IMAGE]: { default: 'ImageWorker' },
    [OutputFormat.VIDEO]: { default: 'VideoWorker' },
    [OutputFormat.PDF]: { default: 'ReportWorker' },
    [OutputFormat.JSON]: { default: 'GeneralWorker' },
    [OutputFormat.HTML]: { default: 'GeneralWorker' },
  };

  private workers: Map<string, BaseWorker> = new Map();

  registerWorker(name: string, worker: BaseWorker): void {
    this.workers.set(name, worker);
    console.log(`   📦 Registered: ${name}`);
  }

  getWorker(name: string): BaseWorker | undefined {
    return this.workers.get(name);
  }

  /**
   * Resolve the worker for an intent. Plugin priority: if a registered plugin
   * claims the task type (+ domain), its worker wins. Otherwise the built-in
   * routing table applies, with GeneralWorker as the universal fallback.
   */
  lookup(taskType: TaskType, outputFormat: OutputFormat, domain?: string): WorkerResult {
    // 1) Plugin claim (extensible platform seam — see agents/plugin.ts)
    const plugin = findClaimingPlugin(taskType, domain);
    if (plugin) {
      let worker = this.workers.get(plugin.manifest.id);
      if (!worker) {
        worker = plugin.createWorker?.();
        if (worker) {
          this.workers.set(plugin.manifest.id, worker);
          console.log(`   🔌 Plugin worker instantiated: ${plugin.manifest.id}`);
        }
      }
      if (worker) {
        return { worker, name: plugin.manifest.id };
      }
    }

    // 2) Built-in routing table
    const fmtReg = this.registry[outputFormat] || {};
    const workerName = fmtReg[taskType] || fmtReg['default'] || 'GeneralWorker';

    let worker = this.workers.get(workerName);
    let resolvedName = workerName;

    if (!worker) {
      worker = this.workers.get('GeneralWorker');
      resolvedName = 'GeneralWorker';
      if (!worker) {
        throw new Error(`No workers available: ${Array.from(this.workers.keys()).join(', ')}`);
      }
    }

    return { worker, name: resolvedName };
  }

  listWorkers(): string[] {
    return Array.from(this.workers.keys());
  }
}
