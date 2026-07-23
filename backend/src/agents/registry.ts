/**
 * agents/registry.ts
 * OWNS: Plugin-based agent registry (phone book)
 * EXPOSES: registerWorker(), lookup(), getWorker()
 */
import { BaseWorker } from './base-worker';
import { TaskType, OutputFormat } from '../core/enums';

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

  lookup(taskType: TaskType, outputFormat: OutputFormat): WorkerResult {
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
