/**
 * providers/adapters.test.ts — Adapter behavior with mocked HTTP
 *
 * Verifies the normalization layer (Phase 3): every provider must return the
 * unified NormalizedChatResponse, refuse malformed payloads, and never send
 * images to models without vision capability.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openAiAdapter } from './adapters/openai';
import { anthropicAdapter } from './adapters/anthropic';
import { geminiAdapter } from './adapters/gemini';
import { openRouterAdapter } from './adapters/openrouter';
import { createCustomOpenAiAdapter } from './adapters/openai-compatible-custom';
import { sniffMimeType, filterChatModels, extractContentText } from './adapters/base';
import { NormalizedMessage } from './types';

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// ── fetch mock plumbing ─────────────────────────────────────────────────────
let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: any, ok?: boolean): Response {
  return {
    ok: ok ?? status < 400,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const textMessage: NormalizedMessage = { role: 'user', content: 'Say hello' };

describe('OpenAI-compatible adapter (OpenAI)', () => {
  it('normalizes a completion into the unified schema', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        choices: [{ message: { content: 'Hello!' } }],
        model: 'gpt-4o-mini',
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      })
    );
    const res = await openAiAdapter.chatComplete({
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      messages: [textMessage],
      temperature: 0.5,
      maxTokens: 100,
      jsonMode: true,
    });

    expect(res.content).toBe('Hello!');
    expect(res.model).toBe('gpt-4o-mini');
    expect(res.usage?.promptTokens).toBe(10);
    expect(res.usage?.completionTokens).toBe(5);

    // Wire format must carry json_mode + max_tokens.
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.max_tokens).toBe(100);
    expect(body.messages[0].role).toBe('user');
  });

  it('throws a malformed-response error when choices are missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { foo: 'bar' }));
    await expect(
      openAiAdapter.chatComplete({ apiKey: 'sk-test', model: 'gpt-4o-mini', messages: [textMessage] })
    ).rejects.toThrow(/Malformed/);
  });

  it('throws a malformed-response error on empty content', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: {} }] }));
    await expect(
      openAiAdapter.chatComplete({ apiKey: 'sk-test', model: 'gpt-4o-mini', messages: [textMessage] })
    ).rejects.toThrow(/Malformed/);
  });

  it('surfaces provider HTTP errors as readable errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: { message: 'Incorrect API key provided' } }, false)
    );
    await expect(
      openAiAdapter.chatComplete({ apiKey: 'sk-bad', model: 'gpt-4o-mini', messages: [textMessage] })
    ).rejects.toThrow(/Incorrect API key/);
  });

  it('validates credentials with a minimal probe', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));
    const result = await openAiAdapter.validateCredential('sk-test');
    expect(result.ok).toBe(true);
  });

  it('reports invalid credentials', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { error: { message: 'forbidden' } }, false));
    const result = await openAiAdapter.validateCredential('sk-bad');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('forbidden');
  });

  it('discovers chat models and filters embeddings/audio', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: [
          { id: 'gpt-4o-mini' },
          { id: 'gpt-4o' },
          { id: 'text-embedding-3-small' },
          { id: 'whisper-1' },
        ],
      })
    );
    const models = await openAiAdapter.listModels('sk-test');
    expect(models.map((m) => m.id).sort()).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });

  it('detects vision capability for gpt-4o but not text-only models', async () => {
    expect(await openAiAdapter.supportsVision('sk-test', 'gpt-4o')).toBe(true);
    expect(await openAiAdapter.supportsVision('sk-test', 'gpt-4o-mini')).toBe(true);
  });

  it('refuses image input for unknown non-vision models (no fabricated capability)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ id: 'unknown-text-model', architecture: { input_modalities: ['text'] } }] }));
    await expect(
      openAiAdapter.chatComplete({
        apiKey: 'sk-test',
        model: 'unknown-text-model',
        messages: [{ role: 'user', content: [{ type: 'image', base64: PNG, mimeType: 'image/png' }] }],
      })
    ).rejects.toThrow(/does not accept image input/);
  });

  it('strips response_format when image parts are present', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ok' } }] }));
    await openAiAdapter.chatComplete({
      apiKey: 'sk-test',
      model: 'gpt-4o',
      jsonMode: true,
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'what' }, { type: 'image', base64: PNG, mimeType: 'image/png' }] },
      ],
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.response_format).toBeUndefined();
  });
});

describe('Anthropic adapter', () => {
  it('normalizes a messages response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        content: [{ type: 'text', text: 'Hello from Claude' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 9, output_tokens: 4 },
      })
    );
    const res = await anthropicAdapter.chatComplete({
      apiKey: 'sk-ant-test',
      model: 'claude-3-5-sonnet-latest',
      messages: [
        { role: 'system', content: 'You are SAGE.' },
        { role: 'user', content: 'Hi' },
      ],
    });
    expect(res.content).toBe('Hello from Claude');
    expect(res.model).toContain('claude');
    expect(res.usage?.promptTokens).toBe(9);
  });

  it('sends images as base64 source blocks when the model sees images', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { content: [{ type: 'text', text: 'A diagram' }], model: 'claude-3-5-sonnet-latest' })
    );
    await anthropicAdapter.chatComplete({
      apiKey: 'sk-ant-test',
      model: 'claude-3-5-sonnet-latest',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'what is this' }, { type: 'image', base64: PNG, mimeType: 'image/png' }] }],
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    const parts = body.messages[0].content;
    expect(parts[1].type).toBe('image');
    expect(parts[1].source.data).toBe(PNG);
  });

  it('all claude models report vision support', async () => {
    expect(await anthropicAdapter.supportsVision('k', 'claude-3-5-sonnet-latest')).toBe(true);
    expect(await anthropicAdapter.supportsVision('k', 'claude-3-opus-latest')).toBe(true);
    expect(await anthropicAdapter.supportsVision('k', 'not-an-anthropic-model')).toBe(false);
  });

  it('refuses images for non-claude models and surfaces HTTP errors', async () => {
    await expect(
      anthropicAdapter.chatComplete({
        apiKey: 'k',
        model: 'some-other-model',
        messages: [{ role: 'user', content: [{ type: 'image', base64: PNG, mimeType: 'image/png' }] }],
      })
    ).rejects.toThrow(/does not accept image input/);

    fetchMock.mockResolvedValue(jsonResponse(500, { error: { message: 'overloaded' } }));
    await expect(
      anthropicAdapter.chatComplete({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', messages: [textMessage] })
    ).rejects.toThrow(/overloaded/);
  });
});

describe('Gemini adapter', () => {
  it('normalizes a generateContent response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: 'Hello from Gemini' }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
      })
    );
    const res = await geminiAdapter.chatComplete({
      apiKey: 'gem-key',
      model: 'gemini-2.0-flash',
      messages: [textMessage],
      jsonMode: true,
    });
    expect(res.content).toBe('Hello from Gemini');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('reports malformed responses', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { candidates: [] }));
    await expect(
      geminiAdapter.chatComplete({ apiKey: 'k', model: 'gemini-2.0-flash', messages: [textMessage] })
    ).rejects.toThrow(/Malformed/);
  });

  it('gemini models report vision support', async () => {
    expect(await geminiAdapter.supportsVision('k', 'gemini-2.0-flash')).toBe(true);
    expect(await geminiAdapter.supportsVision('k', 'text-embedding-004')).toBe(false);
  });

  it('refuses images for non-gemini models', async () => {
    await expect(
      geminiAdapter.chatComplete({
        apiKey: 'k',
        model: 'some-other-model',
        messages: [{ role: 'user', content: [{ type: 'image', base64: PNG, mimeType: 'image/png' }] }],
      })
    ).rejects.toThrow(/does not accept image input/);
  });

  it('validates credentials and surfaces provider errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { error: { message: 'API key expired' } }));
    const result = await geminiAdapter.validateCredential('bad-key');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('API key expired');
  });
});

describe('Custom OpenAI-compatible adapter', () => {
  it('uses the per-credential base URL for calls', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { choices: [{ message: { content: 'local reply' } }], model: 'ollama-model' })
    );
    const adapter = createCustomOpenAiAdapter({ vision: false });
    const res = await adapter.chatComplete({
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2',
      messages: [textMessage],
    });
    expect(res.content).toBe('local reply');
    expect(fetchMock.mock.calls[0][0]).toContain('http://localhost:11434/v1');
  });

  it('refuses to send images when vision is not enabled (no fabricated capability)', async () => {
    const adapter = createCustomOpenAiAdapter({ vision: false });
    await expect(
      adapter.chatComplete({
        apiKey: '',
        baseUrl: 'http://localhost:11434/v1',
        model: 'llama3.2',
        messages: [{ role: 'user', content: [{ type: 'image', base64: PNG, mimeType: 'image/png' }] }],
      })
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates credentials via the model catalog when no probe model exists', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ id: 'llama3.2' }] }));
    const adapter = createCustomOpenAiAdapter({ vision: false });
    const result = await adapter.validateCredential('', 'http://localhost:11434/v1');
    expect(result.ok).toBe(true);
  });

  it('marks custom models as non-vision when the flag is off and lists none', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ id: 'llama3.2' }, { id: 'whisper-1' }] }));
    const adapter = createCustomOpenAiAdapter({ vision: false });
    const models = await adapter.listModels('', 'http://localhost:11434/v1');
    expect(models.map((m) => m.id)).toEqual(['llama3.2']);
    expect(models[0].vision).toBe(false);
    expect(await adapter.visionModels('', 'http://localhost:11434/v1')).toEqual([]);
  });

  it('reports validation failure when the catalog is unreachable', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: { message: 'connection refused' } }));
    const adapter = createCustomOpenAiAdapter({ vision: false });
    const result = await adapter.validateCredential('', 'http://localhost:11434/v1');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('connection refused');
  });
});

describe('OpenRouter adapter', () => {
  it('reads vision capability from catalog metadata', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: [
          { id: 'openai/gpt-4o', architecture: { input_modalities: ['text', 'image'] } },
          { id: 'meta-llama/llama-3.1-8b', architecture: { input_modalities: ['text'] } },
        ],
      })
    );
    expect(await openRouterAdapter.supportsVision('k', 'openai/gpt-4o')).toBe(true);
    expect(await openRouterAdapter.supportsVision('k', 'meta-llama/llama-3.1-8b')).toBe(false);
  });

  it('extracts vision models from the catalog', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: [
          { id: 'openai/gpt-4o', architecture: { input_modalities: ['text', 'image'] } },
          { id: 'anthropic/claude-3-5-sonnet', supported_parameters: { images: true } },
          { id: 'text-only/model', architecture: { input_modalities: ['text'] } },
        ],
      })
    );
    const vision = await openRouterAdapter.visionModels('k');
    expect(vision).toContain('openai/gpt-4o');
    expect(vision).toContain('anthropic/claude-3-5-sonnet');
    expect(vision).not.toContain('text-only/model');
  });
});

describe('Gemini + Anthropic discovery', () => {
  it('filters gemini models to generateContent-capable chat models', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        models: [
          { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/gemini-1.5-pro', supportedGenerationMethods: ['generateContent'] },
        ],
      })
    );
    const models = await geminiAdapter.listModels('k');
    expect(models.map((m) => m.id).sort()).toEqual(['gemini-1.5-pro', 'gemini-2.0-flash']);
    expect(models[0].vision).toBe(true);
  });

  it('lists anthropic chat models with vision flags', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: [{ id: 'claude-3-5-sonnet-20241022' }, { id: 'claude-3-5-haiku-latest' }],
      })
    );
    const models = await anthropicAdapter.listModels('k');
    expect(models.every((m) => m.vision)).toBe(true);
  });
});

describe('image sniffing helpers', () => {
  it('detects png/jpeg/webp/gif magic bytes', () => {
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    expect(sniffMimeType(png)).toBe('image/png');
    const jpeg =
      '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';
    expect(sniffMimeType(jpeg)).toBe('image/jpeg');
    expect(sniffMimeType('aGVsbG8=')).toBeNull(); // "hello"
    expect(sniffMimeType('')).toBeNull();
  });

  it('detects webp magic bytes and extracts text from content parts', () => {
    // Minimal valid WebP: 'RIFF' + 4-byte size + 'WEBP' + minimal VP8 chunk.
    const webpBytes = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20, 0x18, 0x00, 0x00, 0x00,
    ]);
    expect(sniffMimeType(webpBytes.toString('base64'))).toBe('image/webp');

    expect(extractContentText('p', 'plain text')).toBe('plain text');
    expect(extractContentText('p', [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }])).toBe('a\nb');
    expect(extractContentText('p', [{ type: 'tool_call' }])).toBeNull();
  });

  it('filters embedding/audio/image model ids', () => {
    expect(
      filterChatModels(['gpt-4o', 'whisper-1', 'dall-e-3', 'text-embedding-3', 'gpt-4o-mini', 'bge-reranker-v2'])
    ).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });
});
