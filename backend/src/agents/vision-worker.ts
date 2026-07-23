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

    console.log(`📸 Processing image: ${imgName} (type: ${imgType}, size: ~${Math.round(imgB64.length * 0.75 / 1024)}KB)`);

    const question =
      !intent.inputText.trim() ||
      ['[image attached]', 'image attached', '[image uploaded]'].includes(intent.inputText.toLowerCase())
        ? DEFAULT_VISION_QUESTION
        : intent.inputText;

    // Vision-capable models to try
    const modelsToTry = [
      'llama-3.2-11b-vision-preview',  // Most reliable vision model
      'llama-3.2-90b-vision-preview',  // Better quality
      Settings.VISION_MODEL,           // Configured model
      Settings.VISION_FALLBACK,        // Fallback
    ].filter(Boolean) as string[];

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
        console.log(`✅ Vision analysis complete using ${modelId}`);
        return `👁️ **Vision Analysis** — \`${imgName}\` (via \`${modelId}\`)\n\n---\n\n${analysis}`;
      } catch (error: any) {
        lastError = error;
        const errStr = error.message?.toLowerCase() || '';
        console.warn(`⚠️ Model ${modelId} failed: ${error.message}`);
        
        // Try next model on specific errors
        if (errStr.includes('decommissioned') || 
            errStr.includes('not found') || 
            errStr.includes('model') ||
            errStr.includes('not supported')) {
          continue;
        }
        // Break on other errors (auth, rate limit, etc.)
        break;
      }
    }

    const errMsg = lastError?.message || 'Unknown error';
    console.error(`❌ All vision models failed: ${errMsg}`);
    return `⚠️ **Vision Analysis Unavailable**\n\nCould not analyze the image. Error: ${errMsg}\n\nPlease try again or describe the image in text for analysis.`;
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
