/**
 * agents/base-worker.ts
 * OWNS: Abstract base class for all workers
 */
import { IntentSchema } from '../core/intent/schemas';

export interface BaseWorker {
  execute(intent: IntentSchema): Promise<string>;
}
