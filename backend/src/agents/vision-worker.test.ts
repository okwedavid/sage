/**
 * agents/vision-worker.test.ts — Unit tests for the multimodal vision worker
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createIntent } from '../core/intent/schemas';
import { TaskType, Priority, OutputFormat } from '../core/enums';
import { Settings } from '../config/settings';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    failModels: {} as Record<string, string>,
    successContent: 'The image shows a network diagram.',
    calls: [] as any[],
  },
}));

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    chat = {
      completions: {
        create: async (args: any) => {
          mockState.calls.push(args);
          if (mockState.failModels[args.model]) {
            throw new Error(mockState.failModels[args.model]);
          }
          return { choices: [{ message: { content: mockState.successContent } }] };
        },
      },
    };
  },
}));

import { VisionWorker } from './vision-worker';

afterEach(() => {
  mockState.failModels = {};
  mockState.calls = [];
});

function visionIntent(overrides: Record<string, any> = {}) {
  return createIntent({
    inputText: 'What is in this diagram?',
    taskType: TaskType.ANALYZE,
    targetDomain: 'Computer Vision',
    goal: 'Analyze image',
    priority: Priority.NORMAL,
    outputFormat: OutputFormat.MARKDOWN,
    attachments: {
      image_base64: 'aGVsbG8gd29ybGQ=', // "hello world"
      image_type: 'png',
      image_name: 'diagram.png',
    },
    ...overrides,
  });
}

describe('VisionWorker', () => {
  it('falls back to text analysis when no image is attached', async () => {
    const worker = new VisionWorker('gsk_test_key');

    const reply = await worker.execute(visionIntent({ attachments: {} }));

    expect(reply).toBe(mockState.successContent);
    const call = mockState.calls[0];
    expect(call.model).toBe(Settings.DEFAULT_MODEL);
    expect(call.messages[0].content).toContain('SAGE Vision assistant');
  });

  it('analyzes an image with the default question for attachment-only input', async () => {
    const worker = new VisionWorker('gsk_test_key');

    const reply = await worker.execute(visionIntent({ inputText: '[Image attached]' }));

    expect(reply).toContain('👁️ **Vision Analysis**');
    expect(reply).toContain('llama-3.2-11b-vision-preview');
    const content = mockState.calls[0].messages[0].content;
    expect(content[0].text).toContain('Analyze this image in detail');
    expect(content[1].image_url.url).toBe('data:image/png;base64,aGVsbG8gd29ybGQ=');
  });

  it('uses the user question verbatim when provided', async () => {
    const worker = new VisionWorker('gsk_test_key');

    await worker.execute(visionIntent({ inputText: 'Count the nodes in this diagram' }));

    expect(mockState.calls[0].messages[0].content[0].text).toBe(
      'Count the nodes in this diagram'
    );
  });

  it('falls through to the next vision model when one is decommissioned', async () => {
    mockState.failModels = {
      'llama-3.2-11b-vision-preview': 'Model llama-3.2-11b-vision-preview has been decommissioned',
    };
    const worker = new VisionWorker('gsk_test_key');

    const reply = await worker.execute(visionIntent());

    expect(reply).toContain('llama-3.2-90b-vision-preview'); // second model used
    expect(reply).not.toContain('Unavailable');
    expect(mockState.calls.map((c: any) => c.model)).toContain('llama-3.2-90b-vision-preview');
  });

  it('reports unavailable after every model fails', async () => {
    mockState.failModels = {
      'llama-3.2-11b-vision-preview': 'Model not found',
      'llama-3.2-90b-vision-preview': 'Model not found',
      [Settings.VISION_MODEL]: 'Model not found',
    };
    const worker = new VisionWorker('gsk_test_key');

    const reply = await worker.execute(visionIntent());

    expect(reply).toContain('⚠️ **Vision Analysis Unavailable**');
    expect(mockState.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('stops trying after a non-retryable error (e.g. auth)', async () => {
    mockState.failModels = {
      'llama-3.2-11b-vision-preview': 'Invalid API key',
    };
    const worker = new VisionWorker('gsk_test_key');

    const reply = await worker.execute(visionIntent());

    expect(reply).toContain('Vision Analysis Unavailable');
    expect(reply).toContain('Invalid API key');
    expect(mockState.calls).toHaveLength(1); // break, not continue
  });

  it('returns a fallback error string when the text fallback fails', async () => {
    mockState.failModels = { [Settings.DEFAULT_MODEL]: 'rate limited' };
    const worker = new VisionWorker('gsk_test_key');

    const reply = await worker.execute(visionIntent({ attachments: {} }));

    expect(reply).toContain('[VisionWorker Fallback ERROR]');
    expect(reply).toContain('rate limited');
  });
});
