/**
 * services/prompts.ts
 * OWNS: Prompt orchestration (AI foundation).
 *
 * Single source of truth for how SAGE builds LLM prompts. All workers should
 * route their prompt construction through here so prompt changes land in one
 * place and stay consistent across workers (and future multimodal agents).
 */
import { TaskType } from '../core/enums';
import { IntentSchema } from '../core/intent/schemas';

export const SAFETY_PREAMBLE =
  'You are SAGE (Systemic Agentic General Engine), a helpful, safe, and accurate AI assistant. ' +
  'If a request is unsafe, illegal, or impossible, decline clearly and offer a safe alternative. ' +
  'Never claim to have performed actions you have not actually performed.';

const TASK_ROLES: Record<string, string> = {
  [TaskType.RESEARCH]: 'You are a deep researcher. Provide structured, factual reports with clear sections, key concepts, and insights. Use markdown formatting.',
  [TaskType.EXPLAIN]: 'You are an expert teacher. Explain clearly with examples, analogies, and structured breakdowns. Use markdown.',
  [TaskType.DEBUG]: 'You are a senior developer. Diagnose errors and provide corrected code with explanations.',
  [TaskType.GENERATE]: 'You are a creative writer. Generate high-quality, engaging text.',
  [TaskType.ANALYZE]: 'You are a critical analyst. Break down pros/cons, patterns, and insights. Be structured.',
  [TaskType.SUMMARIZE]: 'You are a summarization expert. Be concise, complete, and well-structured.',
  [TaskType.BUILD]: 'You are a software engineer. Write clean, production-quality code with comments.',
  [TaskType.PLAN]: 'You are a strategic planner. Create actionable step-by-step plans with milestones.',
  [TaskType.TRANSLATE]: 'You are a professional translator. Preserve meaning and tone.',
  [TaskType.REVIEW]: 'You are a helpful cognitive assistant. Respond naturally and helpfully.',
  [TaskType.CHAT]: 'You are SAGE, a warm, friendly conversational assistant. Keep responses natural, concise, and helpful — no unnecessary structure for casual chat.',
};

export function buildSystemPrompt(taskType: TaskType | string, customRole?: string): string {
  const role = customRole || TASK_ROLES[taskType as string] || 'You are a helpful cognitive assistant.';
  return `${SAFETY_PREAMBLE}\n\n${role}`;
}

export interface BuildUserPromptInput {
  intent: Pick<IntentSchema, 'targetDomain' | 'goal' | 'inputText'> & { context?: string };
  /** Optional extra instructions (e.g. output format directives). */
  extra?: string;
}

/**
 * Build a structured user prompt: domain, goal, request, optional memory
 * context (attached by the pipeline as `intent.context`), optional extra
 * directives.
 */
export function buildUserPrompt(input: BuildUserPromptInput): string {
  const { intent, extra } = input;
  const parts: string[] = [];

  parts.push(`Domain: ${intent.targetDomain || 'General'}`);
  if (intent.goal) parts.push(`Goal: ${intent.goal}`);
  parts.push(`\nRequest: ${intent.inputText || ''}`);

  if (intent.context) {
    parts.push(`\nAdditional context: ${intent.context}`);
  }

  if (extra) {
    parts.push(`\nInstructions: ${extra}`);
  }

  return parts.join('\n');
}
