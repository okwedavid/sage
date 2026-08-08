/**
 * providers/adapters/groq.ts
 * OWNS: Groq adapter (OpenAI-compatible wire protocol).
 */
import { createOpenAiCompatibleAdapter } from './openai-compatible';

// llama-4 Scout and Maverick accept images; the llama-3.2 vision previews are
// legacy but still served. Matching is name-based and conservative.
const VISION_PATTERNS = [/llama-4/i, /vision/i, /-vl/i, /nous/i];
const KNOWN_VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
];

export const groqAdapter = createOpenAiCompatibleAdapter({
  id: 'groq',
  label: 'Groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  defaultProbeModel: 'llama-3.3-70b-versatile',
  visionPatterns: VISION_PATTERNS,
  knownVisionModels: KNOWN_VISION_MODELS,
  supportsAnyVision: true,
});
