/**
 * providers/adapters/openai-compatible.ts
 * OWNS: A single reusable implementation for every OpenAI-style /v1 API.
 *
 * Groq, OpenAI, OpenRouter and custom self-hosted endpoints (Ollama, vLLM,
 * LM Studio, …) all speak the same wire protocol, so one adapter powers all of
 * them — no duplicated business logic per provider (Phase 3 requirement).
 */
import {
  ChatRequest,
  NormalizedChatResponse,
  ModelInfo,
  MalformedProviderError,
} from '../types';
import {
  ProviderAdapter,
  ValidationResult,
  buildOpenAiBody,
  normalizeOpenAiCompletion,
  parseJsonBody,
  openAiErrorMessage,
  fetchWithTimeout,
  filterChatModels,
  sniffMimeType,
  isJsonModeSupportedByBody,
} from './base';

export interface OpenAiCompatibleConfig {
  id: string;
  label: string;
  baseUrl: string; // e.g. https://api.groq.com/openai/v1
  /** Model used for the credential validation probe. */
  defaultProbeModel: string;
  /** Hard-coded vision-capable model patterns (provider-specific). */
  visionPatterns?: RegExp[];
  /** Vision models offered by this provider, tried in order. */
  knownVisionModels?: string[];
  /** Whether image input is possible at all for this provider. */
  supportsAnyVision?: boolean;
  /** Endpoint requires a fixed base URL from the user. */
  requiresBaseUrl?: boolean;
  /** Headers added to every request (e.g. OpenRouter HTTP-Referer). */
  extraHeaders?: (apiKey: string) => Record<string, string>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 30000;

export function createOpenAiCompatibleAdapter(config: OpenAiCompatibleConfig): ProviderAdapter {
  const defaultBaseUrl = config.baseUrl.replace(/\/+$/, '');
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT;

  /** Per-call base URL (custom endpoints) or the configured default. */
  const effectiveBase = (baseUrl?: string) => (baseUrl?.trim() ? baseUrl.trim().replace(/\/+$/, '') : defaultBaseUrl);
  const endpoint = (baseUrl: string | undefined, path: string) => `${effectiveBase(baseUrl)}${path}`;

  function headers(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(config.extraHeaders ? config.extraHeaders(apiKey) : {}),
    };
  }

  async function rawListModels(apiKey: string, baseUrl?: string): Promise<any[]> {
    const res = await fetchWithTimeout(
      endpoint(baseUrl, '/models'),
      { headers: headers(apiKey), method: 'GET' },
      timeoutMs
    );
    if (!res.ok) {
      const raw = await res.json().catch(() => ({}));
      throw new Error(openAiErrorMessage(raw, `Models request failed (HTTP ${res.status})`));
    }
    const raw = await parseJsonBody(config.id, res);
    if (!Array.isArray(raw?.data)) {
      throw new MalformedProviderError(config.id, 'models payload missing data[]');
    }
    return raw.data;
  }

