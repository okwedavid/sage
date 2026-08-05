/**
 * core/intent/router.ts
 * OWNS: Routes intents to the correct agent
 * EXPOSES: route()
 */
import { IntentSchema, advanceStatus } from './schemas';
import { Status } from '../enums';
import { AgentRegistry } from '../../agents/registry';

export class IntentRouter {
  constructor(private registry: AgentRegistry) {}

  route(intent: IntentSchema): { worker: any; agentName: string; updatedIntent: IntentSchema } {
    if (intent.status !== Status.VALIDATED) {
      throw new Error(`Cannot route '${intent.status}'. Expected: VALIDATED`);
    }

    // Priority 1: Image attachments → VisionWorker
    if (intent.attachments.image_base64) {
      const worker = this.registry.getWorker('VisionWorker');
      if (worker) {
        const updated = { ...advanceStatus(intent, Status.ROUTED), suggestedAgent: 'VisionWorker' };
        console.log(`🔀 [Router] Image → VisionWorker`);
        return { worker, agentName: 'VisionWorker', updatedIntent: updated };
      }
    }

    // Priority 2: Normal routing
    const { worker, name } = this.registry.lookup(intent.taskType, intent.outputFormat);
    const updated = { ...advanceStatus(intent, Status.ROUTED), suggestedAgent: name };
    console.log(`🔀 [Router] → ${name}`);
    return { worker, agentName: name, updatedIntent: updated };
  }
}
