/**
 * providers/adapters/base.ts
 * OWNS: The ProviderAdapter contract + shared helpers for OpenAI-compatible
 * APIs (Groq, OpenAI, OpenRouter, OpenAI-style self-hosted endpoints).
 *
 * Every adapter must expose: validation, model discovery, capability probing
 * and chat completion — each producing the normalized Sage schema. New
 * providers implement this interface; the core pipeline never changes.
 */
import {
  ChatRequest,
  NormalizedChatResponse,
  NormalizedMessage,
  ModelInfo,
  MalformedProviderError,
} from '../types';

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export interface ProviderAdapter {
  readonly id: string;
  /** How the key is presented to the provider (Bearer vs x-api-key). */
  readonly authHeader: (apiKey: string) => Record<string, string>;
  /** Probe the credential with a minimal real call. */
  validateCredential(apiKey: string, baseUrl?: string): Promise<ValidationResult>;
  /** Fetch the models available to this credential. */
  listModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]>;
  /** Whether a specific model accepts image input (best-effort, conservative). */
  supportsVision(apiKey: string, model: string, baseUrl?: string): Promise<boolean>;
  /** Ordered list of vision-capable models to fall back to. */
  visionModels(apiKey: string, baseUrl?: string): Promise<string[]>;
  /** Normalized chat completion — the ONLY way Sage talks to a provider. */
  chatComplete(req: ChatRequest): Promise<NormalizedChatResponse>;
}

// ── OpenAI-compatible plumbing ───────────────────────────────────────────────

/** Convert normalized messages into the OpenAI content-part shape. */
export function toOpenAiMessages(messages: NormalizedMessage[]): any[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content };
    }
    const parts = m.content.map((part) => {
      if (part.type === 'image') {
        return {
          type: 'image_url',
          image_url: { url: `data:${part.mimeType};base64,${part.base64}` },
        };
      }
      return { type: 'text', text: part.text };
    });
    return { role: m.role, content: parts };
  });
}

/** Build the shared body for any OpenAI-style /chat/completions endpoint. */
export function buildOpenAiBody(req: ChatRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: toOpenAiMessages(req.messages),
    temperature: req.temperature ?? 0.7,
  };
  if (req.maxTokens) body.max_tokens = req.maxTokens;
  if (req.jsonMode) body.response_format = { type: 'json_object' };
  return body;
}

/** Normalize an OpenAI-style completion payload into the Sage schema. */
export function normalizeOpenAiCompletion(
  provider: string,
  raw: any,
  requestedModel: string
): NormalizedChatResponse {
  const choice = Array.isArray(raw?.choices) ? raw.choices[0] : null;
  if (!choice || typeof choice !== 'object') {
    throw new MalformedProviderError(provider, 'missing choices[]');
  }
  const content = extractContentText(provider, choice.message?.content);
  if (content === null) {
    throw new MalformedProviderError(provider, 'empty message content');
  }
  return {
    content,
    model: typeof raw?.model === 'string' && raw.model ? raw.model : requestedModel,
    usage: {
      promptTokens: typeof raw?.usage?.prompt_tokens === 'number' ? raw.usage.prompt_tokens : undefined,
      completionTokens:
        typeof raw?.usage?.completion_tokens === 'number' ? raw.usage.completion_tokens : undefined,
    },
    metadata: raw?.provider ? { provider: raw.provider } : undefined,
  };
}

/**
 * content may be a string (text) or an array of typed parts (tool-call era).
 * Safely extract text; refuse to fabricate content.
 */
export function extractContentText(provider: string, content: any): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textParts = content
      .filter((p) => p && typeof p === 'object' && p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text);
    if (textParts.length > 0) return textParts.join('\n');
    return null;
  }
  return null;
}

/** Parse a JSON payload defensively; wrap non-JSON as a malformed error. */
export async function parseJsonBody(provider: string, res: Response): Promise<any> {
  let raw: any;
  try {
    raw = await res.json();
  } catch {
    throw new MalformedProviderError(provider, 'non-JSON response body');
  }
  return raw;
}

/** Build a uniform error message from an OpenAI-style error payload. */
export function openAiErrorMessage(raw: any, fallback: string): string {
  const err = raw?.error;
  if (typeof err === 'string') return err.slice(0, 300);
  if (err && typeof err === 'object') {
    const msg = err.message;
    if (typeof msg === 'string') return msg.slice(0, 300);
  }
  return fallback;
}

export function isJsonModeSupportedByBody(jsonMode: boolean, messages: NormalizedMessage[]): boolean {
  // Some providers disallow response_format with image content parts.
  if (!jsonMode) return false;
  return messages.every((m) => typeof m.content === 'string' || m.content.every((p) => p.type === 'text'));
}

/** Cheap magic-byte MIME sniffing for base64 image payloads. */
export function sniffMimeType(base64: string): string | null {
  try {
    // Decode up to 24 bytes — enough for the RIFF/WEBP header at offset 8.
    const first = Buffer.from(base64.slice(0, 32), 'base64');
    if (first.length < 4) return null;
    if (first[0] === 0xff && first[1] === 0xd8 && first[2] === 0xff) return 'image/jpeg';
    if (first[0] === 0x89 && first[1] === 0x50 && first[2] === 0x4e && first[3] === 0x47) return 'image/png';
    if (first[0] === 0x47 && first[1] === 0x49 && first[2] === 0x46 && first[3] === 0x38) return 'image/gif';
    // RIFF....WEBP (webp container: 'RIFF' at 0, size at 4, 'WEBP' at 8).
    if (
      first.length >= 12 &&
      first[0] === 0x52 && first[1] === 0x49 && first[2] === 0x46 && first[3] === 0x46 &&
      first[8] === 0x57 && first[9] === 0x45 && first[10] === 0x42 && first[11] === 0x50
    ) {
      return 'image/webp';
    }
    return null;
  } catch {
    return null;
  }
}

export function contentTypeFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpeg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    default: return 'jpeg';
  }
}

// ── Shared HTTP helpers ─────────────────────────────────────────────────────

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Filter a model-id list to those plausibly chat-capable. */
export function filterChatModels(ids: string[]): string[] {
  // Substring match: embeddings, audio/whisper, image gen, rerankers, and
  // completion-only endpoints are not chat LLMs.
  const bad = /embed|audio|whisper|tts|moderation|dall|image|rerank|re-rank|instruct/i;
  return [...new Set(ids.filter((id) => typeof id === 'string' && id.trim() && !bad.test(id)))].sort();
}
