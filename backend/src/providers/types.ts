/**
 * providers/types.ts
 * OWNS: The provider domain model — the contract every provider adapter must
 * speak. All provider responses are normalized into `NormalizedChatResponse`
 * here, so the rest of SAGE never needs to know which provider produced a
 * reply (Phase 3: unified model schema).
 */

/** Stable identifiers for supported providers. */
export type ProviderId =
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'openai-compatible';

/** Static catalog metadata shown to users in the settings UI. */
export interface ProviderCatalogEntry {
  id: ProviderId;
  label: string;
  description: string;
  /** Whether a custom base URL is required to use this provider. */
  requiresBaseUrl: boolean;
  /** Whether the user can declare image support for custom endpoints. */
  configurableVision: boolean;
  /** Sensible default model used for credential validation. */
  defaultModel: string;
  /** Known vision-capable models (used for capability detection). */
  defaultVisionModels: string[];
  docsUrl: string;
}

export interface ModelInfo {
  id: string;
  label?: string;
  /** Best-effort signal of image input support (never assumed — derived). */
  vision?: boolean;
  /** Max context window reported by the provider, when available. */
  contextWindow?: number;
  /** Raw provider metadata (kept opaque; may be empty). */
  raw?: Record<string, unknown>;
}

/** A normalized chat message part. Mirrors the OpenAI content-part shape. */
export type NormalizedContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; base64: string; mimeType: string };

export type NormalizedRole = 'system' | 'user' | 'assistant';

export interface NormalizedMessage {
  role: NormalizedRole;
  content: string | NormalizedContentPart[];
}

export interface ChatRequest {
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: NormalizedMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Provider-specific JSON-mode hint (response_format, responseMimeType…). */
  jsonMode?: boolean;
  signal?: AbortSignal;
}

export interface ChatUsage {
  promptTokens?: number;
  completionTokens?: number;
}

/** The SINGLE normalized response shape flowing out of every adapter. */
export interface NormalizedChatResponse {
  content: string;
  model: string;
  usage?: ChatUsage;
  /** Optional extra data surfaced by some providers (e.g. OpenRouter). */
  metadata?: Record<string, unknown>;
}

/** Error thrown when the selected model cannot process images. */
export class UnsupportedVisionError extends Error {
  constructor(model: string, provider: string) {
    super(`Model "${model}" for provider "${provider}" does not support image input.`);
    this.name = 'UnsupportedVisionError';
  }
}

/** Error thrown when a provider endpoint returns a malformed payload. */
export class MalformedProviderError extends Error {
  constructor(provider: string, detail: string) {
    super(`Malformed response from provider "${provider}": ${detail}`);
    this.name = 'MalformedProviderError';
  }
}

/** A gateway description attached to intents so downstream UI can show it. */
export interface ModelDescriptor {
  provider: ProviderId | 'default';
  model: string;
  vision: boolean;
}
