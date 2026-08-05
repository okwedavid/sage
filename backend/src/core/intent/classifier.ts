/**
 * core/intent/classifier.ts
 * OWNS: Groq LLM-based intent classification
 * EXPOSES: classify()
 */
import Groq from 'groq-sdk';
import { TaskType, Priority, Status, OutputFormat } from '../enums';
import { IntentSchema, createIntent } from './schemas';
import { Settings } from '../../config/settings';

const CLASSIFIER_PROMPT = `You are SAGE-Classifier, a highly precise intent recognition engine.
Your ONLY job is to analyze user input and convert it into structured JSON.

CRITICAL RULES:
1. Identify the PRIMARY intent.
2. Classify the DOMAIN (e.g., Coding, Networking, Finance, Creative Writing, Web, Software Architecture).
3. Assign PRIORITY based on urgency words (e.g., "fix", "emergency", "help" = HIGH, normal = NORMAL).
4. If input contains a URL/link, set task_type to "RESEARCH" or "ANALYZE" and target_domain to "Web".
5. If input mentions image, diagram, picture → task_type ANALYZE, domain Computer Vision or relevant.
6. Return EXACTLY valid JSON, nothing else.
7. Do not solve the task. Only classify it.

AVAILABLE TASK_TYPES: [BUILD, ANALYZE, RESEARCH, SUMMARIZE, PLAN, DEBUG, EXPLAIN, GENERATE, TRANSLATE, REVIEW]
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
  private client: Groq;
  private model: string;

  constructor(apiKey: string, customModel?: string) {
    if (!apiKey?.trim().startsWith('gsk_')) {
      throw new Error('Classifier requires valid Groq API key starting with gsk_');
    }
    this.client = new Groq({ apiKey: apiKey.trim() });
    this.model = customModel || Settings.DEFAULT_MODEL;
  }

  private containsUrl(text: string): boolean {
    return /https?:\/\/[^\s]+/i.test(text);
  }

  async classify(textInput: string): Promise<IntentSchema> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: CLASSIFIER_PROMPT },
          { role: 'user', content: `Classify this intent:\n\n${textInput}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 300,
      });

      const raw = response.choices[0].message.content || '{}';
      const data = JSON.parse(raw);

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
