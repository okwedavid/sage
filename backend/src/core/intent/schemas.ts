/**
 * core/intent/schemas.ts
 * OWNS: IntentSchema — the "passport" that travels through the pipeline
 * EXPOSES: IntentSchema interface + factory
 */
import { v4 as uuidv4 } from 'uuid';
import { TaskType, Priority, Status, OutputFormat, canAdvanceStatus } from '../enums';

export interface IntentSchema {
  // Identity
  intentId: string;
  inputText: string;

  // Classification
  taskType: TaskType;
  targetDomain: string;
  confidenceScore: number;
  goal: string;

  // Intelligence
  entities: Record<string, any>;
  constraints: Record<string, any>;
  context: string;
  attachments: Record<string, any>;

  // Execution params
  priority: Priority;
  outputFormat: OutputFormat;
  suggestedAgent: string;

  // Lifecycle
  status: Status;
  createdAt: string;
}

export function createIntent(input: Partial<IntentSchema> & { inputText: string }): IntentSchema {
  if (!input.inputText?.trim()) {
    throw new Error('Intent rejected: inputText cannot be empty');
  }

  const confidence = input.confidenceScore ?? 0.0;
  if (confidence < 0 || confidence > 1) {
    throw new Error(`Intent rejected: confidence must be 0-1, got ${confidence}`);
  }

  return {
    intentId: uuidv4(),
    inputText: input.inputText,
    taskType: input.taskType ?? TaskType.REVIEW,
    targetDomain: input.targetDomain ?? 'General',
    confidenceScore: confidence,
    goal: input.goal ?? '',
    entities: input.entities ?? {},
    constraints: input.constraints ?? {},
    context: input.context ?? '',
    attachments: input.attachments ?? {},
    priority: input.priority ?? Priority.NORMAL,
    outputFormat: input.outputFormat ?? OutputFormat.MARKDOWN,
    suggestedAgent: input.suggestedAgent ?? '',
    status: input.status ?? Status.RECEIVED,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function advanceStatus(intent: IntentSchema, newStatus: Status): IntentSchema {
  if (!canAdvanceStatus(intent.status, newStatus)) {
    throw new Error(`Cannot advance from ${intent.status} to ${newStatus}`);
  }
  return { ...intent, status: newStatus };
}

export function intentToDict(intent: IntentSchema): Record<string, any> {
  return {
    intent_id: intent.intentId,
    input_text: intent.inputText,
    task_type: intent.taskType,
    target_domain: intent.targetDomain,
    goal: intent.goal,
    confidence_score: intent.confidenceScore,
    entities: intent.entities,
    constraints: intent.constraints,
    context: intent.context,
    has_attachments: Object.keys(intent.attachments).length > 0,
    priority: intent.priority,
    output_format: intent.outputFormat,
    suggested_agent: intent.suggestedAgent,
    status: intent.status,
    created_at: intent.createdAt,
  };
}
