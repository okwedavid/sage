/**
 * core/intent/validator.ts
 * OWNS: Post-classification quality assurance
 * EXPOSES: validate()
 */
import { IntentSchema, advanceStatus } from './schemas';
import { Status } from '../enums';
import { Settings } from '../../config/settings';

export class IntentValidator {
  validate(intent: IntentSchema): IntentSchema {
    const errors: string[] = [];

    if (!intent.taskType) {
      errors.push('No task_type assigned');
    }
    if (intent.confidenceScore < Settings.CONFIDENCE_THRESHOLD) {
      errors.push(
        `Confidence too low: ${(intent.confidenceScore * 100).toFixed(0)}% (min: ${(Settings.CONFIDENCE_THRESHOLD * 100).toFixed(0)}%)`
      );
    }
    if (!intent.targetDomain?.trim()) {
      errors.push('No target_domain identified');
    }

    if (errors.length > 0) {
      console.log(`❌ [Validator] REJECTED: ${errors.join(', ')}`);
      return {
        ...intent,
        status: Status.FAILED,
        context: `Validation failed: ${errors.join('; ')}`,
      };
    }

    console.log(`✅ [Validator] APPROVED (${(intent.confidenceScore * 100).toFixed(0)}%)`);
    return advanceStatus(intent, Status.VALIDATED);
  }
}