  async function listModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
    const data = await rawListModels(apiKey, baseUrl);
    const ids = filterChatModels(data.map((m: any) => m.id));
    const byId = new Map(data.map((m: any) => [m.id, m]));
    return ids.map((id) => {
      const meta = byId.get(id);
      return {
        id,
        vision: config.supportsAnyVision === false ? false : modelMaySee(id, config),
        contextWindow: typeof meta?.context_window === 'number' ? meta.context_window : undefined,
      };
    });
  }

  function modelMaySee(model: string, cfg: OpenAiCompatibleConfig): boolean {
    if (cfg.supportsAnyVision === false) return false;
    return !!cfg.visionPatterns?.some((re) => re.test(model));
  }

  async function supportsVision(apiKey: string, model: string, baseUrl?: string): Promise<boolean> {
    if (config.supportsAnyVision === false) return false;
    if (config.visionPatterns?.some((re) => re.test(model))) return true;
    // Unknown model — probe the live catalog for its metadata (OpenRouter style).
    try {
      const data = await rawListModels(apiKey, baseUrl);
      const entry = data.find((m: any) => m.id === model);
      if (!entry) return false;
      const modalities: any[] = entry.architecture?.input_modalities || entry.modalities || [];
      if (Array.isArray(modalities) && modalities.includes('image')) return true;
      if (entry.supported_parameters?.images === true) return true;
      return false;
    } catch {
      return false;
    }
  }

  async function visionModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    const known = config.knownVisionModels || [];
    if (config.supportsAnyVision === false) return [];
    // Extend with any live catalog entries that report image input.
    try {
      const data = await rawListModels(apiKey, baseUrl);
      const extra = data
        .filter((m: any) => {
          const modalities: any[] = m.architecture?.input_modalities || m.modalities || [];
          return Array.isArray(modalities) && modalities.includes('image');
        })
        .map((m: any) => m.id);
      return [...new Set([...known, ...extra])];
    } catch {
      return known;
    }
  }

  async function validateCredential(apiKey: string, baseUrl?: string): Promise<ValidationResult> {
    // Custom endpoints may not carry a usable probe model — validate by
    // enumerating the model catalog instead of a completion.
    if (!config.defaultProbeModel) {
      try {
        await rawListModels(apiKey, baseUrl);
        return { ok: true };
      } catch (error: any) {
        return { ok: false, error: error?.message || 'Could not reach the model catalog' };
      }
    }
    // A minimal real completion is the strongest credential probe.
    try {
      const res = await fetchWithTimeout(
        endpoint(baseUrl, '/chat/completions'),
        {
          method: 'POST',
          headers: headers(apiKey),
          body: JSON.stringify({
            model: config.defaultProbeModel,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
        },
        timeoutMs
      );
      if (!res.ok) {
        const raw = await res.json().catch(() => ({}));
        return { ok: false, error: openAiErrorMessage(raw, `HTTP ${res.status}`) };
      }
      const raw = await parseJsonBody(config.id, res);
      normalizeOpenAiCompletion(config.id, raw, config.defaultProbeModel);
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'Validation request failed' };
    }
  }

  async function chatComplete(req: ChatRequest): Promise<NormalizedChatResponse> {
    // Guard: providers that cannot see images must never receive image parts.
    if (req.messages.some((m) => typeof m.content !== 'string' && m.content.some((p) => p.type === 'image'))) {
      const anyImagePart = req.messages
        .flatMap((m) => (typeof m.content === 'string' ? [] : m.content))
        .find((p) => p.type === 'image');
      if (anyImagePart && config.supportsAnyVision === false) {
        throw new MalformedProviderError(config.id, 'provider does not accept image input');
      }
      if (anyImagePart && !modelMaySee(req.model, config)) {
        // Try live metadata before refusing.
        const canSee = await supportsVision(req.apiKey, req.model);
        if (!canSee) {
          throw new MalformedProviderError(
            config.id,
            `model "${req.model}" does not accept image input (vision not detected)`
          );
        }
      }
    }

    const body = buildOpenAiBody(req);
    // Some providers reject response_format when image parts are present.
    if (req.jsonMode && !isJsonModeSupportedByBody(true, req.messages)) {
      delete body.response_format;
    }

    const res = await fetchWithTimeout(
      endpoint(req.baseUrl, '/chat/completions'),
      { method: 'POST', headers: headers(req.apiKey), body: JSON.stringify(body) },
      timeoutMs
    );

    if (!res.ok) {
      const raw = await res.json().catch(() => ({}));
      throw new Error(openAiErrorMessage(raw, `Chat request failed (HTTP ${res.status})`));
    }
    const raw = await parseJsonBody(config.id, res);
    return normalizeOpenAiCompletion(config.id, raw, req.model);
  }

  return {
    id: config.id,
    authHeader: headers,
    validateCredential,
    listModels,
    supportsVision,
    visionModels,
    chatComplete,
  };
}

export { sniffMimeType };
