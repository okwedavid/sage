/**
 * core/intent/pipeline.ts
 * OWNS: Orchestrates all 5 stages sequentially
 * EXPOSES: process()
 * FORBIDDEN: Direct LLM calls (delegates to submodules)
 */
import { IntentNormalizer } from './normalizer';
import { IntentClassifier } from './classifier';
import { IntentValidator } from './validator';
import { IntentRouter } from './router';
import { IntentSchema } from './schemas';
import { Status } from '../enums';
import { AgentRegistry } from '../../agents/registry';
import { metrics } from '../../services/metrics';

// Workers signal failure by prefixing their reply with one of these markers
// (see general/web/vision workers). Used to classify execution success for
// metrics without throwing through the pipeline. Narrow patterns avoid false
// positives for legitimate replies that merely begin with a warning glyph.
const WORKER_ERROR_PREFIX =
  /^(❌ \[|⚠️ \*\*Vision Analysis Unavailable\*\*|⚠️ Could not fetch|\[[^\]]*ERROR\])/;

export interface PipelineStage {
  name: string;
  success: boolean;
  detail: string;
}

export interface PipelineResult {
  intent: IntentSchema | null;
  response: string | null;
  agent: string | null;
  success: boolean;
  stages: PipelineStage[];
}

export class IntentPipeline {
  private normalizer: IntentNormalizer;
  private classifier: IntentClassifier;
  private validator: IntentValidator;
  private router: IntentRouter;

  constructor(apiKey: string, registry: AgentRegistry, customModel?: string) {
    this.normalizer = new IntentNormalizer();
    this.classifier = new IntentClassifier(apiKey, customModel);
    this.validator = new IntentValidator();
    this.router = new IntentRouter(registry);
    console.log('✅ [Pipeline] All subsystems initialized');
  }

  async process(
    rawInput: string,
    attachments: Record<string, any> = {},
    memory?: string
  ): Promise<PipelineResult> {
    const result: PipelineResult = {
      intent: null,
      response: null,
      agent: null,
      success: false,
      stages: [],
    };

    try {
      // Stage 1: Normalize
      console.log('\n📝 [Stage 1/5] Normalizing...');
      const clean = this.normalizer.normalize(rawInput);
      result.stages.push({ name: 'normalize', success: true, detail: clean.slice(0, 60) });
      console.log(`   → "${clean.slice(0, 60)}..."`);

      // Stage 2: Classify
      console.log('🧠 [Stage 2/5] Classifying...');
      let intent = await this.classifier.classify(clean);
      // Memory hook: attach conversation history to the intent so workers can
      // use it as context (recency-aware, pre-truncated by the caller).
      if (memory && memory.trim()) {
        intent = { ...intent, context: memory.trim() };
      }
      result.stages.push({
        name: 'classify',
        success: true,
        detail: `${intent.taskType} (${(intent.confidenceScore * 100).toFixed(0)}%)`,
      });
      console.log(`   → ${intent.taskType} (${(intent.confidenceScore * 100).toFixed(0)}%)`);

      if (Object.keys(attachments).length > 0) {
        intent = { ...intent, attachments };
        console.log(`   📎 Attachments: ${Object.keys(attachments).join(', ')}`);
      }

      // Stage 3: Validate
      console.log('🔍 [Stage 3/5] Validating...');
      intent = this.validator.validate(intent);
      result.stages.push({
        name: 'validate',
        success: intent.status !== Status.FAILED,
        detail: intent.status,
      });

      if (intent.status === Status.FAILED) {
        result.intent = intent;
        result.response = `Rejected: ${intent.context}`;
        return result;
      }

      // Stage 4: Route
      console.log('🔀 [Stage 4/5] Routing...');
      const { worker, agentName, updatedIntent } = this.router.route(intent);
      intent = updatedIntent;
      result.stages.push({ name: 'route', success: true, detail: agentName });

      // Stage 5: Execute
      console.log(`⚡ [Stage 5/5] Executing via ${agentName}...`);
      intent = { ...intent, status: Status.EXECUTING };

      // Record per-worker execution metrics (latency + success). Failures that
      // throw are counted as errors; error-prefixed replies are counted too.
      const executeStarted = Date.now();
      let responseText: string;
      try {
        responseText = await worker.execute(intent);
      } catch (error: any) {
        metrics.recordWorker(agentName, false, Date.now() - executeStarted);
        throw error;
      }
      metrics.recordWorker(agentName, !WORKER_ERROR_PREFIX.test(responseText), Date.now() - executeStarted);

      intent = { ...intent, status: Status.COMPLETED };
      result.stages.push({ name: 'execute', success: true, detail: 'DONE' });

      result.intent = intent;
      result.response = responseText;
      result.agent = agentName;
      result.success = true;
      console.log(`✅ [Pipeline] Complete: ${intent.status}`);
    } catch (error: any) {
      console.error(`❌ [Pipeline] Failed: ${error.message}`);
      result.response = `System Error: ${error.message}`;
    }

    return result;
  }
}
