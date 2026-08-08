/**
 * agents/vision-worker.ts
 * OWNS: Image analysis via a vision-capable model.
 *
 * Phase 4 behavior:
 *  - Receives a validated image (chat route enforces format + magic bytes).
 *  - Routes to a vision-capable model: the user's selected provider/model when
 *    it supports images, otherwise the provider's known vision models, else a
 *    clear "model cannot see images" message. Vision capability is DETECTED —
 *    never fabricated for text-only models.
 *  - Without a user provider (default server Groq), falls back to the existing
 *    multi-model vision list.
 */
import Groq from 'groq-sdk';
import { BaseWorker } from './base-worker';
import { IntentSchema } from '../core/intent/schemas';
import { Settings } from '../config/settings';
import { withRetry } from '../services/retry';
import { buildSystemPrompt } from '../services/prompts';
import { TaskType } from '../core/enums';
import { ChatGateway } from '../providers/gateway';
import { sniffMimeType } from '../providers/adapters/base';

const DEFAULT_VISION_QUESTION =
  'Analyze this image in detail. Describe what you see, key components, and provide insights. If it\'s a diagram, explain the architecture/flow.';

/** Map a declared/claimed image type to a MIME type (defensive). */
function claimedMime(imgType: string): string | null {
  switch ((imgType || '').toLowerCase().replace(/^\./, '')) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return null;
  }
}

export class VisionWorker implements BaseWorker {
  private client: Groq | null = null;
  private gateway?: ChatGateway;

  constructor(apiKey: string, gateway?: ChatGateway) {
    this.gateway = gateway;
    if (!gateway) {
      this.client = new Groq({ apiKey: apiKey.trim() });
    }
  }

  private groq(): Groq {
    if (!this.client) throw new Error('Groq client unavailable');
    return this.client;
  }

  private resolveImage(intent: IntentSchema): { base64: string; mimeType: string; name: string } | null {
    const imgB64 = intent.attachments.image_base64;
    if (!imgB64) return null;
    // Trust actual bytes over any client-claimed type (defense in depth).
    const snuffed = sniffMimeType(imgB64);
    const claimed = claimedMime(intent.attachments.image_type);
    const mimeType = snuffed || claimed || 'image/jpeg';
    return {
      base64: imgB64,
      mimeType,
      name: typeof intent.attachments.image_name === 'string' ? intent.attachments.image_name : 'uploaded image',
    };
  }

  async execute(intent: IntentSchema): Promise<string> {
    console.log('👁️ [VisionWorker] Analyzing...');

    const img = this.resolveImage(intent);
    if (!img) {
      console.log('⚠️ VisionWorker: No image_base64, falling back');
      return this.fallback(intent);
    }

    const sizeKb = Math.round((img.base64.length * 0.75) / 1024);
    console.log(`📸 Processing image: ${img.name} (type: ${img.mimeType}, size: ~${sizeKb}KB)`);

    const question =
      !intent.inputText.trim() ||
      ['[image attached]', 'image attached', '[image uploaded]'].includes(intent.inputText.toLowerCase())
        ? DEFAULT_VISION_QUESTION
        : intent.inputText;

    const textPrompt = intent.context ? `${question}\n\nAdditional context:\n${intent.context}` : question;

    // ── User-provider path (capability-detected) ────────────────────────────
    if (this.gateway) {
      return this.analyzeWithGateway(this.gateway, textPrompt, img, intent);
    }

    // ── Default server Groq path (existing multi-model fallback) ────────────
    return this.analyzeWithGroq(textPrompt, img, intent);
  }

