/**
 * providers/service.ts
 * OWNS: The provider credential lifecycle (Phase 2):
 *   1. registration   2. secure storage   3. validation   4. identification
 *   5. model discovery 6. model selection 7. health checks 8. revocation
 *   9. multiple providers/user  10. multiple models/provider
 *
 * Credentials are encrypted at rest (AES-256-GCM). Plaintext keys exist only
 * transiently in memory and never cross the API boundary.
 */
import { randomUUID } from 'node:crypto';
import {
  isSupabaseConfigured,
  createProviderCredential as dbCreate,
  listProviderCredentials as dbList,
  getProviderCredential as dbGet,
  updateProviderCredential as dbUpdate,
  deleteProviderCredential as dbDelete,
  recordAudit,
} from '../services/supabase';
import { encryptSecret, decryptSecret, maskSecret, isCredentialEncryptionReady } from './credentials';
import { ChatGateway } from './gateway';
import { ModelInfo, ProviderId } from './types';
import { getAdapter, getCatalogEntry, getCustomAdapter, getProviderId } from './adapters';

export interface ProviderCredential {
  id: string;
  userId: string;
  provider: ProviderId;
  label: string;
  model: string | null;
  baseUrl: string | null;
  status: 'active' | 'error';
  lastCheckedAt: string | null;
  lastError: string | null;
  capabilities: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectInput {
  provider: string;
  apiKey: string;
  label?: string;
  baseUrl?: string;
  model?: string;
  /** Only honored for configurable-vision providers (openai-compatible). */
  supportsVision?: boolean;
}

export interface ConnectResult {
  ok: boolean;
  error?: string;
  record?: ProviderCredential;
  models?: ModelInfo[];
}

// ── Limits ──────────────────────────────────────────────────────────────────
/** Maximum provider credentials a single user may store. */
export const MAX_PROVIDER_CREDENTIALS = 10;

// ── In-memory fallback store (demo/local runs without Supabase) ─────────────
const memCredentials = new Map<string, ProviderCredential & { encryptedKey: string }>();

/** Test hook: clear the in-memory store between tests (mirrors billing.ts). */
export function resetProviderStoreForTesting(): void {
  memCredentials.clear();
}

function toPublicShape(row: any): ProviderCredential {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    provider: row.provider,
    label: row.label || '',
    model: row.model ?? null,
    baseUrl: row.base_url ?? row.baseUrl ?? null,
    status: row.status === 'error' ? 'error' : 'active',
    lastCheckedAt: row.last_checked_at ?? row.lastCheckedAt ?? null,
    lastError: row.last_error ?? row.lastError ?? null,
    capabilities: row.capabilities ?? {},
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

function publicFromDb(row: any): ProviderCredential {
  return toPublicShape(row);
}

async function resolveEncryptedKey(userId: string, id: string): Promise<string> {
  if (isSupabaseConfigured()) {
    const row = await dbGet(userId, id);
    if (!row?.encrypted_key) throw new Error('Provider credential payload is missing');
    return row.encrypted_key;
  }
  const mem = memCredentials.get(id);
  if (!mem || mem.userId !== userId) throw new Error('Provider credential not found in memory store');
  return mem.encryptedKey;
}

class ProviderServiceImpl {
  // ── Registration + validation ─────────────────────────────────────────────
  async connect(userId: string, input: ConnectInput): Promise<ConnectResult> {
    const providerId = getProviderId(input.provider);
    if (!providerId) {
      return { ok: false, error: `Unsupported provider: ${input.provider}` };
    }
    const catalog = getCatalogEntry(providerId);
    if (!catalog) return { ok: false, error: 'Unknown provider' };

    const key = (input.apiKey || '').trim();
    if (!key && providerId !== 'openai-compatible') {
      return { ok: false, error: 'API key is required' };
    }
    const baseUrl = (input.baseUrl || '').trim() || undefined;
    if (catalog.requiresBaseUrl && !baseUrl) {
      return { ok: false, error: 'A base URL is required for this provider (e.g. http://localhost:11434/v1)' };
    }
    // SSRF guard: the server will fetch this URL, so only allow http(s) origins.
    if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
      return { ok: false, error: 'baseUrl must start with http:// or https://' };
    }
    // Per-user cap so a single account cannot flood the store with credentials.
    const existingCreds = await this.list(userId);
    if (existingCreds.length >= MAX_PROVIDER_CREDENTIALS) {
      return {
        ok: false,
        error: `You can connect up to ${MAX_PROVIDER_CREDENTIALS} provider credentials. Revoke one to connect another.`,
      };
    }
    // Never persist a raw key we failed to encrypt safely.
    if (!isCredentialEncryptionReady()) {
      return {
        ok: false,
        error:
          'Credential encryption is not configured. Set SAGE_CREDENTIAL_ENCRYPTION_KEY in the environment.',
      };
    }

    const adapter = providerId === 'openai-compatible' ? getCustomAdapter({ vision: !!input.supportsVision }) : getAdapter(providerId);
    if (!adapter) return { ok: false, error: 'Provider adapter unavailable' };

    // Resolve the model: explicit selection → catalog default → first catalog hit.
    let model = (input.model || '').trim() || catalog.defaultModel || undefined;
    let models: ModelInfo[] = [];

    // 3. Credential validation (real probe).
    const probe = new ChatGateway(adapter, key, { model: model || 'probe', baseUrl });
    const validation = await probe.validate();
    if (!validation.ok) {
      return { ok: false, error: `Validation failed: ${validation.error || 'provider rejected the credential'}` };
    }

    // 5. Model discovery (best-effort; never blocks a successful connect).
    try {
      models = await probe.listModels();
      if (!model && models.length > 0) model = models[0].id;
      if (model && models.length > 0 && !models.some((m) => m.id === model)) {
        // Keep the explicit model but note it was not in the catalog.
        models.unshift({ id: model });
      }
    } catch (error: any) {
      console.warn(`[providers] model discovery failed for ${providerId}: ${error?.message}`);
      if (!model) model = catalog.defaultModel || undefined;
    }

    // 2. Secure storage (encrypted at rest).
    const encryptedKey = encryptSecret(key);
    const capabilities = { vision: !!input.supportsVision };

    let saved: any;
    if (isSupabaseConfigured()) {
      saved = await dbCreate({
        userId,
        provider: providerId,
        label: (input.label || '').trim().slice(0, 80) || catalog.label,
        encryptedKey,
        baseUrl,
        model: model || undefined,
        capabilities,
      });
      if (!saved) return { ok: false, error: 'Failed to persist provider credential' };
    } else {
      const record: ProviderCredential & { encryptedKey: string } = {
        id: randomUUID(),
        userId,
        provider: providerId,
        label: (input.label || '').trim().slice(0, 80) || catalog.label,
        model: model || null,
        baseUrl: baseUrl || null,
        status: 'active',
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
        capabilities,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        encryptedKey,
      };
      memCredentials.set(record.id, record);
      saved = record;
    }

    await recordAudit({
      actorType: 'user',
      actorId: userId,
      action: 'provider.connected',
      resource: `${providerId}:${saved.id}`,
    });

    return { ok: true, record: publicFromDb(saved), models };
  }

  // ── Listing (masked, key never included) ──────────────────────────────────
  async list(userId: string): Promise<ProviderCredential[]> {
    if (isSupabaseConfigured()) {
      const rows = await dbList(userId);
      return (rows || []).map(publicFromDb);
    }
    return Array.from(memCredentials.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => toPublicShape(c));
  }

  async get(userId: string, id: string): Promise<ProviderCredential | null> {
    const all = await this.list(userId);
    return all.find((c) => c.id === id) || null;
  }

  // ── Model discovery + selection ───────────────────────────────────────────
  async listModels(userId: string, id: string): Promise<{ models: ModelInfo[]; error?: string }> {
    const cred = await this.get(userId, id);
    if (!cred) return { models: [], error: 'Provider credential not found' };
    try {
      const gateway = await this.gatewayFor(cred);
      const models = await gateway.listModels();
      return { models };
    } catch (error: any) {
      return { models: [], error: error?.message || 'Model discovery failed' };
    }
  }

  async selectModel(userId: string, id: string, model: string): Promise<{ ok: boolean; error?: string }> {
    if (!model || model.length > 200) return { ok: false, error: 'Invalid model id' };
    const cred = await this.get(userId, id);
    if (!cred) return { ok: false, error: 'Provider credential not found' };

    const ok = await this.updateCred(userId, id, { model });
    if (!ok) return { ok: false, error: 'Failed to update model' };
    await recordAudit({ actorType: 'user', actorId: userId, action: 'provider.model_selected', resource: id });
    return { ok: true };
  }

  // ── Health check ──────────────────────────────────────────────────────────
  async healthCheck(userId: string, id: string): Promise<{ ok: boolean; models?: ModelInfo[]; error?: string }> {
    const cred = await this.get(userId, id);
    if (!cred) return { ok: false, error: 'Provider credential not found' };
    try {
      const gateway = await this.gatewayFor(cred);
      const validation = await gateway.validate();
      let models: ModelInfo[] = [];
      if (validation.ok) {
        try {
          models = await gateway.listModels();
        } catch {
          /* catalog optional */
        }
      }
      await this.updateCred(userId, id, {
        status: validation.ok ? 'active' : 'error',
        lastError: validation.ok ? null : validation.error || 'health check failed',
        lastCheckedAt: new Date().toISOString(),
      });
      return { ok: validation.ok, models, error: validation.ok ? undefined : validation.error };
    } catch (error: any) {
      await this.updateCred(userId, id, {
        status: 'error',
        lastError: error?.message || 'health check failed',
        lastCheckedAt: new Date().toISOString(),
      });
      return { ok: false, error: error?.message || 'Health check failed' };
    }
  }

  async updateCred(
    userId: string,
    id: string,
    fields: { model?: string; label?: string; status?: string; lastError?: string | null; lastCheckedAt?: string; capabilities?: Record<string, any> }
  ): Promise<boolean> {
    if (isSupabaseConfigured()) {
      return dbUpdate(userId, id, {
        ...(fields.model !== undefined ? { model: fields.model } : {}),
        ...(fields.label !== undefined ? { label: fields.label } : {}),
        ...(fields.status !== undefined ? { status: fields.status } : {}),
        ...(fields.lastError !== undefined ? { last_error: fields.lastError } : {}),
        ...(fields.lastCheckedAt !== undefined ? { last_checked_at: fields.lastCheckedAt } : {}),
        ...(fields.capabilities !== undefined ? { capabilities: fields.capabilities } : {}),
      });
    }
    const mem = memCredentials.get(id);
    if (!mem || mem.userId !== userId) return false;
    if (fields.model !== undefined) mem.model = fields.model;
    if (fields.label !== undefined) mem.label = fields.label;
    if (fields.status !== undefined) mem.status = fields.status as any;
    if (fields.lastError !== undefined) mem.lastError = fields.lastError;
    if (fields.lastCheckedAt !== undefined) mem.lastCheckedAt = fields.lastCheckedAt;
    if (fields.capabilities !== undefined) mem.capabilities = fields.capabilities;
    mem.updatedAt = new Date().toISOString();
    return true;
  }

  // ── Key rotation ──────────────────────────────────────────────────────────
  /**
   * Replace/rotate a credential's API key: the new key is validated against
   * the live provider BEFORE it is encrypted and persisted, so a bad key can
   * never overwrite a working one. The plaintext key never crosses the API
   * boundary and is never logged.
   */
  async rotateKey(
    userId: string,
    id: string,
    apiKey: string
  ): Promise<{ ok: boolean; error?: string; record?: ProviderCredential }> {
    const cred = await this.get(userId, id);
    if (!cred) return { ok: false, error: 'Provider credential not found' };

    const key = (apiKey || '').trim();
    if (!key) return { ok: false, error: 'API key is required' };
    if (key.length > 500) return { ok: false, error: 'apiKey is too long' };

    const adapter =
      cred.provider === 'openai-compatible'
        ? getCustomAdapter({ vision: !!cred.capabilities?.vision })
        : getAdapter(cred.provider);
    if (!adapter) return { ok: false, error: 'Provider adapter unavailable' };

    const model = cred.model || getCatalogEntry(cred.provider)?.defaultModel || '';
    const probe = new ChatGateway(adapter, key, { model: model || 'probe', baseUrl: cred.baseUrl || undefined });
    const validation = await probe.validate();
    if (!validation.ok) {
      return { ok: false, error: `Validation failed: ${validation.error || 'provider rejected the credential'}` };
    }

    const encryptedKey = encryptSecret(key);
    let ok = false;
    if (isSupabaseConfigured()) {
      ok = await dbUpdate(userId, id, {
        encrypted_key: encryptedKey,
        status: 'active',
        last_error: null,
        last_checked_at: new Date().toISOString(),
      });
    } else {
      const mem = memCredentials.get(id);
      if (mem && mem.userId === userId) {
        mem.encryptedKey = encryptedKey;
        mem.status = 'active';
        mem.lastError = null;
        mem.lastCheckedAt = new Date().toISOString();
        mem.updatedAt = new Date().toISOString();
        ok = true;
      }
    }
    if (!ok) return { ok: false, error: 'Failed to rotate provider credential' };

    await recordAudit({ actorType: 'user', actorId: userId, action: 'provider.key_rotated', resource: id });
    const fresh = await this.get(userId, id);
    return { ok: true, record: fresh || undefined };
  }

  // ── Revocation ────────────────────────────────────────────────────────────
  async revoke(userId: string, id: string): Promise<{ ok: boolean; error?: string }> {
    const cred = await this.get(userId, id);
    if (!cred) return { ok: false, error: 'Provider credential not found' };

    let ok = false;
    if (isSupabaseConfigured()) {
      ok = await dbDelete(userId, id);
    } else {
      const mem = memCredentials.get(id);
      if (mem && mem.userId === userId) {
        memCredentials.delete(id);
        ok = true;
      }
    }
    if (ok) {
      await recordAudit({ actorType: 'user', actorId: userId, action: 'provider.revoked', resource: id });
    }
    return ok ? { ok: true } : { ok: false, error: 'Failed to revoke provider credential' };
  }

  // ── Gateway resolution (used by the chat pipeline) ────────────────────────
  /**
   * Build a working gateway for a stored credential (decrypts the key).
   * Returns null when the credential is missing or unusable. Never logs or
   * returns the decrypted key.
   */
  async gatewayFor(cred: ProviderCredential): Promise<ChatGateway> {
    const encrypted = await resolveEncryptedKey(cred.userId, cred.id);
    const key = decryptSecret(encrypted);
    const adapter =
      cred.provider === 'openai-compatible'
        ? getCustomAdapter({ vision: !!cred.capabilities?.vision })
        : getAdapter(cred.provider);
    if (!adapter) throw new Error(`No adapter for provider: ${cred.provider}`);
    const model = cred.model || getCatalogEntry(cred.provider)?.defaultModel || '';
    if (!model) throw new Error('No model selected for this provider');
    return new ChatGateway(adapter, key, { model, baseUrl: cred.baseUrl || undefined });
  }

  /** Resolve the effective gateway for a user request (null → server default). */
  async resolveGateway(userId: string, providerId?: string): Promise<ChatGateway | null> {
    if (!providerId) return null;
    const creds = await this.list(userId);
    const cred = creds.find((c) => c.id === providerId && c.status === 'active');
    if (!cred) return null;
    try {
      return await this.gatewayFor(cred);
    } catch (error: any) {
      console.warn(`[providers] gateway resolution failed: ${error?.message}`);
      return null;
    }
  }

  /** Mask helper re-exported for routes (never reveal keys). */
  mask(secret: string): string {
    return maskSecret(secret);
  }
}

export const providerService = new ProviderServiceImpl();
export type ProviderServiceImplType = ProviderServiceImpl;
