/**
 * agents/general-worker.ts
 * OWNS: Text-based LLM worker (Groq)
 * EXPOSES: execute()
 */
import Groq from 'groq-sdk';
import { BaseWorker } from './base-worker';
import { IntentSchema } from '../core/intent/schemas';
import { TaskType } from '../core/enums';
import { Settings } from '../config/settings';

const SYSTEM_ROLES: Record<string, string> = {
  [TaskType.RESEARCH]: 'You are SAGE, a deep researcher. Provide structured, factual reports with clear sections, key concepts, and insights. Use markdown formatting.',
  [TaskType.EXPLAIN]: 'You are SAGE, an expert teacher. Explain clearly with examples, analogies, and structured breakdowns. Use markdown.',
  [TaskType.DEBUG]: 'You are SAGE, a senior developer. Diagnose errors and provide corrected code with explanations.',
  [TaskType.GENERATE]: 'You are SAGE, a creative writer. Generate high-quality, engaging text.',
  [TaskType.ANALYZE]: 'You are SAGE, a critical analyst. Break down pros/cons, patterns, and insights. Be structured.',
  [TaskType.SUMMARIZE]: 'You are SAGE, a summarization expert. Be concise, complete, and well-structured.',
  [TaskType.BUILD]: 'You are SAGE, a software engineer. Write clean, production-quality code with comments.',
  [TaskType.PLAN]: 'You are SAGE, a strategic planner. Create actionable step-by-step plans with milestones.',
  [TaskType.TRANSLATE]: 'You are SAGE, a professional translator. Preserve meaning and tone.',
  [TaskType.REVIEW]: 'You are SAGE — Systemic Agentic General Engine, a helpful cognitive assistant. Respond naturally and helpfully.',
};

export class GeneralWorker implements BaseWorker {
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey: apiKey.trim() });
  }

  async execute(intent: IntentSchema): Promise<string> {
    console.log(`🔨 [GeneralWorker] ${intent.taskType}`);

    const role = SYSTEM_ROLES[intent.taskType] || 'You are SAGE, a helpful cognitive assistant.';

    let userPrompt = `Domain: ${intent.targetDomain}\nGoal: ${intent.goal}\n\nRequest: ${intent.inputText}`;
    if (intent.context) {
      userPrompt += `\n\nContext: ${intent.context}`;
    }

    try {
      const response = await this.client.chat.completions.create({
        model: Settings.DEFAULT_MODEL,
        messages: [
          { role: 'system', content: role },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: Settings.MAX_TOKENS,
      });
      return response.choices[0].message.content || '';
    } catch (error: any) {
      return `❌ [GeneralWorker ERROR] ${error.message}`;
    }
  }
}