  private async analyzeWithGateway(
    gateway: ChatGateway,
    textPrompt: string,
    img: { base64: string; mimeType: string; name: string },
    _intent: IntentSchema
  ): Promise<string> {
    const tried: string[] = [];

    // 1) Selected model if it can see images.
    if (await gateway.supportsVision()) {
      try {
        const res = await gateway.analyzeImage(textPrompt, { base64: img.base64, mimeType: img.mimeType });
        console.log(`✅ Vision analysis complete via ${gateway.providerId}/${gateway.model}`);
        return `👁️ **Vision Analysis** — \`${img.name}\` (via \`${gateway.model}\`)\n\n---\n\n${res.content}`;
      } catch (error: any) {
        tried.push(gateway.model);
        console.warn(`⚠️ Vision via ${gateway.model} failed: ${error.message}`);
      }
    } else {
      tried.push(gateway.model);
    }

    // 2) Provider-known vision models (same provider, different model).
    let visionModels: string[] = [];
    try {
      visionModels = await gateway.visionModels();
    } catch {
      visionModels = [];
    }

    for (const modelId of visionModels) {
      if (modelId === gateway.model) continue;
      if (tried.includes(modelId)) continue;
      try {
        const res = await gateway.withModel(modelId).analyzeImage(textPrompt, { base64: img.base64, mimeType: img.mimeType });
        console.log(`✅ Vision analysis complete via ${gateway.providerId}/${modelId}`);
        return `👁️ **Vision Analysis** — \`${img.name}\` (via \`${modelId}\`)\n\n---\n\n${res.content}`;
      } catch (error: any) {
        tried.push(modelId);
        console.warn(`⚠️ Vision via ${modelId} failed: ${error.message}`);
      }
    }

    return (
      `⚠️ **Vision Analysis Unavailable**\n\n` +
      `Your selected model \`${gateway.model}\` (${gateway.providerId}) does not support image input` +
      (visionModels.length > 0 ? `, and none of the provider's vision models (${visionModels.join(', ')}) could analyze this image` : '') +
      `. Error details: ${tried.length > 0 ? 'all attempts failed' : 'no vision capability detected'}\n\n` +
      `Try selecting a vision-capable model in **Settings → Models & API Providers**, or describe the image in text.`
    );
  }

  private async analyzeWithGroq(
    textPrompt: string,
    img: { base64: string; mimeType: string; name: string },
    _intent: IntentSchema
  ): Promise<string> {
    // Vision-capable models to try (default server path).
    const modelsToTry = [
      'llama-3.2-11b-vision-preview', // Most reliable vision model
      'llama-3.2-90b-vision-preview', // Better quality
      Settings.VISION_MODEL, // Configured model
      Settings.VISION_FALLBACK, // Fallback
    ].filter(Boolean) as string[];

    let lastError: any = null;

    for (const modelId of modelsToTry) {
      try {
        console.log(`👁️ Trying vision model: ${modelId}`);
        const messages = [
          {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: textPrompt },
              {
                type: 'image_url' as const,
                image_url: {
                  url: `data:${img.mimeType};base64,${img.base64}`,
                },
              },
            ],
          },
        ];

        const response = await withRetry(
          () =>
            this.groq().chat.completions.create(
              {
                model: modelId,
                messages: messages as any,
                temperature: 0.3,
                max_tokens: Settings.VISION_MAX_TOKENS,
              },
              { signal: AbortSignal.timeout(Settings.GROQ_TIMEOUT_MS) }
            ),
          { attempts: 2 }
        );

        const analysis = response.choices[0].message.content || '';
        console.log(`✅ Vision analysis complete using ${modelId}`);
        return `👁️ **Vision Analysis** — \`${img.name}\` (via \`${modelId}\`)\n\n---\n\n${analysis}`;
      } catch (error: any) {
        lastError = error;
        const errStr = error.message?.toLowerCase() || '';
        console.warn(`⚠️ Model ${modelId} failed: ${error.message}`);

        if (
          errStr.includes('decommissioned') ||
          errStr.includes('not found') ||
          errStr.includes('model') ||
          errStr.includes('not supported')
        ) {
          continue;
        }
        break;
      }
    }

    const errMsg = lastError?.message || 'Unknown error';
    console.error(`❌ All vision models failed: ${errMsg}`);
    return `⚠️ **Vision Analysis Unavailable**\n\nCould not analyze the image. Error: ${errMsg}\n\nPlease try again or describe the image in text for analysis.`;
  }

  private async fallback(intent: IntentSchema): Promise<string> {
    try {
      if (this.gateway) {
        const res = await this.gateway.complete(
          [
            {
              role: 'system',
              content: buildSystemPrompt(
                TaskType.ANALYZE,
                'You are SAGE Vision assistant. User wanted image analysis but no image was processed. Be helpful.'
              ),
            },
            { role: 'user', content: intent.context ? `${intent.context}\n\n${intent.inputText}` : intent.inputText },
          ],
          { temperature: 0.7, maxTokens: Settings.MAX_TOKENS, signal: AbortSignal.timeout(Settings.GROQ_TIMEOUT_MS) }
        );
        return res.content;
      }
      const response = await withRetry(
        () =>
          this.groq().chat.completions.create(
            {
              model: Settings.DEFAULT_MODEL,
              messages: [
                {
                  role: 'system',
                  content: buildSystemPrompt(
                    TaskType.ANALYZE,
                    'You are SAGE Vision assistant. User wanted image analysis but no image was processed. Be helpful.'
                  ),
                },
                { role: 'user', content: intent.context ? `${intent.context}\n\n${intent.inputText}` : intent.inputText },
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
      return `[VisionWorker Fallback ERROR] ${error.message}`;
    }
  }
}
