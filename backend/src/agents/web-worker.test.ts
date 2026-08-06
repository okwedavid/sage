/**
 * agents/web-worker.test.ts — Unit tests for the web research worker
 *
 * Global `fetch` is stubbed to return canned HTML; the Groq SDK is mocked.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createIntent } from '../core/intent/schemas';
import { TaskType, Priority, OutputFormat } from '../core/enums';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    groqContent: 'Web intelligence report',
    throwGroq: false,
    fetchImpl: null as any,
    calls: [] as any[],
  },
}));

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    chat = {
      completions: {
        create: async (args: any) => {
          mockState.calls.push(args);
          if (mockState.throwGroq) throw new Error('groq down');
          return { choices: [{ message: { content: mockState.groqContent } }] };
        },
      },
    };
  },
}));

import { WebWorker } from './web-worker';

afterEach(() => {
  mockState.throwGroq = false;
  mockState.calls = [];
  vi.unstubAllGlobals();
});

function intent(inputText: string, overrides: Record<string, any> = {}) {
  return createIntent({
    inputText,
    taskType: TaskType.RESEARCH,
    targetDomain: 'Web',
    goal: 'Analyze the page',
    priority: Priority.NORMAL,
    outputFormat: OutputFormat.MARKDOWN,
    ...overrides,
  });
}

const SAMPLE_HTML =
  '<html><body><h1>Title</h1>' +
  '<p>This is a sufficiently long body paragraph used for testing content extraction.</p>' +
  '<script>window.evil = 1;</script><nav>junk nav</nav></body></html>';

describe('WebWorker', () => {
  it('falls back to knowledge synthesis when no URL is present', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const worker = new WebWorker('gsk_test_key');

    const reply = await worker.execute(intent('tell me about space'));

    expect(reply).toBe('Web intelligence report');
    expect(mockState.calls[0].messages[0].content).toContain('research assistant');
    expect(mockState.calls[0].messages[1].content).toBe('tell me about space');
  });

  it('fetches the URL, strips noise, and analyzes the content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(SAMPLE_HTML, { status: 200 }))
    );
    const worker = new WebWorker('gsk_test_key');

    const reply = await worker.execute(intent('analyze https://example.com/docs'));

    expect(reply).toContain('🌐 **Source:** [https://example.com/docs](https://example.com/docs)');
    const userPrompt = mockState.calls[0].messages[1].content;
    expect(userPrompt).toContain('SOURCE URL: https://example.com/docs');
    expect(userPrompt).toContain('PAGE CONTENT');
    expect(userPrompt).toContain('sufficiently long body paragraph');
    expect(userPrompt).not.toContain('window.evil');
    expect(userPrompt).not.toContain('junk nav');
  });

  it('degrades to a fetch error message when the page returns HTTP 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    const worker = new WebWorker('gsk_test_key');

    const reply = await worker.execute(intent('check https://example.com/missing'));

    expect(reply).toContain('⚠️ Could not fetch https://example.com/missing');
    expect(reply).toContain('HTTP 404');
    // fallback still runs with the user question
    expect(reply).toContain('Web intelligence report');
  });

  it('degrades gracefully when the network call throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      })
    );
    const worker = new WebWorker('gsk_test_key');

    const reply = await worker.execute(intent('check https://example.com'));

    expect(reply).toContain('Could not fetch');
    expect(reply).toContain('ECONNREFUSED');
  });

  it('returns an error string plus fallback when Groq fails after a fetch', async () => {
    mockState.throwGroq = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(SAMPLE_HTML, { status: 200 }))
    );
    const worker = new WebWorker('gsk_test_key');

    const reply = await worker.execute(intent('analyze https://example.com'));

    expect(reply).toContain('WebWorker ERROR');
    expect(reply).toContain('groq down');
    expect(reply).toContain('Fallback');
  });
});
