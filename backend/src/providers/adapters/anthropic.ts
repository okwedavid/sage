/**
 * providers/adapters/anthropic.ts
 * OWNS: Anthropic adapter (Messages API). All Claude models accept images, so
 * vision capability is name-based and conservative.
 */
import {
  ChatRequest,
  NormalizedChatResponse,
  ModelInfo,
  MalformedProviderError,
} from '../types';
import { ProviderAdapter, ValidationResult, fetchWithTimeout, filterChatModels } from './base';

const API = 'https://api.anthropic.com/v1';
const VERSION = '2023-06-01';
const TIMEOUT = 30000;

function headers(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': VERSION,
    'content-type': 'application/json',
  };
}

function toAnthropicContent(messages: ChatRequest['messages']): { role: string; content: any[] }[] {
  const out: { role: string; content: any[] }[] = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = Array.isArray(m.content)
      ? m.content.map((part) =>
          part.type === 'image'
            ? {
                type: 'image',
                source: { type: 'base64', media_type: part.mimeType, data: part.base64 },
              }
            : { type: 'text', text: part.text }
        )
      : [{ type: 'text', text: m.content }];
    // Anthropic forbids consecutive same-role messages — merge them.
    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.content.push(...content);
    } else {
      out.push({ role, content });
    }
  }
  return out;
}

export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  authHeader: headers,

  async validateCredential(apiKey: string): Promise<ValidationResult> {
    try {
      const res = await fetchWithTimeout(
        `${API}/messages`,
        {
          method: 'POST',
          headers: headers(apiKey),
          body: JSON.stringify({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
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
    const res = await fetchWithTimeout(`${API}/models`, { headers: headers(apiKey) }, TIMEOUT);
    if (!res.ok) {
      const raw: any = await res.json().catch(() => ({}));
      throw new Error(raw?.error?.message || `Models request failed (HTTP ${res.status})`);
    }
    const raw: any = await res.json().catch(() => null);
    if (!raw || !Array.isArray(raw.data)) {
      throw new MalformedProviderError('anthropic', 'models payload missing data[]');
    }
    const ids = filterChatModels(raw.data.map((m: any) => m.id));
    return ids.map((id) => ({ id, vision: /claude/i.test(id) }));
  },

  async supportsVision(_apiKey: string, model: string): Promise<boolean> {
    // Every Claude model released since v3 accepts image input.
    return /claude/i.test(model);
  },

  async visionModels(_apiKey: string): Promise<string[]> {
    return [
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-3-opus-latest',
      'claude-sonnet-4-20250514',
    ];
  },

  async chatComplete(req: ChatRequest): Promise<NormalizedChatResponse> {
    const systemText = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    const nonSystem = req.messages.filter((m) => m.role !== 'system');

    // Image guards — never send images to a model that cannot see them.
    const hasImage = nonSystem.some(
      (m) => Array.isArray(m.content) && m.content.some((p) => p.type === 'image')
    );
    if (hasImage && !(await this.supportsVision(req.apiKey, req.model))) {
      throw new MalformedProviderError(
        'anthropic',
        `model "${req.model}" does not accept image input (vision not detected)`
      );
    }

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens || 1024,
      messages: toAnthropicContent(nonSystem),
    };
    if (systemText) body.system = systemText;
    if (req.temperature !== undefined) body.temperature = req.temperature;

    const res = await fetchWithTimeout(
      `${API}/messages`,
      { method: 'POST', headers: headers(req.apiKey), body: JSON.stringify(body) },
      TIMEOUT
    );
    if (!res.ok) {
      const raw: any = await res.json().catch(() => ({}));
      const msg = raw?.error?.message || `HTTP ${res.status}`;
      throw new Error(typeof msg === 'string' ? msg.slice(0, 300) : msg);
    }
    const raw: any = await res.json().catch(() => null);
    if (!raw || !Array.isArray(raw.content)) {
      throw new MalformedProviderError('anthropic', 'messages payload missing content[]');
    }
    const text = raw.content
      .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
      .map((p: any) => p.text)
      .join('\n');
    if (!text) {
      throw new MalformedProviderError('anthropic', 'empty text content');
    }
    return {
      content: text,
      model: typeof raw.model === 'string' && raw.model ? raw.model : req.model,
      usage: {
        promptTokens: raw.usage?.input_tokens,
        completionTokens: raw.usage?.output_tokens,
      },
    };
  },
};
