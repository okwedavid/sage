/**
 * core/intent/conversation-detector.test.ts — Deterministic greeting detection
 */
import { describe, it, expect } from 'vitest';
import { detectConversationIntent } from './conversation-detector';
import { TaskType } from '../enums';

describe('detectConversationIntent', () => {
  it('matches simple greetings', () => {
    for (const greeting of ['hello', 'hi', 'hey', 'heya', 'howdy', 'good morning', 'good afternoon', 'good evening', 'hi there', 'hello!']) {
      const result = detectConversationIntent(greeting);
      expect(result.matched, `expected "${greeting}" to match`).toBe(true);
      expect(result.intent?.taskType).toBe(TaskType.CHAT);
      expect(result.intent?.confidenceScore).toBeGreaterThan(0.9);
    }
  });

  it('matches how-are-you and small talk', () => {
    for (const phrase of [
      'how are you',
      'how are you doing',
      "how's it going",
      'whats up',
      'what can you do',
      'who are you',
      'nice to meet you',
      'thanks',
      'thank you',
      'bye',
    ]) {
      const result = detectConversationIntent(phrase);
      expect(result.matched, `expected "${phrase}" to match`).toBe(true);
      expect(result.intent?.taskType).toBe(TaskType.CHAT);
    }
  });

  it('is case/whitespace/punctuation tolerant', () => {
    expect(detectConversationIntent('  GOOD MORNING  ').matched).toBe(true);
    expect(detectConversationIntent('Hello!').matched).toBe(true);
  });

  it('matches common combined greetings', () => {
    for (const phrase of [
      'hi, how are you',
      'hi how are you?',
      'hey, good morning',
      'good morning, how are you',
      'hello good afternoon',
      'hey there how are you',
    ]) {
      const result = detectConversationIntent(phrase);
      expect(result.matched, `expected "${phrase}" to match`).toBe(true);
      expect(result.intent?.taskType).toBe(TaskType.CHAT);
    }
  });

  it('does NOT match real tasks (conservative by design)', () => {
    const tasks = [
      'hello, research quantum computing',
      'hey can you debug this code',
      'good morning, what is the weather',
      'how are you able to summarize documents',
      'research the history of Rome',
      'explain how neural networks work',
      'write a python script',
    ];
    for (const task of tasks) {
      expect(detectConversationIntent(task).matched, `expected "${task}" NOT to match`).toBe(false);
    }
  });

  it('returns matched:false for empty input', () => {
    expect(detectConversationIntent('').matched).toBe(false);
    expect(detectConversationIntent('   ').matched).toBe(false);
  });
});
