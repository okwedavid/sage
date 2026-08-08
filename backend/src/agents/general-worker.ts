/**
 * agents/general-worker.ts
 * OWNS: Text-based LLM worker (Groq)
 * EXPOSES: execute()
 */
import Groq from 'groq-sdk';
import { BaseWorker } from './base-worker';
import { IntentSchema } from '../core/intent/schemas';
import { Settings } from '../config/settings';
import { withRetry } from '../services/retry';
import { buildSystemPrompt, buildUserPrompt } from '../services/prompts';
import { ChatGateway } from '../providers/gateway';

export class GeneralWorker implements BaseWorker {
  private client: Groq | null = null;
  private model: string;
  private gateway?: ChatGateway;

  constructor(apiKey: string, customModel?: string, gateway?: ChatGateway) {
    this.gateway = gateway;
    this.model = gateway ? gateway.model : customModel || Settings.DEFAULT_MODEL;
    if (!gateway) {
      this.client = new Groq({ apiKey: apiKey.trim() });
    }
  }

  private groq(): Groq {
    if (!this.client) throw new Error('Groq client unavailable');
    return this.client;
  }

  async execute(intent: IntentSchema): Promise<string> {
    console.log(`🔨 [GeneralWorker] ${intent.taskType} using ${this.model}`);

    const systemPrompt = buildSystemPrompt(intent.taskType);
    const userPrompt = buildUserPrompt({ intent });

    try {
      if (this.gateway) {
        const res = await this.gateway.complete(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          { temperature: 0.7, maxTokens: Settings.MAX_TOKENS, signal: AbortSignal.timeout(Settings.GROQ_TIMEOUT_MS) }
        );
        return res.content;
      }

      const response = await withRetry(
        () =>
          this.groq().chat.completions.create(
            {
              model: this.model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.7,
              max_tokens: Settings.MAX_TOKENS,
            },
            { signal: AbortSignal.timeout(Settings.GROQ_TIMEOUT_MS) }
          ),
        { attempts: 2 }
      );
      return response.choices[0].message.content || '';
    } catch (error: any) {
      return `❌ [GeneralWorker ERROR] ${error.message}`;
    }
  }
}
