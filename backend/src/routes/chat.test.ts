/**
 * routes/chat.test.ts — Integration tests for POST /api/chat
 *
 * The Groq SDK is mocked so the full pipeline (classifier + worker) runs
 * deterministically. The classifier call is identified by `response_format`
 * (only the classifier requests json_object).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { withServer, jsonFetch } from '../test-utils/http';
import { recordChatUsage } from '../services/billing';
import { Settings } from '../config/settings';

const { mockGroq } = vi.hoisted(() => ({
  mockGroq: {
    calls: [] as any[],
    workerContent: 'Stub worker response',
    classifyContent: JSON.stringify({
      task_type: 'RESEARCH',
      target_domain: 'Web',
      confidence_score: 0.95,
      priority: 'NORMAL',
      summary: 'Research test goal',
    }),
    throwOnConstruct: false,
  },
}));

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    constructor() {
      if (mockGroq.throwOnConstruct) throw new Error('invalid api key');
    }
    chat = {
      completions: {
        create: async (args: any) => {
          mockGroq.calls.push(args);
          const isClassifierCall = !!args.response_format;
          const content = isClassifierCall ? mockGroq.classifyContent : mockGroq.workerContent;
          return { choices: [{ message: { content } }] };
        },
      },
    };
  },
}));

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.RATE_LIMIT_MAX = '100000';
});

import app from '../index';

afterEach(() => {
  mockGroq.calls = [];
});

function postChat(baseUrl: string, body: Record<string, any>) {
  return jsonFetch(`${baseUrl}/api/chat`, { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/chat — validation', () => {
  it('rejects empty messages without attachments', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await postChat(baseUrl, { message: '' });
      expect(status).toBe(400);
      expect(body.error).toBe('Message or attachment required');
    });
  });

  it('rejects whitespace-only messages', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await postChat(baseUrl, { message: '   ' });
      expect(status).toBe(400);
    });
  });

  it('rejects non-string messages', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await postChat(baseUrl, { message: { nested: true } });
      expect(status).toBe(400);
      expect(body.error).toBe('Message must be a string');
    });
  });

  it('rejects messages over the size limit', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await postChat(baseUrl, { message: 'x'.repeat(50001) });
      expect(status).toBe(400);
      expect(body.error).toContain('Message too long');
    });
  });
});

describe('POST /api/chat — happy paths', () => {
  it('processes a text message through the full pipeline', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await postChat(baseUrl, {
        message: 'research quantum computing',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.response).toBe('Stub worker response');
      expect(body.agent).toBe('WebWorker');
      expect(body.intent.task_type).toBe('RESEARCH');
      expect(body.stages.map((s: any) => s.name)).toEqual([
        'normalize',
        'classify',
        'validate',
        'route',
        'execute',
      ]);
    });
  });

  it('routes attachment-only requests to VisionWorker', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await postChat(baseUrl, {
        message: '',
        attachments: { image_base64: 'aGVsbG8=', image_type: 'png' },
      });

      expect(status).toBe(200);
      expect(body.agent).toBe('VisionWorker');
      expect(body.success).toBe(true);
      expect(body.intent.has_attachments).toBe(true);
    });
  });

  it('rejects attachments with invalid base64 characters', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await postChat(baseUrl, {
        message: 'analyze',
        attachments: { image_base64: 'not!!base64!!', image_type: 'png' },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('invalid characters');
    });
  });

  it('rejects non-string attachment values', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await postChat(baseUrl, {
        message: 'analyze',
        attachments: { image_type: 42 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('must be a string');
    });
  });

  it('uses a custom model when provided', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await postChat(baseUrl, {
        message: 'explain the sky',
        customModel: 'custom-8b-model',
      });
      expect(status).toBe(200);
      const classifierCall = mockGroq.calls.find((c: any) => c.response_format);
      expect(classifierCall.model).toBe('custom-8b-model');
    });
  });

  it('passes client-supplied history into the worker prompt as context', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await postChat(baseUrl, {
        message: 'summarize the plan',
        history: [
          { role: 'user', content: 'we are building an app' },
          { role: 'assistant', content: 'great, let us plan it' },
          { role: 'system', content: 'must be skipped' },
        ],
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      const workerCall = mockGroq.calls.filter((c: any) => !c.response_format).pop();
      expect(workerCall).toBeDefined();
      const userContent = workerCall.messages[1].content;
      expect(userContent).toContain('we are building an app');
      expect(userContent).toContain('great, let us plan it');
      // system-role turns are ignored when building memory
      expect(userContent).not.toContain('must be skipped');
    });
  });

  it('ignores malformed history entries', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await postChat(baseUrl, {
        message: 'hello there',
        history: [
          { role: 'user', content: 'first real turn' },
          { role: 'robot', content: 'ignored' },
          { content: 'no role' },
          42,
        ],
      });

      expect(status).toBe(200);
      const workerCall = mockGroq.calls.filter((c: any) => !c.response_format).pop();
      const userContent = workerCall.messages[1].content;
      expect(userContent).toContain('first real turn');
      expect(userContent).not.toContain('no role');
    });
  });

  it('uses a custom API key when valid, otherwise falls back to the server key', async () => {
    await withServer(app, async (baseUrl) => {
      const withKey = await postChat(baseUrl, { message: 'hello', customApiKey: 'gsk_custom_key' });
      expect(withKey.status).toBe(200);

      const withBadKey = await postChat(baseUrl, { message: 'hello', customApiKey: 'sk-invalid' });
      expect(withBadKey.status).toBe(200); // falls back to server key
    });
  });

  it('allows authenticated users under their plan quota', async () => {
    const token = jwt.sign({ userId: 'quota-ok-user', email: 'ok@quota.dev' }, Settings.JWT_SECRET);
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: 'hello there' }),
      });
      expect(status).toBe(200);
    });
  });

  it('returns 429 for authenticated users who exceed their plan quota', async () => {
    // Free tier = 20/day; consume the whole quota first.
    for (let i = 0; i < 20; i++) recordChatUsage('quota-limit-user');
    const token = jwt.sign({ userId: 'quota-limit-user', email: 'limit@quota.dev' }, Settings.JWT_SECRET);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: 'hello' }),
      });
      expect(status).toBe(429);
      expect(body.code).toBe('plan_quota_exceeded');
      expect(body.upgrade).toBe(true);
      expect(body.plan).toBe('free');
      expect(body.error).toContain('Daily request limit');
    });
  });
});

describe('GET /api/chat/health', () => {
  it('reports engine health with a masked key', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/chat/health`);
      expect(status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.engine).toContain('SAGE v');
      expect(body.api_key).toMatch(/gsk_/);
      expect(body.api_key).not.toContain('gsk_test_server_key');
      expect(typeof body.uptime).toBe('number');
    });
  });
});

describe('POST /api/chat — server error paths', () => {
  it('returns 500 when the server has no valid API key', async () => {
    vi.resetModules();
    vi.stubEnv('GROQ_API_KEY', '');
    const { default: freshApp } = await import('../index');

    await withServer(freshApp, async (baseUrl) => {
      const { status, body } = await postChat(baseUrl, { message: 'hello' });
      expect(status).toBe(500);
      expect(body.error).toContain('No valid API key');
    });

    vi.unstubAllEnvs();
  });

  it('returns 500 when pipeline construction fails', async () => {
    vi.resetModules();
    mockGroq.throwOnConstruct = true;
    const { default: freshApp } = await import('../index');

    await withServer(freshApp, async (baseUrl) => {
      const { status, body } = await postChat(baseUrl, { message: 'hello' });
      expect(status).toBe(500);
      expect(body.error).toBe('invalid api key');
    });

    mockGroq.throwOnConstruct = false;
    vi.unstubAllEnvs();
  });
});
