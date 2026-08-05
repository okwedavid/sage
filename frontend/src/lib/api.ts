/**
 * lib/api.ts — API client for SAGE backend
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ChatRequest {
  message: string;
  attachments?: Record<string, any>;
}

interface ChatResponse {
  success: boolean;
  response: string;
  agent: string;
  intent: any;
  stages: any[];
  timestamp: string;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sage_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Chat
  async chat(req: ChatRequest): Promise<ChatResponse> {
    // Get custom settings from localStorage
    const customApiKey = localStorage.getItem('sage_custom_api_key');
    const customModel = localStorage.getItem('sage_custom_model');
    
    const requestBody = {
      ...req,
      customApiKey: customApiKey || undefined,
      customModel: customModel || undefined,
    };
    
    return apiFetch('/api/chat', { method: 'POST', body: JSON.stringify(requestBody) });
  },

  async health() {
    return apiFetch('/api/chat/health');
  },

  // Auth
  async login(email: string, password: string) {
    return apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(email: string, password: string, name?: string) {
    return apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  async demo() {
    return apiFetch('/api/auth/demo', { method: 'POST' });
  },

  // Conversations
  async getConversations() {
    return apiFetch('/api/conversations');
  },

  async createConversation(title: string) {
    return apiFetch('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  async deleteConversation(id: string) {
    return apiFetch(`/api/conversations/${id}`, { method: 'DELETE' });
  },

  // Agents
  async getAgents() {
    return apiFetch('/api/agents');
  },

  async getAgentStatus() {
    return apiFetch('/api/agents/status');
  },

  // API keys (platform)
  async listApiKeys() {
    return apiFetch('/api/keys');
  },

  async createApiKey(name?: string, scopes?: string[]) {
    return apiFetch('/api/keys', { method: 'POST', body: JSON.stringify({ name, scopes }) });
  },

  async rotateApiKey(id: string) {
    return apiFetch(`/api/keys/${id}/rotate`, { method: 'POST', body: JSON.stringify({}) });
  },

  async revokeApiKey(id: string) {
    return apiFetch(`/api/keys/${id}`, { method: 'DELETE' });
  },

  // Admin
  async adminSummary() {
    return apiFetch('/api/admin/summary');
  },

  async adminUsers() {
    return apiFetch('/api/admin/users');
  },

  async adminBanUser(id: string, banned: boolean) {
    return apiFetch(`/api/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ banned }) });
  },

  async adminConversations() {
    return apiFetch('/api/admin/conversations');
  },

  async adminLogs() {
    return apiFetch('/api/admin/logs');
  },
};
