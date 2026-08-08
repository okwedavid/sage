/**
 * providers/adapters/openai-compatible-custom.ts
 * OWNS: User-supplied OpenAI-style endpoints (Ollama, vLLM, LM Studio, …).
 *
 * A base URL is required. Vision support is CONFIGURABLE by the user because
 * it cannot be reliably probed from a generic catalog — we default to false so
 * text-only models are never fed images (no fabricated capabilities).
 */
import { createOpenAiCompatibleAdapter } from './openai-compatible';

/** Factory: the adapter is per-base-url, so it is created on demand. */
export function createCustomOpenAiAdapter(opts: { vision: boolean }): ReturnType<typeof createOpenAiCompatibleAdapter> {
  return createOpenAiCompatibleAdapter({
    id: 'openai-compatible',
    label: 'OpenAI-Compatible (custom)',
    baseUrl: 'https://placeholder.invalid/v1', // replaced per-credential by the gateway
    defaultProbeModel: '', // replaced per-credential
    visionPatterns: opts.vision ? [/.*/] : [],
    knownVisionModels: [],
    supportsAnyVision: opts.vision,
  });
}
