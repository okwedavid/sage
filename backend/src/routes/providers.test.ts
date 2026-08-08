/**
 * routes/providers.test.ts — Integration tests for /api/providers
 *
 * In-memory mode (no Supabase). Global fetch is wrapped so ONLY provider API
 * hosts (api.openai.com etc.) are mocked — the test client's own HTTP calls
 * to the local Express server pass through untouched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-provider-routes';
});

import app from '../index';
import { Settings } from '../config/settings';
import { resetProviderStoreForTesting } from '../providers/service';

const SECRET_KEY = 'sk-ant-super-secret-value-1234567890';
const token = jwt.sign({ userId: 'prov-user-1', email: 'p@user.dev' }, Settings.JWT_SECRET);
const otherToken = jwt.sign({ userId: 'prov-user-2', email: 'q@user.dev' }, Settings.JWT_SECRET);
const headers = { Authorization: `Bearer ${token}` };
const otherHeaders = { Authorization: `Bearer ${otherToken}` };

const realFetch = globalThis.fetch.bind(globalThis);
const PROVIDER_HOSTS = /(api\.openai\.com|api\.groq\.com|generativelanguage\.googleapis\.com|api\.anthropic\.com|openrouter\.ai|placeholder\.invalid|localhost:11434)/;

function jsonResponse(status: number, body: any): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

/** Default responder: a successful probe completion. */
let providerResponder: (url: string, init?: any) => Response | Promise<Response>;

