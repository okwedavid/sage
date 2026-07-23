/**
 * types/index.ts — Shared frontend types
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: any[];
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  name: string;
  description: string;
  icon: string;
  color: string;
  status: 'active' | 'planned';
  model: string;
}

export interface HealthStatus {
  status: string;
  engine: string;
  model: string;
  api_key: string;
  uptime: number;
}
