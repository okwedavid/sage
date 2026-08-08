/**
 * core/intent/conversation-detector.ts
 * OWNS: Deterministic detection of conversational / greeting inputs.
 *
 * WHY: LLM-based classification routinely labels simple greetings ("hello",
 * "hi", "good morning") as RESEARCH with low confidence, which then fails the
 * strict validation gate and produces a "Rejected" reply for perfectly normal
 * conversation. This detector short-circuits THAT class of input — pure
 * greetings and small talk — with a high-confidence CHAT intent, so it never
 * reaches the research gate. Everything else still flows through the LLM
 * classifier and the strict confidence gate unchanged.
 *
 * IMPORTANT: This is intentionally conservative. Matching requires the WHOLE
 * normalized input to be conversational ("hello" ✓, "hello explain X" ✗), so
 * genuine tasks are never swallowed by the shortcut.
 */
import { TaskType, Priority, Status, OutputFormat } from '../enums';
import { createIntent, IntentSchema } from './schemas';

export interface ConversationDetection {
  matched: boolean;
  intent?: IntentSchema;
}

// Whole-string (anchored) patterns. The normalizer lowercases input and
// collapses whitespace, so patterns are written lowercase with single spaces.
const GREETINGS: RegExp[] = [
  /^(?:hello|hi|hey|heya|howdy|yo|sup|hola|bonjour)\b[!.]*$/,
  /^good (?:morning|afternoon|evening|night)[!.]*$/,
  /^(?:hi|hey|hello) there[!.]*$/,
  /^(?:greetings|salutations)[!.]*$/,
];

// Polite openers/closers that a helpful assistant should just acknowledge.
const COURTESIES: RegExp[] = [
  /^(?:thanks|thank you|thank you so much|thx)[!.]*$/,
  /^(?:bye|goodbye|see you|see ya|talk to you later|cya)[!.]*$/,
  /^(?:have a good day|have a nice day|have a great day)[!.]*$/,
];

// Combined openers — common multi-part greetings that must not fall through
// to the LLM (the exact class of input that was mislabeled as RESEARCH).
const COMBINED: RegExp[] = [
  /^(?:hi|hey|hello)[,.!]? (?:good (?:morning|afternoon|evening)|how are you|how'?s it going|what'?s up)[!?]*$/,
  /^good (?:morning|afternoon|evening)[,.!]? (?:how are you|everyone|all)[!?]*$/,
  /^hey (?:there|friend|buddy)[,.!]? (?:how are you|how'?s it going)[!?]*$/,
];

// Small-talk / identity questions — pure conversation, never research.
const SMALL_TALK: RegExp[] = [
  /^how (?:are|r) you(?: doing)?[!?]*$/,
  /^how'?s (?:it going|your day|everything|life)[!?]*$/,
  /^(?:what'?s up|what is up|wassup|sup)[!?]*$/,
  /^(?:how are you doing today|how are you today)[!?]*$/,
  /^(?:nice to meet you|pleased to meet you|good to see you)[!.]*$/,
  /^(?:long time no see)[!.]*$/,
  /^(?:who are you|what are you|what can you do|what can you help me with|help me understand what you do)[!?]*$/,
  /^(?:are you (?:there|awake|real)|you there)[!?]*$/,
  /^(?:ok|okay|fine|great|awesome|cool|nice|good|yes|no|yep|nope|thanks again)[!.]*$/,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

/**
 * Detect whether the normalized input is pure conversation.
 * Returns a high-confidence CHAT intent when matched, so callers can skip the
 * LLM classifier (and its unreliable low-confidence research verdict).
 */
export function detectConversationIntent(normalizedText: string): ConversationDetection {
  const text = normalizedText.trim().toLowerCase();
  if (!text) return { matched: false };

  const isConversational =
    matchesAny(text, GREETINGS) ||
    matchesAny(text, COURTESIES) ||
    matchesAny(text, SMALL_TALK) ||
    matchesAny(text, COMBINED);

  if (!isConversational) return { matched: false };

  return {
    matched: true,
    intent: createIntent({
      inputText: normalizedText,
      taskType: TaskType.CHAT,
      targetDomain: 'General',
      confidenceScore: 0.97, // deterministic — safely above the validation gate
      goal: 'Respond naturally to conversational input',
      priority: Priority.NORMAL,
      status: Status.RECEIVED,
      outputFormat: OutputFormat.MARKDOWN,
    }),
  };
}
