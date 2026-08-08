/**
 * providers/adapters/gemini.ts
 * OWNS: Google Gemini adapter (Generative Language API). Gemini models accept
 * images via inline_data parts; capability is name-based and conservative.
 */
import {
  ChatRequest,
  NormalizedChatResponse,
  ModelInfo,
  MalformedProviderError,
} from '../types';
import { ProviderAdapter, ValidationResult, fetchWithTimeout, filterChatModels } from './base';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT = 30000;

function baseUrlFor(): string {
  return `${API}/models`;
}

export const geminiAdapter: ProviderAdapter = {
  id: 'gemini',
  authHeader: (apiKey) => ({ 'x-goog-api-key': apiKey }),

  async validateCredential(apiKey: string): Promise<ValidationResult> {
    try {
      // A 1-token generateContent call validates the key end-to-end.
      const res = await fetchWithTimeout(
        `${baseUrlFor()}/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        },
        TIMEOUT
      );
      if (!res.ok) {
        const raw: any = await res.json().catch(() => ({}));
        const msg = raw?.error?.message || `HTTP ${res.status}`;
        return { ok: false, error: typeof msg === 'string' ? msg.slice(0, 300) : msg };
      }
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'Validation request failed' };
    }
  },

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    const res = await fetchWithTimeout(
      `${baseUrlFor()}?key=${encodeURIComponent(apiKey)}`,
      { headers: { 'x-goog-api-key': apiKey } },
      TIMEOUT
    );
    if (!res.ok) {
      const raw: any = await res.json().catch(() => ({}));
      throw new Error(raw?.error?.message || `Models request failed (HTTP ${res.status})`);
    }
    const raw: any = await res.json().catch(() => null);
    if (!raw || !Array.isArray(raw.models)) {
      throw new MalformedProviderError('gemini', 'models payload missing models[]');
    }
    const ids = filterChatModels(
      raw.models
        .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => String(m.name).replace(/^models\//, ''))
    );
    return ids.map((id) => ({ id, vision: true }));
  },

  async supportsVision(_apiKey: string, model: string, _baseUrl?: string): Promise<boolean> {
    // All Gemini multimodal models accept images (exclude embeddings/rag).
    return /gemini/i.test(model) && !/embedding|aqa|text-embedding/i.test(model);
  },

  async visionModels(_apiKey: string): Promise<string[]> {
    return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.5-flash'];
  },

  async chatComplete(req: ChatRequest): Promise<NormalizedChatResponse> {
    const systemText = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    const nonSystem = req.messages.filter((m) => m.role !== 'system');

    const hasImage = nonSystem.some(
      (m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image')
    );
    if (hasImage && !(await this.supportsVision(req.apiKey, req.model))) {
      throw new MalformedProviderError(
        'gemini',
        `model "${req.model}" does not accept image input (vision not detected)`
      );
    }

    const contents = nonSystem.map((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts = Array.isArray(m.content)
        ? m.content.map((part) =>
            part.type === 'image'
              ? { inline_data: { mime_type: part.mimeType, data: part.base64 } }
              : { text: part.text }
          )
        : [{ text: m.content }];
      return { role, parts };
    });

    const body: Record<string, unknown> = { contents };
    if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
    const genConfig: Record<string, unknown> = {};
    if (req.temperature !== undefined) genConfig.temperature = req.temperature;
    if (req.maxTokens) genConfig.maxOutputTokens = req.maxTokens;
    if (req.jsonMode) genConfig.responseMimeType = 'application/json';
    if (Object.keys(genConfig).length) body.generationConfig = genConfig;

    const res = await fetchWithTimeout(
      `${baseUrlFor()}/${req.model}:generateContent?key=${encodeURIComponent(req.apiKey)}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
      TIMEOUT
    );
    if (!res.ok) {
      const raw: any = await res.json().catch(() => ({}));
      const msg = raw?.error?.message || `HTTP ${res.status}`;
      throw new Error(typeof msg === 'string' ? msg.slice(0, 300) : msg);
    }
    const raw: any = await res.json().catch(() => null);
    const text = raw?.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p && typeof p.text === 'string')
      .map((p: any) => p.text)
      .join('\n');
    if (typeof text !== 'string' || !text.trim()) {
      throw new MalformedProviderError('gemini', 'empty candidates[0].content text');
    }
    return {
      content: text,
      model: req.model,
      usage: {
        promptTokens: raw?.usageMetadata?.promptTokenCount,
        completionTokens: raw?.usageMetadata?.candidatesTokenCount,
      },
    };
  },
};
