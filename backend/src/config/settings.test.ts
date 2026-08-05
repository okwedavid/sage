/**
 * config/settings.test.ts — Configuration validation (assertProductionSafe)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// Every test re-imports Settings with a fresh process.env so the frozen
// singleton reflects the stub values.
async function loadSettings() {
  vi.resetModules();
  const mod = await import('./settings');
  return mod.Settings;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Settings.assertProductionSafe', () => {
  it('flags the default dev JWT secret', async () => {
    vi.stubEnv('JWT_SECRET', 'sage-dev-secret');
    vi.stubEnv('GROQ_API_KEY', 'gsk_ok');
    vi.stubEnv('FRONTEND_URL', 'https://app.sage.ai');
    const Settings = await loadSettings();
    const problems = Settings.assertProductionSafe();
    expect(problems.some((p) => p.includes('JWT_SECRET'))).toBe(true);
  });

  it('flags short JWT secrets', async () => {
    vi.stubEnv('JWT_SECRET', 'short');
    vi.stubEnv('GROQ_API_KEY', 'gsk_ok');
    vi.stubEnv('FRONTEND_URL', 'https://app.sage.ai');
    const Settings = await loadSettings();
    expect(Settings.assertProductionSafe().some((p) => p.includes('JWT_SECRET'))).toBe(true);
  });

  it('flags a missing or invalid Groq key', async () => {
    vi.stubEnv('JWT_SECRET', 'x'.repeat(32));
    vi.stubEnv('GROQ_API_KEY', 'not-a-gsk-key');
    vi.stubEnv('FRONTEND_URL', 'https://app.sage.ai');
    const Settings = await loadSettings();
    expect(Settings.assertProductionSafe().some((p) => p.includes('GROQ_API_KEY'))).toBe(true);
  });

  it('flags mismatched Supabase URL/key pairs', async () => {
    vi.stubEnv('JWT_SECRET', 'x'.repeat(32));
    vi.stubEnv('GROQ_API_KEY', 'gsk_ok');
    vi.stubEnv('FRONTEND_URL', 'https://app.sage.ai');
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    // SUPABASE_SERVICE_KEY left unset
    const Settings = await loadSettings();
    expect(Settings.assertProductionSafe().some((p) => p.includes('SUPABASE'))).toBe(true);
  });

  it('flags a localhost frontend URL', async () => {
    vi.stubEnv('JWT_SECRET', 'x'.repeat(32));
    vi.stubEnv('GROQ_API_KEY', 'gsk_ok');
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');
    const Settings = await loadSettings();
    expect(Settings.assertProductionSafe().some((p) => p.includes('FRONTEND_URL'))).toBe(true);
  });

  it('passes with a fully valid production configuration', async () => {
    vi.stubEnv('JWT_SECRET', 'a-very-long-random-secret-string-1234567890');
    vi.stubEnv('GROQ_API_KEY', 'gsk_prod_ok');
    vi.stubEnv('FRONTEND_URL', 'https://app.sage.ai');
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_KEY', 'service-key');
    const Settings = await loadSettings();
    expect(Settings.assertProductionSafe()).toEqual([]);
  });
});
