/**
 * routes/conversations.supabase.test.ts — Conversation CRUD against Supabase
 *
 * Mocks the services/supabase module so the routes exercise the DB-backed
 * code path (create/list/get/messages/delete against the persistence layer).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { withServer, jsonFetch } from '../test-utils/http';

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    configured: true,
    createConversation: vi.fn(),
    listConversations: vi.fn(),
    getConversation: vi.fn(),
    updateConversationContent: vi.fn(),
    deleteConversationById: vi.fn(),
  },
}));

vi.mock('../services/supabase', () => ({
  isSupabaseConfigured: () => mockSupabase.configured,
  createConversation: (...args: any[]) => mockSupabase.createConversation(...args),
  listConversations: (...args: any[]) => mockSupabase.listConversations(...args),
  getConversation: (...args: any[]) => mockSupabase.getConversation(...args),
  updateConversationContent: (...args: any[]) => mockSupabase.updateConversationContent(...args),
  deleteConversationById: (...args: any[]) => mockSupabase.deleteConversationById(...args),
}));

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
  process.env.JWT_SECRET = 'test-secret-for-conv-supabase-tests';
});

import app from '../index';
import { Settings } from '../config/settings';

const token = jwt.sign({ userId: 'db-user-1', email: 'db@user.dev' }, Settings.JWT_SECRET);
const authHeaders = { Authorization: `Bearer ${token}` };

beforeEach(() => {
  mockSupabase.configured = true;
  mockSupabase.createConversation.mockReset();
  mockSupabase.listConversations.mockReset();
  mockSupabase.getConversation.mockReset();
  mockSupabase.updateConversationContent.mockReset();
  mockSupabase.deleteConversationById.mockReset();
});

describe('conversations with Supabase', () => {
  it('lists persisted conversations', async () => {
    mockSupabase.listConversations.mockResolvedValue([
      { id: 'c1', title: 'Persisted', messages: [], userId: 'db-user-1', createdAt: 't', updatedAt: 't' },
    ]);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/conversations`, {
        headers: authHeaders,
      });
      expect(status).toBe(200);
      expect(body.conversations).toHaveLength(1);
      expect(body.conversations[0].title).toBe('Persisted');
    });
  });

  it('creates a conversation via the persistence layer', async () => {
    mockSupabase.createConversation.mockResolvedValue({
      id: 'c1', title: 'New chat', messages: [], userId: 'db-user-1', createdAt: 't', updatedAt: 't',
    });

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'New chat' }),
      });
      expect(status).toBe(201);
      expect(mockSupabase.createConversation).toHaveBeenCalledWith('db-user-1', 'New chat');
      expect(body.id).toBe('c1');
    });
  });

  it('returns 500 when the DB create fails', async () => {
    mockSupabase.createConversation.mockResolvedValue(null);

    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/conversations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'x' }),
      });
      expect(status).toBe(500);
    });
  });

  it('fetches a single persisted conversation', async () => {
    mockSupabase.getConversation.mockResolvedValue({
      id: 'c1', title: 'Hi', messages: [], userId: 'db-user-1', createdAt: 't', updatedAt: 't',
    });

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/conversations/c1`, {
        headers: authHeaders,
      });
      expect(status).toBe(200);
      expect(body.id).toBe('c1');
      expect(mockSupabase.getConversation).toHaveBeenCalledWith('db-user-1', 'c1');
    });
  });

  it('returns 404 for a missing persisted conversation', async () => {
    mockSupabase.getConversation.mockResolvedValue(null);

    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/conversations/missing`, {
        headers: authHeaders,
      });
      expect(status).toBe(404);
    });
  });

  it('appends messages to a persisted conversation', async () => {
    mockSupabase.getConversation.mockResolvedValue({
      id: 'c1', title: 'Hi', messages: [], userId: 'db-user-1', createdAt: 't', updatedAt: 't',
    });
    mockSupabase.updateConversationContent.mockResolvedValue({
      id: 'c1', title: 'Hi', messages: [{ role: 'user', content: 'hello' }], userId: 'db-user-1', createdAt: 't', updatedAt: 't',
    });

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/conversations/c1/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ role: 'user', content: 'hello' }),
      });
      expect(status).toBe(201);
      expect(body.role).toBe('user');
      expect(mockSupabase.getConversation).toHaveBeenCalledWith('db-user-1', 'c1');
      expect(mockSupabase.updateConversationContent).toHaveBeenCalledWith(
        'db-user-1',
        'c1',
        expect.objectContaining({
          messages: expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'hello' })]),
        })
      );
    });
  });

  it('returns 404 when adding a message to a missing conversation', async () => {
    mockSupabase.getConversation.mockResolvedValue(null);

    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/conversations/nope/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ content: 'hi' }),
      });
      expect(status).toBe(404);
    });
  });

  it('deletes a persisted conversation', async () => {
    mockSupabase.deleteConversationById.mockResolvedValue(true);

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/conversations/c1`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockSupabase.deleteConversationById).toHaveBeenCalledWith('db-user-1', 'c1');
    });
  });

  it('returns 404 when deleting a missing conversation', async () => {
    mockSupabase.deleteConversationById.mockResolvedValue(false);

    await withServer(app, async (baseUrl) => {
      const { status } = await jsonFetch(`${baseUrl}/api/conversations/nope`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      expect(status).toBe(404);
    });
  });

  it('returns 500 when listing fails at the persistence layer', async () => {
    mockSupabase.listConversations.mockRejectedValue(new Error('db unreachable'));

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/conversations`, {
        headers: authHeaders,
      });
      expect(status).toBe(500);
      expect(body.error).toBe('Failed to list conversations');
    });
  });

  it('returns 500 when the DB update fails during title generation', async () => {
    mockSupabase.getConversation.mockResolvedValue({
      id: 'c1', title: 'New Conversation', messages: [], userId: 'db-user-1', createdAt: 't', updatedAt: 't',
    });
    mockSupabase.updateConversationContent.mockRejectedValue(new Error('write failed'));

    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/conversations/c1/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ role: 'user', content: 'hello' }),
      });
      expect(status).toBe(500);
      expect(body.error).toBe('Failed to add message');
    });
  });
});
