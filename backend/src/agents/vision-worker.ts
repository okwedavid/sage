/**
 * agents/vision-worker.ts
 * OWNS: Image analysis via multimodal LLM
 * EXPOSES: execute()
 */
import Groq from 'groq-sdk';
import { BaseWorker } from './base-worker';
import { IntentSchema } from '../core/intent/schemas';
import { Settings } from '../config/settings';

const DEFAULT_VISION_QUESTION =
  'Analyze this image in detail. Describe what you see, key components, and provide insights. If it\'s a diagram, explain the architecture/flow.';

export class VisionWorker implements BaseWorker {
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey: apiKey.trim() });
  }

  async execute(intent: IntentSchema): Promise<string> {
    console.log('👁️ [VisionWorker] Analyzing...');

    const imgB64 = intent.attachments.image_base64;
    const imgType = intent.attachments.image_type || 'jpeg';
    const imgName = intent.attachments.image_name || 'uploaded image';

    if (!imgB64) {
      console.log('⚠️ VisionWorker: No image_base64, falling back');
      return this.fallback(intent);
    }

    const question =
      !intent.inputText.trim() ||
      ['[image uploaded]', 'image attached'].includes(intent.inputText.toLowerCase())
        ? DEFAULT_VISION_QUESTION
        : intent.inputText;

    const modelsToTry = [
      Settings.VISION_MODEL,
      Settings.VISION_FALLBACK,
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-3.2-90b-vision-preview',
    ].filter(Boolean);

    let lastError: any = null;

    for (const modelId of modelsToTry) {
      try {
        console.log(`👁️ Trying vision model: ${modelId}`);
        const response = await this.client.chat.completions.create({
          model: modelId,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: question },
                { type: 'image_url', image_url: { url: `data:image/${imgType};base64,${imgB64}` } },
              ],
            },
          ],
          temperature: 0.3,
          max_tokens: Settings.VISION_MAX_TOKENS,
        });

        const analysis = response.choices[0].message.content || '';
        return `👁️ **Vision Analysis** — \`${imgName}\` (via \`${modelId}\`)\n\n---\n\n${analysis}`;
      } catch (error: any) {
        lastError = error;
        const errStr = error.message?.toLowerCase() || '';
        if (errStr.includes('decommissioned') || errStr.includes('not found') || errStr.includes('model')) {
          console.log(`⚠️ Model ${modelId} failed: ${error.message} — trying next`);
          continue;
        }
        break;
      }
    }

    const errMsg = lastError?.message || 'Unknown';
    return `⚠️ All vision models failed. Last error: ${errMsg}`;
  }

  private async fallback(intent: IntentSchema): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: Settings.DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are SAGE Vision assistant. User wanted image analysis but no image was processed. Be helpful.',
          },
          { role: 'user', content: intent.inputText },
        ],
        temperature: 0.7,
        max_tokens: Settings.MAX_TOKENS,
      });
      return response.choices[0].message.content || '';
    } catch (error: any) {
      return `[VisionWorker Fallback ERROR] ${error.message}`;
    }
  }
}
