/**
 * routes/conversations.ts
 * OWNS: Conversation CRUD endpoints
 */
import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// In-memory conversation store (replace with Supabase in production)
const conversations: Map<string, any[]> = new Map();

// GET /api/conversations
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const userConvs = conversations.get(req.userId!) || [];
  res.json({ conversations: userConvs });
});

// POST /api/conversations
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const { title } = req.body;
  const conv = {
    id: uuidv4(),
    title: title || 'New Conversation',
    messages: [],
    userId: req.userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const userConvs = conversations.get(req.userId!) || [];
  userConvs.unshift(conv);
  conversations.set(req.userId!, userConvs);

  res.status(201).json(conv);
});

// GET /api/conversations/:id
router.get('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const userConvs = conversations.get(req.userId!) || [];
  const conv = userConvs.find((c) => c.id === req.params.id);

  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  res.json(conv);
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', authMiddleware, (req: AuthRequest, res: Response) => {
  const userConvs = conversations.get(req.userId!) || [];
  const conv = userConvs.find((c) => c.id === req.params.id);

  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const message = {
    id: uuidv4(),
    ...req.body,
    timestamp: new Date().toISOString(),
  };

  conv.messages.push(message);
  conv.updatedAt = new Date().toISOString();

  res.status(201).json(message);
});

// DELETE /api/conversations/:id
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const userConvs = conversations.get(req.userId!) || [];
  const idx = userConvs.findIndex((c) => c.id === req.params.id);

  if (idx === -1) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  userConvs.splice(idx, 1);
  res.json({ success: true });
});

export default router;
