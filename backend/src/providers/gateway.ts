/**
 * providers/gateway.ts
 * OWNS: ChatGateway — the single door Sage walks through to reach any model.
 *
 * The rest of the pipeline only ever sees `ChatGateway.complete()` returning
 * `NormalizedChatResponse`. Which provider produced the reply, and how its
 * wire format differs, is entirely an adapter concern (Phase 3).
 */
import {
  ChatRequest,
  ModelInfo,
  ModelDescriptor,
  NormalizedChatResponse,
  NormalizedMessage,
  ProviderId,
} from './types';
import { ProviderAdapter, ValidationResult } from './adapters/base';
import { withRetry } from '../services/retry';

export interface GatewayOptions {
  model: string;
  baseUrl?: string;
}

export interface CompleteOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
}

export interface ImageInput {
  base64: string;
  mimeType: string;
}

export class ChatGateway {
  constructor(
    private readonly adapter: ProviderAdapter,
    private readonly apiKey: string,
    private readonly opts: GatewayOptions
  ) {}

  get providerId(): string {
    return this.adapter.id;
  }

  get model(): string {
    return this.opts.model;
  }

  get baseUrl(): string | undefined {
    return this.opts.baseUrl;
  }

  /** A sibling gateway bound to a different model of the same provider. */
  withModel(model: string): ChatGateway {
    return new ChatGateway(this.adapter, this.apiKey, { model, baseUrl: this.opts.baseUrl });
  }

  /** Normalized chat completion with retry + timeout hygiene. */
  async complete(messages: NormalizedMessage[], options: CompleteOptions = {}): Promise<NormalizedChatResponse> {
    const request: ChatRequest = {
      apiKey: this.apiKey,
      baseUrl: this.opts.baseUrl,
      model: this.opts.model,
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonMode: options.jsonMode,
      signal: options.signal,
    };
    return withRetry(() => this.adapter.chatComplete(request), { attempts: 2 });
  }

  /** Normalized image analysis: text + one image part. */
  async analyzeImage(text: string, image: ImageInput, options: CompleteOptions = {}): Promise<NormalizedChatResponse> {
    const messages: NormalizedMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text },
          { type: 'image', base64: image.base64, mimeType: image.mimeType },
        ],
      },
    ];
    return this.complete(messages, options);
  }

  async supportsVision(): Promise<boolean> {
    return this.adapter.supportsVision(this.apiKey, this.opts.model, this.opts.baseUrl);
  }

  async visionModels(): Promise<string[]> {
    return this.adapter.visionModels(this.apiKey, this.opts.baseUrl);
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.adapter.listModels(this.apiKey, this.opts.baseUrl);
  }

  async validate(): Promise<ValidationResult> {
    return this.adapter.validateCredential(this.apiKey, this.opts.baseUrl);
  }

  async toDescriptor(): Promise<ModelDescriptor> {
    return {
      provider: this.adapter.id as ProviderId,
      model: this.opts.model,
      vision: await this.supportsVision(),
    };
  }
}