beforeEach(() => {
  resetProviderStoreForTesting();
  providerResponder = async () => jsonResponse(200, { choices: [{ message: { content: 'ping' } }] });
  vi.stubGlobal('fetch', (url: any, init?: any) => {
    const u = String(url);
    if (PROVIDER_HOSTS.test(u)) return providerResponder(u, init);
    return realFetch(u, init);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function connectOne(baseUrl: string, provider = 'openai', apiKey = SECRET_KEY, extra: Record<string, any> = {}) {
  return jsonFetch(`${baseUrl}/api/providers/connect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider, apiKey, ...extra }),
  });
}

describe('providers route — auth', () => {
  it('requires a session for every endpoint', async () => {
    await withServer(app, async (baseUrl) => {
      expect((await jsonFetch(`${baseUrl}/api/providers`)).status).toBe(401);
      expect((await jsonFetch(`${baseUrl}/api/providers/connect`, { method: 'POST', body: '{}' })).status).toBe(401);
      expect((await jsonFetch(`${baseUrl}/api/providers/x/models`)).status).toBe(401);
      expect((await jsonFetch(`${baseUrl}/api/providers/x/health`, { method: 'POST', body: '{}' })).status).toBe(401);
      expect((await jsonFetch(`${baseUrl}/api/providers/x`, { method: 'PATCH', body: '{}' })).status).toBe(401);
      expect((await jsonFetch(`${baseUrl}/api/providers/x`, { method: 'DELETE' })).status).toBe(401);
    });
  });

  it('serves the provider catalog', async () => {
    await withServer(app, async (baseUrl) => {
      const res = await jsonFetch(`${baseUrl}/api/providers/catalog`, { headers });
      expect(res.status).toBe(200);
      const ids = res.body.providers.map((p: any) => p.id);
      expect(ids).toEqual(
        expect.arrayContaining(['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'openai-compatible'])
      );
    });
  });
});

describe('providers route — lifecycle', () => {
  it('connects a provider and never reveals the plaintext key', async () => {
    await withServer(app, async (baseUrl) => {
      const res = await connectOne(baseUrl);
      expect(res.status).toBe(201);
      expect(res.body.credential.provider).toBe('openai');
      expect(res.body.note).toContain('encrypted at rest');
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain(SECRET_KEY);
      expect(serialized).not.toContain('encrypted_key');
      expect(serialized).not.toContain('encryptedKey');
    });
  });

  it('rejects invalid provider credentials', async () => {
    providerResponder = async () => jsonResponse(401, { error: { message: 'Incorrect API key' } });
    await withServer(app, async (baseUrl) => {
      const res = await connectOne(baseUrl);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Incorrect API key');
    });
  });

  it('rejects unknown providers and missing base URLs', async () => {
    await withServer(app, async (baseUrl) => {
      const unknown = await connectOne(baseUrl, 'bard', 'k');
      expect(unknown.status).toBe(400);
      expect(unknown.body.error).toContain('Unsupported provider');

      const noUrl = await connectOne(baseUrl, 'openai-compatible', '', { model: 'm' });
      expect(noUrl.status).toBe(400);
      expect(noUrl.body.error).toContain('base URL');
    });
  });

  it('validates connect inputs', async () => {
    await withServer(app, async (baseUrl) => {
      const nonStringKey = await jsonFetch(`${baseUrl}/api/providers/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider: 'openai', apiKey: 12345 }),
      });
      expect(nonStringKey.status).toBe(400);

      const noProvider = await jsonFetch(`${baseUrl}/api/providers/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ apiKey: 'sk-x' }),
      });
      expect(noProvider.status).toBe(400);

      const hugeKey = await jsonFetch(`${baseUrl}/api/providers/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider: 'openai', apiKey: 'x'.repeat(600) }),
      });
      expect(hugeKey.status).toBe(400);
    });
  });

  it('lists credentials (masked) for the caller only', async () => {
    await withServer(app, async (baseUrl) => {
      await connectOne(baseUrl);
      const list = await jsonFetch(`${baseUrl}/api/providers`, { headers });
      expect(list.body.credentials).toHaveLength(1);
      expect(JSON.stringify(list.body)).not.toContain(SECRET_KEY);

      const other = await jsonFetch(`${baseUrl}/api/providers`, { headers: otherHeaders });
      expect(other.body.credentials).toHaveLength(0);
    });
  });

  it('fetches a single credential and 404s for foreign ids', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await connectOne(baseUrl);
      const id = created.body.credential.id;

      const one = await jsonFetch(`${baseUrl}/api/providers/${id}`, { headers });
      expect(one.status).toBe(200);
      expect(one.body.credential.id).toBe(id);

      const foreign = await jsonFetch(`${baseUrl}/api/providers/${id}`, { headers: otherHeaders });
      expect(foreign.status).toBe(404);
    });
  });

  it('discovers models and reports failures', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await connectOne(baseUrl);
      const id = created.body.credential.id;

      providerResponder = async () => jsonResponse(200, { data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] });
      const models = await jsonFetch(`${baseUrl}/api/providers/${id}/models`, { headers });
      expect(models.status).toBe(200);
      expect(models.body.models.map((m: any) => m.id).sort()).toEqual(['gpt-4o', 'gpt-4o-mini']);

      providerResponder = async () => jsonResponse(500, { error: { message: 'boom' } });
      const fail = await jsonFetch(`${baseUrl}/api/providers/${id}/models`, { headers });
      expect(fail.status).toBe(404);
      expect(fail.body.error).toBeTruthy();
    });
  });

  it('runs health checks and updates status', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await connectOne(baseUrl);
      const id = created.body.credential.id;

      const health = await jsonFetch(`${baseUrl}/api/providers/${id}/health`, { method: 'POST', headers, body: '{}' });
      expect(health.status).toBe(200);
      expect(health.body.ok).toBe(true);

      providerResponder = async () => jsonResponse(401, { error: { message: 'key revoked' } });
      const bad = await jsonFetch(`${baseUrl}/api/providers/${id}/health`, { method: 'POST', headers, body: '{}' });
      expect(bad.status).toBe(200);
      expect(bad.body.ok).toBe(false);
      expect(bad.body.error).toBeTruthy();
    });
  });

  it('selects a model and validates inputs', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await connectOne(baseUrl);
      const id = created.body.credential.id;

      const patch = await jsonFetch(`${baseUrl}/api/providers/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ model: 'gpt-4o', label: 'work' }),
      });
      expect(patch.status).toBe(200);
      expect(patch.body.credential.model).toBe('gpt-4o');
      expect(patch.body.credential.label).toBe('work');

      const bad = await jsonFetch(`${baseUrl}/api/providers/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ model: '' }),
      });
      expect(bad.status).toBe(400);

      const foreign = await jsonFetch(`${baseUrl}/api/providers/${id}`, {
        method: 'PATCH',
        headers: otherHeaders,
        body: JSON.stringify({ model: 'gpt-4o' }),
      });
      expect(foreign.status).toBe(404);
    });
  });

  it('returns 404 when health-checking a missing credential', async () => {
    await withServer(app, async (baseUrl) => {
      const res = await jsonFetch(`${baseUrl}/api/providers/nope/health`, {
        method: 'POST',
        headers,
        body: '{}',
      });
      expect(res.status).toBe(404);
    });
  });

  it('toggles the vision capability flag for custom endpoints', async () => {
    providerResponder = async () => jsonResponse(200, { data: [{ id: 'llama3.2' }] });
    await withServer(app, async (baseUrl) => {
      const created = await jsonFetch(`${baseUrl}/api/providers/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: 'openai-compatible',
          apiKey: '',
          baseUrl: 'http://localhost:11434/v1',
        }),
      });
      const id = created.body.credential.id;

      const patch = await jsonFetch(`${baseUrl}/api/providers/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ supportsVision: true }),
      });
      expect(patch.status).toBe(200);
      expect(patch.body.credential.capabilities.vision).toBe(true);

      const badLabel = await jsonFetch(`${baseUrl}/api/providers/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ label: 'x'.repeat(90) }),
      });
      expect(badLabel.status).toBe(400);
    });
  });

  it('revokes credentials and 404s for foreign ids', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await connectOne(baseUrl);
      const id = created.body.credential.id;

      const foreign = await jsonFetch(`${baseUrl}/api/providers/${id}`, { method: 'DELETE', headers: otherHeaders });
      expect(foreign.status).toBe(404);

      const del = await jsonFetch(`${baseUrl}/api/providers/${id}`, { method: 'DELETE', headers });
      expect(del.status).toBe(200);
      expect(del.body.ok).toBe(true);

      const gone = await jsonFetch(`${baseUrl}/api/providers/${id}`, { headers });
      expect(gone.status).toBe(404);
    });
  });
});
