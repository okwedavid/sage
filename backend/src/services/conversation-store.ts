/**
 * services/conversation-store.ts
 * OWNS: Conversation persistence — the single path used by both the
 * conversations REST routes and the chat pipeline (auto-save).
 *
 * Supabase mode: `conversations` table (owner-scoped queries). Demo mode:
 * a shared in-memory store so chat auto-save and the conversation list stay
 * consistent without a database. Message arrays are capped so a long session
 * cannot grow without bound.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  isSupabaseConfigured,
  createConversation as dbCreate,
  listConversations as dbList,
  getConversation as dbGet,
  deleteConversationById as dbDelete,
  updateConversationContent,
} from './supabase';

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  intent?: any;
  agent?: string;
  stages?: any[];
  attachments?: Record<string, any>;
}

export interface StoredConversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_TITLE = 'New Conversation';
const MAX_CONVERSATION_MESSAGES = 100;

// ── Shared in-memory fallback (demo/local runs without Supabase) ────────────
const memConversations = new Map<string, StoredConversation>();

/** Generate a concise, safe title from the first user message. */
export function generateConversationTitle(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/https?:\/\/\S+/gi, '') // strip URLs
    .replace(/[#*`_>~|[\]()]/g, '') // strip markdown punctuation
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Image Analysis';
  return cleaned.length > 60 ? `${cleaned.slice(0, 60).trimEnd()}…` : cleaned;
}

function toApiShape(row: any): StoredConversation {
  return {
    id: row.id,
    title: row.title,
    messages: row.messages || [],
    userId: row.user_id ?? row.userId,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

/** Cap the message list (keep the most recent turns). */
function capMessages(messages: StoredMessage[]): StoredMessage[] {
  return messages.length > MAX_CONVERSATION_MESSAGES
    ? messages.slice(-MAX_CONVERSATION_MESSAGES)
    : messages;
}

export async function createConversation(userId: string, title: string): Promise<StoredConversation | null> {
  const safeTitle = title && title.trim() ? title.slice(0, 200) : DEFAULT_TITLE;
  if (isSupabaseConfigured()) {
    const row = await dbCreate(userId, safeTitle);
    return row ? toApiShape(row) : null;
  }
  const conv: StoredConversation = {
    id: uuidv4(),
    title: safeTitle,
    messages: [],
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memConversations.set(conv.id, conv);
  return { ...conv };
}

export async function listConversations(userId: string): Promise<StoredConversation[]> {
  if (isSupabaseConfigured()) {
    const rows = await dbList(userId);
    return (rows || []).map(toApiShape);
  }
  return Array.from(memConversations.values())
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getConversation(userId: string, id: string): Promise<StoredConversation | null> {
  if (isSupabaseConfigured()) {
    const row = await dbGet(userId, id);
    return row ? toApiShape(row) : null;
  }
  const conv = memConversations.get(id);
  return conv && conv.userId === userId ? { ...conv, messages: [...conv.messages] } : null;
}

/**
 * Append messages to a conversation (ownership-checked, capped). Also
 * auto-titles a default-named conversation from its first user message.
 * Returns the updated conversation or null when missing/foreign.
 */
export async function addMessages(
  userId: string,
  convId: string,
  messages: StoredMessage[]
): Promise<StoredConversation | null> {
  const current = await getConversation(userId, convId);
  if (!current) return null;

  const merged = capMessages([...(current.messages || []), ...messages]);

  let title = current.title;
  if (title === DEFAULT_TITLE && merged.length > 0) {
    const firstUser = merged.find((m) => m.role === 'user');
    if (firstUser) title = generateConversationTitle(firstUser.content);
  }

  if (isSupabaseConfigured()) {
    const row = await updateConversationContent(userId, convId, { messages: merged, title });
    return row ? toApiShape(row) : null;
  }

  const conv = memConversations.get(convId);
  if (!conv || conv.userId !== userId) return null;
  conv.messages = merged;
  if (title !== conv.title) conv.title = title;
  conv.updatedAt = new Date().toISOString();
  return { ...conv, messages: [...conv.messages] };
}

export async function updateConversationTitle(
  userId: string,
  convId: string,
  title: string
): Promise<StoredConversation | null> {
  const safeTitle = title && title.trim() ? title.slice(0, 200) : DEFAULT_TITLE;
  const current = await getConversation(userId, convId);
  if (!current) return null;

  if (isSupabaseConfigured()) {
    const row = await updateConversationContent(userId, convId, { title: safeTitle });
    return row ? toApiShape(row) : null;
  }

  const conv = memConversations.get(convId);
  if (!conv || conv.userId !== userId) return null;
  conv.title = safeTitle;
  conv.updatedAt = new Date().toISOString();
  return { ...conv, messages: [...conv.messages] };
}

export async function deleteConversation(userId: string, id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    return dbDelete(userId, id);
  }
  const conv = memConversations.get(id);
  if (!conv || conv.userId !== userId) return false;
  memConversations.delete(id);
  return true;
}

/** Test hook: clear the in-memory store between tests. */
export function resetConversationStoreForTesting(): void {
  memConversations.clear();
}

export const CONVERSATION_MESSAGE_CAP = MAX_CONVERSATION_MESSAGES;
