/**
 * providers/adapters/openrouter.ts
 * OWNS: OpenRouter adapter (OpenAI-compatible wire protocol with per-model
 * capability metadata in the catalog).
 */
import { createOpenAiCompatibleAdapter } from './openai-compatible';

// OpenRouter's catalog reports image input modalities; these patterns cover
// well-known families when the catalog is unreachable.
const VISION_PATTERNS = [/vision/i, /llama-4/i, /gpt-4o/i, /claude/i, /gemini/i, /qvq/i, /-vl/i];
const KNOWN_VISION_MODELS = ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3-5-sonnet'];

export const openRouterAdapter = createOpenAiCompatibleAdapter({
  id: 'openrouter',
  label: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  defaultProbeModel: 'openrouter/auto',
  visionPatterns: VISION_PATTERNS,
  knownVisionModels: KNOWN_VISION_MODELS,
  supportsAnyVision: true,
  extraHeaders: () => ({
    'HTTP-Referer': 'https://sage.local',
    'X-Title': 'SAGE',
  }),
});
