/**
 * routes/conversations.test.ts — Integration tests for conversation CRUD
 */
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-conv-tests';
});

import app from '../index';
import { Settings } from '../config/settings';

const token = jwt.sign({ userId: 'conv-user-1', email: 'conv@user.dev' }, Settings.JWT_SECRET);
const otherToken = jwt.sign({ userId: 'conv-user-2', email: 'other@user.dev' }, Settings.JWT_SECRET);
const authHeaders = { Authorization: `Bearer ${token}` };
const otherHeaders = { Authorization: `Bearer ${otherToken}` };

describe('conversations require auth', () => {
  it('returns 401 without a token', async () => {
    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/conversations`);
      expect(status).toBe(401);

      const post = await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        body: JSON.stringify({ title: 'x' }),
      });
      expect(post.status).toBe(401);
    });
  });
});

describe('conversation CRUD', () => {
  it('starts empty, creates, lists, and fetches conversations', async () => {
    await withServer(app, async (baseUrl) => {
      const empty = await jsonFetch(`${baseUrl}/api/conversations`, { headers: authHeaders });
      expect(empty.status).toBe(200);
      expect(empty.body.conversations).toEqual([]);

      const created = await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'My first convo' }),
      });
      expect(created.status).toBe(201);
      expect(created.body.title).toBe('My first convo');
      expect(created.body.id).toBeTruthy();

      const list = await jsonFetch(`${baseUrl}/api/conversations`, { headers: authHeaders });
      expect(list.body.conversations).toHaveLength(1);
      expect(list.body.conversations[0].id).toBe(created.body.id);

      const one = await jsonFetch(`${baseUrl}/api/conversations/${created.body.id}`, {
        headers: authHeaders,
      });
      expect(one.status).toBe(200);
      expect(one.body.title).toBe('My first convo');
    });
  });

  it('defaults the title for untitled conversations', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      expect(created.status).toBe(201);
      expect(created.body.title).toBe('New Conversation');
    });
  });

  it('scopes conversations per user', async () => {
    await withServer(app, async (baseUrl) => {
      await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'user-1 convo' }),
      });

      const other = await jsonFetch(`${baseUrl}/api/conversations`, { headers: otherHeaders });
      expect(other.body.conversations).toHaveLength(0);
    });
  });

  it('appends messages to a conversation', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'chat' }),
      });

      const msg = await jsonFetch(`${baseUrl}/api/conversations/${created.body.id}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ role: 'user', content: 'hello sage' }),
      });
      expect(msg.status).toBe(201);
      expect(msg.body.role).toBe('user');
      expect(msg.body.content).toBe('hello sage');
      expect(msg.body.id).toBeTruthy();

      const one = await jsonFetch(`${baseUrl}/api/conversations/${created.body.id}`, {
        headers: authHeaders,
      });
      expect(one.body.messages).toHaveLength(1);
    });
  });

  it('deletes conversations', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'to delete' }),
      });

      const del = await jsonFetch(`${baseUrl}/api/conversations/${created.body.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      expect(del.status).toBe(200);
      expect(del.body.success).toBe(true);

      const gone = await jsonFetch(`${baseUrl}/api/conversations/${created.body.id}`, {
        headers: authHeaders,
      });
      expect(gone.status).toBe(404);
    });
  });

  it('returns 404 for missing conversations', async () => {
    await withServer(app, async (baseUrl) => {
      const get = await jsonFetch(`${baseUrl}/api/conversations/nope`, { headers: authHeaders });
      expect(get.status).toBe(404);

      const msg = await jsonFetch(`${baseUrl}/api/conversations/nope/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ content: 'hi' }),
      });
      expect(msg.status).toBe(404);

      const del = await jsonFetch(`${baseUrl}/api/conversations/nope`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      expect(del.status).toBe(404);
    });
  });

  it('generates a title from the first message hint', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ firstMessage: 'Build a landing page with Next.js' }),
      });
      expect(created.status).toBe(201);
      expect(created.body.title).toBe('Build a landing page with Next.js');
    });
  });

  it('renames conversations and validates the title', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Old' }),
      });

      const renamed = await jsonFetch(`${baseUrl}/api/conversations/${created.body.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Renamed!' }),
      });
      expect(renamed.status).toBe(200);
      expect(renamed.body.title).toBe('Renamed!');

      const bad = await jsonFetch(`${baseUrl}/api/conversations/${created.body.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ title: '' }),
      });
      expect(bad.status).toBe(400);

      const foreign = await jsonFetch(`${baseUrl}/api/conversations/${created.body.id}`, {
        method: 'PATCH',
        headers: otherHeaders,
        body: JSON.stringify({ title: 'steal' }),
      });
      expect(foreign.status).toBe(404);
    });
  });

  it('rejects invalid message roles', async () => {
    await withServer(app, async (baseUrl) => {
      const created = await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'chat' }),
      });
      const res = await jsonFetch(`${baseUrl}/api/conversations/${created.body.id}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ role: 'robot', content: 'hi' }),
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('role');

      const empty = await jsonFetch(`${baseUrl}/api/conversations/${created.body.id}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ role: 'user' }),
      });
      expect(empty.status).toBe(400);
    });
  });
});
