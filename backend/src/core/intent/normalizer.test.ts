/**
 * core/intent/normalizer.test.ts — Unit tests for text normalization
 */
import { describe, it, expect } from 'vitest';
import { IntentNormalizer } from './normalizer';

const normalizer = new IntentNormalizer();

describe('IntentNormalizer', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizer.normalize('  hello world  ')).toBe('hello world');
  });

  it('collapses multiple whitespace', () => {
    expect(normalizer.normalize('hello    world\n\nnext line')).toBe('hello world next line');
  });

  it('removes emojis', () => {
    expect(normalizer.normalize('hello 😀 world')).toBe('hello world');
    expect(normalizer.normalize('🔥🔥🔥 fire')).toBe('fire');
  });

  it('reduces repeated punctuation', () => {
    expect(normalizer.normalize('really???')).toBe('really?');
    expect(normalizer.normalize('wow!!!')).toBe('wow!');
  });

  it('lowercases text', () => {
    expect(normalizer.normalize('Hello WORLD')).toBe('hello world');
  });

  it('throws on empty input', () => {
    expect(() => normalizer.normalize('')).toThrow();
    expect(() => normalizer.normalize('   ')).toThrow();
  });

  it('handles a realistic message end-to-end', () => {
    const result = normalizer.normalize('  EXPLAIN  Quantum Computing 🧠  in detail!!!  ');
    expect(result).toBe('explain quantum computing in detail!');
  });
});
