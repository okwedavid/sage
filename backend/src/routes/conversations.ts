/**
 * routes/conversations.ts
 * OWNS: Conversation CRUD endpoints
 *
 * Persistence: Supabase when configured, in-memory Map otherwise (local/demo).
 */
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import {
  isSupabaseConfigured,
  createConversation,
  listConversations,
  getConversation,
  addMessageToConversation,
  deleteConversationById,
} from '../services/supabase';

const router = Router();

// In-memory fallback store (only when Supabase is not configured)
const conversations: Map<string, any[]> = new Map();

// GET /api/conversations
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (isSupabaseConfigured()) {
      const convs = await listConversations(req.userId!);
      res.json({ conversations: convs });
      return;
    }
    res.json({ conversations: conversations.get(req.userId!) || [] });
  } catch (error: any) {
    console.error('List conversations error:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// POST /api/conversations
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body;
    const safeTitle = typeof title === 'string' && title.trim() ? title.slice(0, 200) : 'New Conversation';

    if (isSupabaseConfigured()) {
      const conv = await createConversation(req.userId!, safeTitle);
      if (!conv) {
        res.status(500).json({ error: 'Failed to create conversation' });
        return;
      }
      res.status(201).json(conv);
      return;
    }

    // In-memory fallback
    const conv = {
      id: uuidv4(),
      title: safeTitle,
      messages: [],
      userId: req.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const userConvs = conversations.get(req.userId!) || [];
    userConvs.unshift(conv);
    conversations.set(req.userId!, userConvs);
    res.status(201).json(conv);
  } catch (error: any) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// GET /api/conversations/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (isSupabaseConfigured()) {
      const conv = await getConversation(req.userId!, req.params.id);
      if (!conv) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      res.json(conv);
      return;
    }

    const userConvs = conversations.get(req.userId!) || [];
    const conv = userConvs.find((c) => c.id === req.params.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json(conv);
  } catch (error: any) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const message = {
      id: uuidv4(),
      ...req.body,
      timestamp: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const updated = await addMessageToConversation(req.userId!, req.params.id, message);
      if (!updated) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      res.status(201).json(message);
      return;
    }

    const userConvs = conversations.get(req.userId!) || [];
    const conv = userConvs.find((c) => c.id === req.params.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    conv.messages.push(message);
    conv.updatedAt = new Date().toISOString();
    res.status(201).json(message);
  } catch (error: any) {
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// DELETE /api/conversations/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (isSupabaseConfigured()) {
      const ok = await deleteConversationById(req.userId!, req.params.id);
      if (!ok) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      res.json({ success: true });
      return;
    }

    const userConvs = conversations.get(req.userId!) || [];
    const idx = userConvs.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    userConvs.splice(idx, 1);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
