/**
 * providers/adapters/openai.ts
 * OWNS: OpenAI adapter (OpenAI-compatible wire protocol).
 */
import { createOpenAiCompatibleAdapter } from './openai-compatible';

// Vision-capable OpenAI chat models (gpt-4o family, gpt-4.1 family, o-series).
const VISION_PATTERNS = [/gpt-4o/i, /gpt-4\.1/i, /gpt-4-turbo/i, /vision/i, /^o[134](-|$)/i];
const KNOWN_VISION_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4-turbo',
];

export const openAiAdapter = createOpenAiCompatibleAdapter({
  id: 'openai',
  label: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  defaultProbeModel: 'gpt-4o-mini',
  visionPatterns: VISION_PATTERNS,
  knownVisionModels: KNOWN_VISION_MODELS,
  supportsAnyVision: true,
});
