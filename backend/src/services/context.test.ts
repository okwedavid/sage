/**
 * services/context.test.ts — Conversation memory & context building
 */
import { describe, it, expect } from 'vitest';
import { ConversationMemory } from './context';

describe('ConversationMemory', () => {
  it('starts empty', () => {
    const mem = new ConversationMemory();
    expect(mem.isEmpty).toBe(true);
    expect(mem.size).toBe(0);
    expect(mem.buildContext({ maxTokens: 100 })).toBe('');
  });

  it('adds turns in order', () => {
    const mem = new ConversationMemory();
    mem.add('user', 'hello');
    mem.add('assistant', 'hi there');
    expect(mem.size).toBe(2);
    expect(mem.isEmpty).toBe(false);
  });

  it('ignores blank turns', () => {
    const mem = new ConversationMemory();
    mem.add('user', '   ');
    mem.add('user', '');
    expect(mem.size).toBe(0);
  });

  it('trims the oldest turns beyond capacity', () => {
    const mem = new ConversationMemory(3);
    mem.add('user', 't1');
    mem.add('user', 't2');
    mem.add('user', 't3');
    mem.add('user', 't4');
    expect(mem.size).toBe(3);
    expect(mem.snapshot()[0].content).toBe('t2');
  });

  it('snapshot does not leak the internal array', () => {
    const mem = new ConversationMemory();
    mem.add('user', 'a');
    const snap = mem.snapshot();
    snap.push({ role: 'user', content: 'mutated', timestamp: '' });
    expect(mem.size).toBe(1);
    expect(mem.snapshot()[0].content).toBe('a');
  });

  it('buildContext includes all turns under a generous budget', () => {
    const mem = new ConversationMemory();
    mem.add('user', 'question one');
    mem.add('assistant', 'answer one');
    const block = mem.buildContext({ maxTokens: 1000 });
    expect(block).toContain('[user] question one');
    expect(block).toContain('[assistant] answer one');
    expect(block).toContain('Conversation history');
  });

  it('buildContext truncates under a tight budget but keeps the newest turn', () => {
    const mem = new ConversationMemory();
    mem.add('user', 'old turn '.repeat(50)); // ~250 chars → ~63 tokens
    mem.add('user', 'NEWEST TURN');
    const block = mem.buildContext({ maxTokens: 10 });
    expect(block).toContain('NEWEST TURN');
    // The oldest long turn should have been dropped to fit the budget.
    expect(block).not.toContain('old turn');
  });

  it('buildContext respects maxTurns', () => {
    const mem = new ConversationMemory();
    for (let i = 1; i <= 5; i++) mem.add('user', `turn ${i}`);
    const block = mem.buildContext({ maxTokens: 10000, maxTurns: 2 });
    expect(block).toContain('turn 5');
    expect(block).toContain('turn 4');
    expect(block).not.toContain('turn 3');
  });

  it('buildContext preserves chronological order with a custom header', () => {
    const mem = new ConversationMemory();
    mem.add('user', 'first');
    mem.add('assistant', 'second');
    const block = mem.buildContext({ maxTokens: 1000, systemHeader: 'Memory:' });
    expect(block.startsWith('Memory:')).toBe(true);
    const userIdx = block.indexOf('[user] first');
    const asstIdx = block.indexOf('[assistant] second');
    expect(userIdx).toBeGreaterThan(-1);
    expect(asstIdx).toBeGreaterThan(userIdx);
  });

  it('clear wipes all turns', () => {
    const mem = new ConversationMemory();
    mem.add('user', 'x');
    mem.clear();
    expect(mem.isEmpty).toBe(true);
    expect(mem.size).toBe(0);
  });
});
