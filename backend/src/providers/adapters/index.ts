/**
 * providers/adapters/index.ts
 * OWNS: The adapter registry + provider catalog. Adding a future provider =
 * implement ProviderAdapter + add one entry here. The core pipeline is never
 * touched (Phase 3 extensibility seam).
 */
import { ProviderAdapter } from './base';
import { ProviderId, ProviderCatalogEntry } from '../types';
import { groqAdapter } from './groq';
import { openAiAdapter } from './openai';
import { anthropicAdapter } from './anthropic';
import { geminiAdapter } from './gemini';
import { openRouterAdapter } from './openrouter';
import { createCustomOpenAiAdapter } from './openai-compatible-custom';

const REGISTRY: Record<string, ProviderAdapter> = {
  groq: groqAdapter,
  openai: openAiAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  openrouter: openRouterAdapter,
};

/** Adapters whose base URL is supplied per-credential (factory-based). */
export function getCustomAdapter(opts: { vision: boolean }): ProviderAdapter {
  return createCustomOpenAiAdapter(opts);
}

export function getAdapter(id: string): ProviderAdapter | null {
  return REGISTRY[id] || null;
}

export function listAdapterIds(): string[] {
  return Object.keys(REGISTRY);
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: 'groq',
    label: 'Groq',
    description: 'Fast open-model inference (Llama, etc.)',
    requiresBaseUrl: false,
    configurableVision: false,
    defaultModel: 'llama-3.3-70b-versatile',
    defaultVisionModels: ['meta-llama/llama-4-scout-17b-16e-instruct'],
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT models including vision',
    requiresBaseUrl: false,
    configurableVision: false,
    defaultModel: 'gpt-4o-mini',
    defaultVisionModels: ['gpt-4o-mini', 'gpt-4o'],
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models (all vision-capable)',
    requiresBaseUrl: false,
    configurableVision: false,
    defaultModel: 'claude-3-5-haiku-latest',
    defaultVisionModels: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
    docsUrl: 'https://console.anthropic.com/keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Gemini multimodal models',
    requiresBaseUrl: false,
    configurableVision: false,
    defaultModel: 'gemini-2.0-flash',
    defaultVisionModels: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'One key for hundreds of models',
    requiresBaseUrl: false,
    configurableVision: false,
    defaultModel: 'openrouter/auto',
    defaultVisionModels: ['openai/gpt-4o-mini', 'anthropic/claude-3-5-sonnet'],
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-Compatible',
    description: 'Bring your own endpoint (Ollama, vLLM, LM Studio…)',
    requiresBaseUrl: true,
    configurableVision: true,
    defaultModel: '',
    defaultVisionModels: [],
    docsUrl: 'https://ollama.com',
  },
];

export function getCatalogEntry(id: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((e) => e.id === id);
}

export function getProviderId(value: string): ProviderId | null {
  return PROVIDER_CATALOG.some((e) => e.id === value) ? (value as ProviderId) : null;
}

export type { ProviderAdapter };
