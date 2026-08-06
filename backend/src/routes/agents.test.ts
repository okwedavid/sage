/**
 * routes/agents.test.ts — Integration tests for the agent info endpoints
 */
import { describe, it, expect, vi } from 'vitest';
import { withServer, jsonFetch } from '../test-utils/http';

vi.hoisted(() => {
  process.env.GROQ_API_KEY = 'gsk_test_server_key';
});

import app from '../index';

describe('GET /api/agents', () => {
  it('lists all registered agents', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/agents`);
      expect(status).toBe(200);
      expect(Array.isArray(body.agents)).toBe(true);
      expect(body.agents.length).toBeGreaterThanOrEqual(3);
      const names = body.agents.map((a: any) => a.name);
      expect(names).toContain('GeneralWorker');
      expect(names).toContain('WebWorker');
      expect(names).toContain('VisionWorker');
      const general = body.agents.find((a: any) => a.name === 'GeneralWorker');
      expect(general.status).toBe('active');
    });
  });

  it('exposes platform plugin manifests (AgentFinance scaffold)', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/agents`);
      expect(status).toBe(200);
      expect(Array.isArray(body.plugins)).toBe(true);
      const finance = body.plugins.find((p: any) => p.id === 'agentfinance');
      expect(finance).toBeDefined();
      expect(finance.name).toBe('AgentFinance');
      expect(finance.status).toBe('planned');
      expect(finance.version).toBe('0.1.0');
    });
  });
});

describe('GET /api/agents/status', () => {
  it('reports engine, model, and masked API key', async () => {
    await withServer(app, async (baseUrl) => {
      const { status, body } = await jsonFetch(`${baseUrl}/api/agents/status`);
      expect(status).toBe(200);
      expect(body.engine).toContain('SAGE v');
      expect(body.model).toBeTruthy();
      expect(body.apiKey).toMatch(/gsk_/);
      expect(body.validated).toBe(true);
      expect(body.agents).toContain('GeneralWorker');
      expect(typeof body.uptime).toBe('number');
      expect(body.memory).toBeDefined();
    });
  });
});
