/**
 * routes/conversations.ts
 * OWNS: Conversation CRUD endpoints (Phase 5 — persistence, isolation,
 * auto-titles). All persistence flows through services/conversation-store.ts,
 * which owns the Supabase vs in-memory decision.
 *
 * GET    /api/conversations        → list (owner only)
 * POST   /api/conversations        → create
 * GET    /api/conversations/:id    → fetch (owner only)
 * POST   /api/conversations/:id/messages → append message
 * PATCH  /api/conversations/:id    → rename
 * DELETE /api/conversations/:id    → delete (owner only)
 */
import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import {
  createConversation,
  listConversations,
  getConversation,
  addMessages,
  updateConversationTitle,
  deleteConversation,
  generateConversationTitle,
} from '../services/conversation-store';

const router = Router();
router.use(authMiddleware);

// GET /api/conversations
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const convs = await listConversations(req.userId!);
    res.json({ conversations: convs });
  } catch (error: any) {
    console.error('List conversations error:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// POST /api/conversations
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, firstMessage } = req.body || {};
    // Untitled conversations start as 'New Conversation' and are auto-titled
    // from the first user message on the first persisted turn. Clients may
    // also hint the initial topic via `firstMessage`.
    const safeTitle =
      typeof title === 'string' && title.trim()
        ? title.slice(0, 200)
        : typeof firstMessage === 'string' && firstMessage.trim()
          ? generateConversationTitle(firstMessage)
          : 'New Conversation';

    const conv = await createConversation(req.userId!, safeTitle);
    if (!conv) {
      res.status(500).json({ error: 'Failed to create conversation' });
      return;
    }
    res.status(201).json(conv);
  } catch (error: any) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const conv = await getConversation(req.userId!, req.params.id);
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
router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { content, role } = req.body || {};
    if (typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }
    const safeRole =
      role === 'user' || role === 'assistant' ? role : role === undefined ? 'user' : null;
    if (safeRole === null) {
      res.status(400).json({ error: 'Message role must be user or assistant' });
      return;
    }

    const message = {
      id: (req.body.id as string) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: safeRole,
      content: content.slice(0, 50000),
      timestamp: new Date().toISOString(),
    };

    const updated = await addMessages(req.userId!, req.params.id, [message]);

    if (!updated) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.status(201).json(message);
  } catch (error: any) {
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// PATCH /api/conversations/:id — rename
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title } = req.body || {};
    if (typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    const updated = await updateConversationTitle(req.userId!, req.params.id, title);
    if (!updated) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json(updated);
  } catch (error: any) {
    console.error('Rename conversation error:', error);
    res.status(500).json({ error: 'Failed to rename conversation' });
  }
});

// DELETE /api/conversations/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ok = await deleteConversation(req.userId!, req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
