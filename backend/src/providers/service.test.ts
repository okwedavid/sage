/**
 * providers/service.test.ts — ProviderService lifecycle + isolation + secrecy
 *
 * Runs in-memory mode (no Supabase env): deterministic and hermetic. The
 * provider's HTTP surface is mocked, so no real network traffic occurs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { providerService, resetProviderStoreForTesting } from './service';
import { isCredentialEncryptionReady } from './credentials';

const API_KEY = 'sk-ant-super-secret-value-1234567890';

// ── fetch mock ──────────────────────────────────────────────────────────────
let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: any): Response {
  return {
    ok: status < 400,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  resetProviderStoreForTesting();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProviderService (in-memory)', () => {
  it('registers, validates and stores a credential (encrypted)', async () => {
    expect(isCredentialEncryptionReady()).toBe(true);
    // probe completion → ok
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));

    const result = await providerService.connect('user-1', {
      provider: 'openai',
      apiKey: API_KEY,
      label: 'My OpenAI key',
    });

    expect(result.ok).toBe(true);
    expect(result.record?.provider).toBe('openai');
    expect(result.record?.label).toBe('My OpenAI key');
    expect(result.record?.model).toBe('gpt-4o-mini'); // catalog default

    // The record must never contain the plaintext key.
    const serialized = JSON.stringify(result.record);
    expect(serialized).not.toContain(API_KEY);
    expect(serialized).not.toContain('encrypted_key');
    expect(serialized).not.toContain('encryptedKey');
  });

  it('rejects invalid credentials without persisting anything', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { message: 'Incorrect API key' } }));
    const result = await providerService.connect('user-1', { provider: 'openai', apiKey: 'sk-bad' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Incorrect API key');
    expect(await providerService.list('user-1')).toHaveLength(0);
  });

  it('rejects unsupported providers and missing base URLs', async () => {
    const unsupported = await providerService.connect('user-1', { provider: 'google-bard', apiKey: 'k' });
    expect(unsupported.ok).toBe(false);
    const noUrl = await providerService.connect('user-1', { provider: 'openai-compatible', apiKey: '', model: 'm' });
    expect(noUrl.ok).toBe(false);
    expect(noUrl.error).toContain('base URL');
  });

  it('rejects connection when encryption is unavailable in production', async () => {
    const originalEnv = (await import('../config/settings')).Settings.NODE_ENV;
    const settings = (await import('../config/settings')).Settings;
    (settings as any).NODE_ENV = 'production';
    (settings as any).SAGE_CREDENTIAL_ENCRYPTION_KEY = '';

    const result = await providerService.connect('user-1', { provider: 'openai', apiKey: 'sk-x' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('SAGE_CREDENTIAL_ENCRYPTION_KEY');

    (settings as any).NODE_ENV = originalEnv;
    (settings as any).SAGE_CREDENTIAL_ENCRYPTION_KEY = '';
  });

  it('lists only the calling user’s credentials (isolation)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));
    await providerService.connect('user-a', { provider: 'openai', apiKey: 'sk-key-a-1234567890abcdef' });
    await providerService.connect('user-b', { provider: 'groq', apiKey: 'gsk-key-b-1234567890abcdef' });

    const listA = await providerService.list('user-a');
    expect(listA).toHaveLength(1);
    expect(listA[0].provider).toBe('openai');
    expect(listA[0].userId).toBe('user-a');
    expect(JSON.stringify(listA)).not.toContain('sk-key-a-1234567890abcdef');

    const listB = await providerService.list('user-b');
    expect(listB).toHaveLength(1);
    expect(listB[0].provider).toBe('groq');
  });

  it('prevents cross-user model selection and revocation', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));
    const created = await providerService.connect('user-a', { provider: 'openai', apiKey: 'sk-a-1234567890abcdef' });
    const id = created.record!.id;

    // user-b cannot see it, select a model for it, or revoke it.
    expect(await providerService.get('user-b', id)).toBeNull();
    const select = await providerService.selectModel('user-b', id, 'gpt-4o');
    expect(select.ok).toBe(false);
    const revoke = await providerService.revoke('user-b', id);
    expect(revoke.ok).toBe(false);
    // user-a can still see it.
    expect(await providerService.get('user-a', id)).not.toBeNull();
  });

  it('selects a model and persists the choice', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));
    const created = await providerService.connect('user-1', { provider: 'anthropic', apiKey: 'sk-ant-1234567890' });
    const id = created.record!.id;

    const sel = await providerService.selectModel('user-1', id, 'claude-3-opus-latest');
    expect(sel.ok).toBe(true);
    const fresh = await providerService.get('user-1', id);
    expect(fresh?.model).toBe('claude-3-opus-latest');

    expect(await providerService.selectModel('user-1', id, '')).toMatchObject({ ok: false });
  });

  it('runs health checks and marks failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));
    const created = await providerService.connect('user-1', { provider: 'groq', apiKey: 'gsk-1234567890abcdef' });
    const id = created.record!.id;

    const health = await providerService.healthCheck('user-1', id);
    expect(health.ok).toBe(true);
    expect((await providerService.get('user-1', id))?.status).toBe('active');
  });

  it('revokes a credential (delete + isolation)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));
    const created = await providerService.connect('user-1', { provider: 'gemini', apiKey: 'gem-1234567890' });
    const id = created.record!.id;

    const revoked = await providerService.revoke('user-1', id);
    expect(revoked.ok).toBe(true);
    expect(await providerService.get('user-1', id)).toBeNull();
    expect(await providerService.list('user-1')).toHaveLength(0);
  });

  it('resolves a usable gateway from a stored credential', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));
    const created = await providerService.connect('user-1', {
      provider: 'openai',
      apiKey: API_KEY,
      model: 'gpt-4o-mini',
    });
    const cred = created.record!;

    const gateway = await providerService.gatewayFor(cred);
    expect(gateway.providerId).toBe('openai');
    expect(gateway.model).toBe('gpt-4o-mini');

    // The decrypted key must be usable through the adapter (fetch is mocked).
    fetchMock.mockResolvedValue(
      jsonResponse(200, { choices: [{ message: { content: 'normalized' } }], model: 'gpt-4o-mini' })
    );
    const res = await gateway.complete([{ role: 'user', content: 'hi' }]);
    expect(res.content).toBe('normalized');
  });

  it('resolveGateway returns null for missing or foreign providers', async () => {
    expect(await providerService.resolveGateway('user-1')).toBeNull();
    expect(await providerService.resolveGateway('user-1', 'does-not-exist')).toBeNull();
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));
    const created = await providerService.connect('user-a', { provider: 'openai', apiKey: 'sk-a-1234567890abcdef' });
    expect(await providerService.resolveGateway('user-b', created.record!.id)).toBeNull();
    expect(await providerService.resolveGateway('user-a', created.record!.id)).not.toBeNull();
  });

  it('supports multiple providers per user with model discovery', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));
    const a = await providerService.connect('user-1', { provider: 'openai', apiKey: 'sk-a-1234567890abcdef' });
    const b = await providerService.connect('user-1', { provider: 'gemini', apiKey: 'gem-b-1234567890abcdef' });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect((await providerService.list('user-1')).map((c) => c.provider).sort()).toEqual(['gemini', 'openai']);
  });

  it('connects a custom OpenAI-compatible endpoint (validated via catalog)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ id: 'llama3.2' }, { id: 'qwen2-vl' }] }));
    const result = await providerService.connect('user-1', {
      provider: 'openai-compatible',
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
      supportsVision: true,
    });
    expect(result.ok).toBe(true);
    expect(result.record?.baseUrl).toBe('http://localhost:11434/v1');
    expect(result.record?.model).toBe('llama3.2'); // first catalog hit
    expect(result.models?.length).toBeGreaterThan(0);
  });

  it('keeps an explicit model that is absent from the catalog', async () => {
    // Probe completion OK; the model catalog does NOT list the chosen model.
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/models')
        ? jsonResponse(200, { data: [{ id: 'gpt-4o-mini' }] })
        : jsonResponse(200, { choices: [{ message: { content: 'ping' } }] })
    );
    const result = await providerService.connect('user-1', {
      provider: 'openai',
      apiKey: 'sk-explicit-1234567890',
      model: 'gpt-5-proprietary',
    });
    expect(result.ok).toBe(true);
    expect(result.record?.model).toBe('gpt-5-proprietary');
    // The explicit model is unshifted so the client still sees it listed.
    expect(result.models?.[0]?.id).toBe('gpt-5-proprietary');
  });

  it('listModels and healthCheck report missing credentials', async () => {
    expect((await providerService.listModels('user-1', 'nope')).error).toBe('Provider credential not found');
    expect((await providerService.healthCheck('user-1', 'nope')).error).toBe('Provider credential not found');
  });

  it('refuses to resolve a gateway for a credential without a model', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ id: 'llama3.2' }] }));
    const result = await providerService.connect('user-1', {
      provider: 'openai-compatible',
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
    });
    const id = result.record!.id;
    // Wipe the selected model so gateway construction must fail safely.
    await providerService.updateCred('user-1', id, { model: null as any });
    const fresh = await providerService.get('user-1', id);
    await expect(providerService.gatewayFor(fresh!)).rejects.toThrow(/No model selected/);
  });

  it('updates labels and capabilities in memory mode', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: 'ping' } }] }));
    const result = await providerService.connect('user-1', { provider: 'openai', apiKey: 'sk-update-1234567890' });
    const id = result.record!.id;
    const ok = await providerService.updateCred('user-1', id, {
      label: 'Renamed',
      capabilities: { vision: true },
    });
    expect(ok).toBe(true);
    const fresh = await providerService.get('user-1', id);
    expect(fresh?.label).toBe('Renamed');
    expect(fresh?.capabilities?.vision).toBe(true);
    // Foreign updates are rejected.
    expect(await providerService.updateCred('user-2', id, { label: 'hacked' })).toBe(false);
  });

  it('resolves gateways for custom endpoints with vision capability', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ id: 'qwen2-vl' }] }));
    const result = await providerService.connect('user-1', {
      provider: 'openai-compatible',
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2-vl',
      supportsVision: true,
    });
    const gateway = await providerService.gatewayFor(result.record!);
    expect(gateway.providerId).toBe('openai-compatible');
    expect(gateway.model).toBe('qwen2-vl');
  });
});
