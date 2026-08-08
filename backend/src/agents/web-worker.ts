/**
 * agents/web-worker.ts
 * OWNS: URL fetching + web analysis
 * EXPOSES: execute()
 */
import Groq from 'groq-sdk';
import * as cheerio from 'cheerio';
import { BaseWorker } from './base-worker';
import { IntentSchema } from '../core/intent/schemas';
import { Settings } from '../config/settings';
import { withRetry } from '../services/retry';
import { buildSystemPrompt } from '../services/prompts';
import { TaskType } from '../core/enums';
import { ChatGateway } from '../providers/gateway';

export class WebWorker implements BaseWorker {
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

  private async complete(messages: any[], temperature: number, maxTokens: number): Promise<string> {
    if (this.gateway) {
      const res = await this.gateway.complete(
        messages as any,
        { temperature, maxTokens, signal: AbortSignal.timeout(Settings.GROQ_TIMEOUT_MS) }
      );
      return res.content;
    }
    const response = await withRetry(
      () =>
        this.groq().chat.completions.create(
          {
            model: this.model,
            messages,
            temperature,
            max_tokens: maxTokens,
          },
          { signal: AbortSignal.timeout(Settings.GROQ_TIMEOUT_MS) }
        ),
      { attempts: 2 }
    );
    return response.choices[0].message.content || '';
  }

  private extractUrls(text: string): string[] {
    const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi);
    return matches || [];
  }

  private async fetchPage(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove noise elements
      $('script, style, nav, header, footer, aside, form, iframe, noscript').remove();

      const text = $('body').text();
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length >= 20);

      // Dedupe
      const unique = [...new Set(lines)];
      return unique.join('\n').slice(0, 4000);
    } catch (error: any) {
      return `[FETCH ERROR] ${error.message}`;
    }
  }

  async execute(intent: IntentSchema): Promise<string> {
    const urls = this.extractUrls(intent.inputText);
    if (urls.length === 0) return this.fallback(intent);

    const url = urls[0];
    console.log(`🌐 [WebWorker] Fetching: ${url}`);
    const content = await this.fetchPage(url);

    if (content.startsWith('[FETCH ERROR]') || content.startsWith('[ERROR]')) {
      return `⚠️ Could not fetch ${url}\n\n${content}\n\nFalling back to knowledge synthesis:\n\n${await this.fallback(intent)}`;
    }

    try {
      const answer = await this.complete(
        [
          {
            role: 'system',
            content: buildSystemPrompt(
              TaskType.RESEARCH,
              'You are SAGE-WebAnalyst, a web intelligence specialist. Analyze web content deeply. Structure your answer with: Summary, Key Insights, Detailed Analysis. Use markdown with headers and bullets.'
            ),
          },
          {
            role: 'user',
            content: `${intent.context ? `ADDITIONAL CONTEXT:\n${intent.context}\n\n` : ''}USER QUESTION: ${intent.inputText}\n\nSOURCE URL: ${url}\n\nPAGE CONTENT:\n${content}\n\nTask: Provide Web Intelligence Report.`,
          },
        ],
        0.3,
        1500
      );
      return `🌐 **Source:** [${url}](${url})\n\n---\n\n${answer}`;
    } catch (error: any) {
      return `[WebWorker ERROR] ${error.message}\n\nFallback: ${await this.fallback(intent)}`;
    }
  }

  private async fallback(intent: IntentSchema): Promise<string> {
    try {
      return await this.complete(
        [
          {
            role: 'system',
            content: buildSystemPrompt(
              TaskType.RESEARCH,
              'You are SAGE research assistant. Provide structured factual reports.'
            ),
          },
          { role: 'user', content: intent.context ? `${intent.context}\n\n${intent.inputText}` : intent.inputText },
        ],
        0.7,
        Settings.MAX_TOKENS
      );
    } catch (error: any) {
      return `[WebWorker Fallback ERROR] ${error.message}`;
    }
  }
}
