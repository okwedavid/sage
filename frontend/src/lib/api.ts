/**
 * lib/api.ts — API client for SAGE backend
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ChatRequest {
  message: string;
  attachments?: Record<string, any>;
  history?: { role: 'user' | 'assistant'; content: string }[];
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
    const error: any = new Error(err.error || `HTTP ${res.status}`);
    // Attach the structured body + status so callers can render rich errors
    // (e.g. the billing checkout 501 contract: { code, message, requiredEnv }).
    error.body = err;
    error.status = res.status;
    throw error;
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

  // Organizations (multi-tenant workspaces)
  async listOrganizations() {
    return apiFetch('/api/organizations');
  },

  async createOrganization(name: string) {
    return apiFetch('/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async getOrganization(id: string) {
    return apiFetch(`/api/organizations/${id}`);
  },

  async renameOrganization(id: string, name: string) {
    return apiFetch(`/api/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  async inviteMember(orgId: string, email: string, role?: string) {
    return apiFetch(`/api/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },

  async removeMember(orgId: string, userId: string) {
    return apiFetch(`/api/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  async leaveOrganization(orgId: string) {
    return apiFetch(`/api/organizations/${orgId}/leave`, { method: 'POST' });
  },

  async deleteOrganization(orgId: string) {
    return apiFetch(`/api/organizations/${orgId}`, { method: 'DELETE' });
  },

  // Billing
  async getBillingPlans() {
    return apiFetch('/api/billing/plans');
  },

  async getBillingPlan() {
    return apiFetch('/api/billing/plan');
  },

  async requestCheckout(planId: string) {
    return apiFetch('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
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
