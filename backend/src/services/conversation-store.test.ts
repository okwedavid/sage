/**
 * services/conversation-store.test.ts — Conversation persistence (Phase 5/6)
 *
 * Covers auto-titles, message caps, cross-user isolation, and reopening a
 * saved conversation (memory restoration). Runs in-memory (no Supabase env).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createConversation,
  listConversations,
  getConversation,
  addMessages,
  updateConversationTitle,
  deleteConversation,
  generateConversationTitle,
  resetConversationStoreForTesting,
  CONVERSATION_MESSAGE_CAP,
} from './conversation-store';

beforeEach(() => {
  resetConversationStoreForTesting();
});

describe('generateConversationTitle', () => {
  it('truncates long messages and strips markdown/URLs', () => {
    expect(generateConversationTitle('hello')).toBe('hello');
    expect(generateConversationTitle('Check https://example.com/docs and **see** this')).toBe('Check and see this');
    expect(generateConversationTitle('a'.repeat(200)).length).toBeLessThanOrEqual(61);
  });

  it('falls back to a friendly default for image-only input', () => {
    expect(generateConversationTitle('')).toBe('Image Analysis');
    expect(generateConversationTitle('   ')).toBe('Image Analysis');
  });
});

describe('conversation store (in-memory)', () => {
  it('creates and lists conversations with owner scoping', async () => {
    const conv = await createConversation('u1', 'My convo');
    expect(conv?.title).toBe('My convo');
    expect((await listConversations('u1')).map((c) => c.id)).toEqual([conv!.id]);
    expect(await listConversations('u2')).toEqual([]);
    expect(await getConversation('u2', conv!.id)).toBeNull(); // isolation
  });

  it('auto-titles a default conversation from the first user message', async () => {
    const conv = await createConversation('u1', 'New Conversation');
    const updated = await addMessages('u1', conv!.id, [
      { id: 'm1', role: 'user', content: 'Build me a pricing page', timestamp: new Date().toISOString() },
      { id: 'm2', role: 'assistant', content: 'Sure!', timestamp: new Date().toISOString() },
    ]);
    expect(updated?.title).toBe('Build me a pricing page');
  });

  it('does not overwrite a custom title', async () => {
    const conv = await createConversation('u1', 'Custom Title');
    const updated = await addMessages('u1', conv!.id, [
      { id: 'm1', role: 'user', content: 'Hello there', timestamp: new Date().toISOString() },
    ]);
    expect(updated?.title).toBe('Custom Title');
  });

  it('caps stored messages to the configured limit', async () => {
    const conv = await createConversation('u1', 'Big chat');
    const many = Array.from({ length: CONVERSATION_MESSAGE_CAP + 25 }, (_, i) => ({
      id: `m${i}`,
      role: ('user' as const),
      content: `turn ${i}`,
      timestamp: new Date().toISOString(),
    }));
    const updated = await addMessages('u1', conv!.id, many);
    expect(updated?.messages.length).toBe(CONVERSATION_MESSAGE_CAP);
    // Most recent turns survive.
    expect(updated?.messages[updated.messages.length - 1].content).toBe(`turn ${CONVERSATION_MESSAGE_CAP + 24}`);
  });

  it('restores a saved conversation (memory restoration)', async () => {
    const conv = await createConversation('u1', 'New Conversation');
    await addMessages('u1', conv!.id, [
      { id: 'a', role: 'user', content: 'Research quantum computing', timestamp: 't1' },
      { id: 'b', role: 'assistant', content: 'Here is a summary', timestamp: 't2', agent: 'WebWorker' },
    ]);

    const restored = await getConversation('u1', conv!.id);
    expect(restored?.messages).toHaveLength(2);
    expect(restored?.messages[0]).toMatchObject({ role: 'user', content: 'Research quantum computing' });
    expect(restored?.messages[1]).toMatchObject({ role: 'assistant', agent: 'WebWorker' });
    // The restored conversation can be continued.
    const continued = await addMessages('u1', conv!.id, [
      { id: 'c', role: 'user', content: 'Expand on the second point', timestamp: 't3' },
    ]);
    expect(continued?.messages).toHaveLength(3);
  });

  it('rejects writes to conversations owned by another user', async () => {
    const conv = await createConversation('u1', 'Private');
    expect(await addMessages('u2', conv!.id, [{ id: 'x', role: 'user', content: 'hi', timestamp: 't' }])).toBeNull();
    expect(await updateConversationTitle('u2', conv!.id, 'hacked')).toBeNull();
    expect(await deleteConversation('u2', conv!.id)).toBe(false);
    // Unchanged for the owner.
    expect((await getConversation('u1', conv!.id))?.title).toBe('Private');
  });

  it('renames conversations and deletes them', async () => {
    const conv = await createConversation('u1', 'Old title');
    const renamed = await updateConversationTitle('u1', conv!.id, 'New title');
    expect(renamed?.title).toBe('New title');
    expect(await deleteConversation('u1', conv!.id)).toBe(true);
    expect(await getConversation('u1', conv!.id)).toBeNull();
  });
});
