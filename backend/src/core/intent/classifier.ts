/**
 * core/intent/classifier.ts
 * OWNS: Groq LLM-based intent classification
 * EXPOSES: classify()
 */
import Groq from 'groq-sdk';
import { TaskType, Priority, Status, OutputFormat } from '../enums';
import { IntentSchema, createIntent } from './schemas';
import { detectConversationIntent } from './conversation-detector';
import { Settings } from '../../config/settings';
import { withRetry } from '../../services/retry';
import { ChatGateway } from '../../providers/gateway';

const CLASSIFIER_PROMPT = `You are SAGE-Classifier, a highly precise intent recognition engine.
Your ONLY job is to analyze user input and convert it into structured JSON.

CRITICAL RULES:
1. Identify the PRIMARY intent.
2. Classify the DOMAIN (e.g., Coding, Networking, Finance, Creative Writing, Web, Software Architecture).
3. Assign PRIORITY based on urgency words (e.g., "fix", "emergency", "help" = HIGH, normal = NORMAL).
4. If input contains a URL/link, set task_type to "RESEARCH" or "ANALYZE" and target_domain to "Web".
5. If input mentions image, diagram, picture → task_type ANALYZE, domain Computer Vision or relevant.
6. If the input is a greeting, small talk, or casual conversation (e.g. "hello", "hi", "how are you", "thanks"), set task_type to "CHAT" with confidence_score 0.95.
7. Return EXACTLY valid JSON, nothing else.
8. Do not solve the task. Only classify it.

AVAILABLE TASK_TYPES: [BUILD, ANALYZE, RESEARCH, SUMMARIZE, PLAN, DEBUG, EXPLAIN, GENERATE, TRANSLATE, REVIEW, CHAT]
AVAILABLE PRIORITIES: [LOW, NORMAL, HIGH, CRITICAL]

JSON FORMAT:
{
    "task_type": "DEBUG",
    "target_domain": "Python",
    "confidence_score": 0.95,
    "priority": "HIGH",
    "entities": {},
    "summary": "One sentence summary of user goal."
}`;

export class IntentClassifier {
  private client: Groq | null = null;
  private model: string;
  private gateway?: ChatGateway;

  constructor(apiKey: string, customModel?: string, gateway?: ChatGateway) {
    // When a user-selected provider gateway is active, the Groq SDK is not
    // constructed — the gateway normalizes every provider into one schema.
    this.gateway = gateway;
    if (gateway) {
      this.model = gateway.model;
      return;
    }
    if (!apiKey?.trim().startsWith('gsk_')) {
      throw new Error('Classifier requires valid Groq API key starting with gsk_');
    }
    this.client = new Groq({ apiKey: apiKey.trim() });
    this.model = customModel || Settings.DEFAULT_MODEL;
  }

  private groq(): Groq {
    if (!this.client) {
      throw new Error('Classifier Groq client unavailable');
    }
    return this.client;
  }

  private containsUrl(text: string): boolean {
    return /https?:\/\/[^\s]+/i.test(text);
  }

  async classify(textInput: string): Promise<IntentSchema> {
    // Deterministic conversational shortcut: pure greetings/small-talk are
    // classified with high confidence WITHOUT the LLM, so they can never be
    // mislabeled as low-confidence RESEARCH and rejected by the gate.
    const conversation = detectConversationIntent(textInput);
    if (conversation.matched && conversation.intent) {
      console.log(`💬 [Classifier] Conversational input → CHAT (${(conversation.intent.confidenceScore * 100).toFixed(0)}%)`);
      return conversation.intent;
    }

    try {
      let raw: string;
      if (this.gateway) {
        const res = await this.gateway.complete(
          [
            { role: 'system', content: CLASSIFIER_PROMPT },
            { role: 'user', content: `Classify this intent:\n\n${textInput}` },
          ],
          {
            jsonMode: true,
            temperature: 0.1,
            maxTokens: 300,
            // A hung model call must never hang the request indefinitely.
            signal: AbortSignal.timeout(Settings.GROQ_TIMEOUT_MS),
          }
        );
        raw = res.content || '{}';
      } else {
        const response = await withRetry(
          () =>
            this.groq().chat.completions.create(
              {
                model: this.model,
                messages: [
                  { role: 'system', content: CLASSIFIER_PROMPT },
                  { role: 'user', content: `Classify this intent:\n\n${textInput}` },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1,
                max_tokens: 300,
              },
              // A hung model call must never hang the request indefinitely.
              { signal: AbortSignal.timeout(Settings.GROQ_TIMEOUT_MS) }
            ),
          { attempts: 2 }
        );
        raw = response.choices[0].message.content || '{}';
      }

      // Malformed provider responses must never crash classification — extract
      // the first JSON object when the model wrapped it in prose.
      const data = extractJsonObject(raw);

      let taskTypeStr = (data.task_type || 'REVIEW').toUpperCase();
      if (this.containsUrl(textInput) && !['RESEARCH', 'ANALYZE'].includes(taskTypeStr)) {
        taskTypeStr = 'RESEARCH';
        data.target_domain = 'Web';
      }

      if (!Object.values(TaskType).includes(taskTypeStr as TaskType)) {
        taskTypeStr = 'REVIEW';
      }

      const prio = (data.priority || 'NORMAL').toUpperCase();
      const validPriority = Object.values(Priority).includes(prio as Priority)
        ? (prio as Priority)
        : Priority.NORMAL;

      // Clamp confidence to [0,1] — a rogue/malformed model response must not
      // crash createIntent (which rejects out-of-range values).
      const rawConfidence = parseFloat(data.confidence_score);
      const confidenceScore = Number.isFinite(rawConfidence)
        ? Math.min(1, Math.max(0, rawConfidence))
        : 0.85;

      return createIntent({
        inputText: textInput,
        taskType: taskTypeStr as TaskType,
        targetDomain: data.target_domain || 'General',
        confidenceScore,
        goal: data.summary || '',
        priority: validPriority,
        entities: data.entities || {},
        status: Status.RECEIVED,
        outputFormat: OutputFormat.MARKDOWN,
      });
    } catch (error) {
      console.warn(`⚠️ Classifier fallback due to error: ${error}`);
      return createIntent({
        inputText: textInput,
        taskType: TaskType.REVIEW,
        targetDomain: 'General',
        confidenceScore: 0.5,
        goal: textInput.slice(0, 100),
        priority: Priority.NORMAL,
        status: Status.RECEIVED,
        outputFormat: OutputFormat.MARKDOWN,
      });
    }
  }
}

/**
 * Tolerantly parse a JSON object from a model reply. Accepts pure JSON, or a
 * reply that wraps JSON in prose (common with providers that lack a strict
 * json_object mode). Throws when no object can be found.
 */
function extractJsonObject(raw: string): Record<string, any> {
  const text = (raw || '').trim();
  if (!text) throw new Error('Empty classifier response');
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    throw new Error('Classifier response is not a JSON object');
  } catch {
    // Fall back to the first balanced {...} block in the reply.
    const start = text.indexOf('{');
    if (start >= 0) {
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const candidate = text.slice(start, i + 1);
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
          }
        }
      }
    }
    throw new Error('No JSON object found in classifier response');
  }
}
