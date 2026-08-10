/**
 * lib/api.ts — API client for SAGE backend
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ChatRequest {
  message: string;
  attachments?: Record<string, any>;
  history?: { role: 'user' | 'assistant'; content: string }[];
  conversationId?: string;
}

interface ChatResponse {
  success: boolean;
  response: string;
  agent: string;
  intent: any;
  stages: any[];
  model?: string;
  provider?: string;
  conversationTitle?: string | null;
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
    // User-selected provider credential (Settings → Models & API Providers)
    const providerId = localStorage.getItem('sage_active_provider_id');
    
    const requestBody = {
      ...req,
      providerId: providerId || undefined,
      customApiKey: customApiKey || undefined,
      customModel: customModel || undefined,
    };
    
    return apiFetch('/api/chat', { method: 'POST', body: JSON.stringify(requestBody) });
  },

  async chatWithProvider(req: ChatRequest & { providerId?: string }): Promise<ChatResponse> {
    const customApiKey = localStorage.getItem('sage_custom_api_key');
    const customModel = localStorage.getItem('sage_custom_model');
    return apiFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        ...req,
        providerId: req.providerId || undefined,
        customApiKey: customApiKey || undefined,
        customModel: customModel || undefined,
      }),
    });
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

  // Password reset
  async requestPasswordReset(email: string) {
    return apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, password: string) {
    return apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  // Conversations
  async getConversations() {
    return apiFetch('/api/conversations');
  },

  async getConversation(id: string) {
    return apiFetch(`/api/conversations/${id}`);
  },

  async createConversation(title: string) {
    return apiFetch('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  async updateConversationTitle(id: string, title: string) {
    return apiFetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  },

  async addConversationMessage(id: string, content: string, role: 'user' | 'assistant') {
    return apiFetch(`/api/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, role }),
    });
  },

  async deleteConversation(id: string) {
    return apiFetch(`/api/conversations/${id}`, { method: 'DELETE' });
  },

  // Provider credentials (user-supplied AI API keys)
  async getProviderCatalog() {
    return apiFetch('/api/providers/catalog');
  },

  async listProviders() {
    return apiFetch('/api/providers');
  },

  async connectProvider(input: {
    provider: string;
    apiKey: string;
    label?: string;
    baseUrl?: string;
    model?: string;
    supportsVision?: boolean;
  }) {
    return apiFetch('/api/providers/connect', { method: 'POST', body: JSON.stringify(input) });
  },

  async getProviderModels(id: string) {
    return apiFetch(`/api/providers/${id}/models`);
  },

  async healthCheckProvider(id: string) {
    return apiFetch(`/api/providers/${id}/health`, { method: 'POST', body: JSON.stringify({}) });
  },

  async updateProvider(id: string, fields: { model?: string; label?: string; supportsVision?: boolean }) {
    return apiFetch(`/api/providers/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
  },

  async revokeProvider(id: string) {
    return apiFetch(`/api/providers/${id}`, { method: 'DELETE' });
  },

  async rotateProviderKey(id: string, apiKey: string) {
    return apiFetch(`/api/providers/${id}/rotate`, {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
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

  async requestBillingPortal() {
    return apiFetch('/api/billing/portal', { method: 'POST', body: JSON.stringify({}) });
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
