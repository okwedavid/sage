/**
 * services/context.ts
 * OWNS: Conversation memory & context management (AI foundation).
 *
 * Provides a rolling-window memory with token-aware truncation so long
 * conversations stay inside a prompt budget without losing the most recent
 * (and therefore most relevant) turns. Storage-agnostic: the Chat route can
 * back it with persisted conversations or per-request state.
 */
export interface MemoryTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface BuildContextOptions {
  /** Approximate token budget for the whole memory block. */
  maxTokens: number;
  /** Cap on the number of turns actually included. */
  maxTurns?: number;
  /** Include a system instruction describing the memory block. */
  systemHeader?: string;
}

// Very rough heuristic: ~4 chars per token for mixed prose.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Rolling conversation memory with a fixed window.
 *
 * `add()` keeps only the last `capacity` turns (oldest trimmed first), so
 * memory usage is O(capacity) regardless of conversation length.
 */
export class ConversationMemory {
  private turns: MemoryTurn[] = [];
  private readonly capacity: number;

  constructor(capacity = 20) {
    this.capacity = Math.max(2, capacity);
  }

  get size(): number {
    return this.turns.length;
  }

  get isEmpty(): boolean {
    return this.turns.length === 0;
  }

  add(role: 'user' | 'assistant', content: string): void {
    if (!content || !content.trim()) return;
    this.turns.push({ role, content, timestamp: new Date().toISOString() });
    if (this.turns.length > this.capacity) {
      this.turns.splice(0, this.turns.length - this.capacity);
    }
  }

  /** Snapshot of the current turns (never exposes the internal array). */
  snapshot(): MemoryTurn[] {
    return this.turns.map((t) => ({ ...t }));
  }

  clear(): void {
    this.turns = [];
  }

  /**
   * Build a markdown context block within a token budget.
   * Keeps the newest turns first when trimming (recency matters most).
   */
  buildContext(opts: BuildContextOptions): string {
    if (this.turns.length === 0) return '';

    const maxTurns = opts.maxTurns || this.turns.length;
    const header = opts.systemHeader || 'Conversation history (most recent last):';
    const lines: string[] = [`${header}\n`];

    let budget = opts.maxTokens;
    // Keep newest turns; walk newest → oldest, stop when the budget runs out.
    const newestFirst = [...this.turns].reverse().slice(0, maxTurns);

    for (const turn of newestFirst) {
      const line = `[${turn.role}] ${turn.content}\n`;
      const cost = estimateTokens(line);
      if (budget - cost < 0 && lines.length > 1) break;
      lines.splice(1, 0, line); // insert after header, keeping chronological order
      budget -= cost;
    }

    return lines.join('');
  }
}
