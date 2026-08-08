/**
 * providers/gateway.test.ts — ChatGateway over a stub adapter
 */
import { describe, it, expect, vi } from 'vitest';
import { ChatGateway } from './gateway';
import { ProviderAdapter } from './adapters/base';
import { NormalizedChatResponse } from './types';

function stubAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    id: 'stub',
    authHeader: () => ({}),
    validateCredential: vi.fn(async () => ({ ok: true })),
    listModels: vi.fn(async () => [{ id: 'm1' }, { id: 'm2' }]),
    supportsVision: vi.fn(async () => true),
    visionModels: vi.fn(async () => ['vision-1']),
    chatComplete: vi.fn(async (): Promise<NormalizedChatResponse> => ({
      content: 'normalized',
      model: 'm1',
      usage: { promptTokens: 5, completionTokens: 2 },
    })),
    ...overrides,
  };
}

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('ChatGateway', () => {
  it('delegates chat completions and normalizes the response', async () => {
    const adapter = stubAdapter();
    const gateway = new ChatGateway(adapter, 'sk-key', { model: 'm1' });

    const res = await gateway.complete([{ role: 'user', content: 'hi' }], { temperature: 0.2, maxTokens: 10 });
    expect(res.content).toBe('normalized');
    expect(adapter.chatComplete).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-key', model: 'm1', temperature: 0.2, maxTokens: 10 })
    );
  });

  it('normalizes image analysis into an image content part', async () => {
    const adapter = stubAdapter();
    const gateway = new ChatGateway(adapter, 'k', { model: 'm1' });

    await gateway.analyzeImage('describe', { base64: PNG, mimeType: 'image/png' });
    const req = (adapter.chatComplete as any).mock.calls[0][0];
    const parts = req.messages[0].content;
    expect(parts[0]).toEqual({ type: 'text', text: 'describe' });
    expect(parts[1]).toEqual({ type: 'image', base64: PNG, mimeType: 'image/png' });
  });

  it('binds sibling gateways to other models of the same provider', async () => {
    const adapter = stubAdapter();
    const gateway = new ChatGateway(adapter, 'k', { model: 'm1', baseUrl: 'http://local/v1' });
    const other = gateway.withModel('m2');
    expect(other.model).toBe('m2');
    expect(other.baseUrl).toBe('http://local/v1');
  });

  it('exposes capability, discovery and descriptor helpers', async () => {
    const adapter = stubAdapter();
    const gateway = new ChatGateway(adapter, 'k', { model: 'm1' });

    expect(await gateway.supportsVision()).toBe(true);
    expect(await gateway.visionModels()).toEqual(['vision-1']);
    expect(await gateway.listModels()).toEqual([{ id: 'm1' }, { id: 'm2' }]);
    expect((await gateway.validate()).ok).toBe(true);

    const descriptor = await gateway.toDescriptor();
    expect(descriptor).toEqual({ provider: 'stub', model: 'm1', vision: true });
  });
});
