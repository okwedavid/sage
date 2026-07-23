/**
 * stores/appStore.ts — Global state management with Zustand
 */
import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: IntentData | null;
  agent?: string;
  timestamp: string;
  attachments?: Record<string, any>;
  stages?: PipelineStage[];
}

export interface IntentData {
  intent_id: string;
  task_type: string;
  target_domain: string;
  goal: string;
  confidence_score: number;
  priority: string;
  output_format: string;
  suggested_agent: string;
  status: string;
  entities: Record<string, any>;
  created_at: string;
}

export interface PipelineStage {
  name: string;
  success: boolean;
  detail: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface AppState {
  // Auth
  user: { id: string; email: string; name: string } | null;
  token: string | null;
  setUser: (user: any, token: string) => void;
  logout: () => void;

  // Navigation
  currentPage: string;
  setPage: (page: string) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Messages & Chat
  messages: Message[];
  addMessage: (msg: Message) => void;
  clearMessages: () => void;

  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  setConversations: (convs: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;

  // Pipeline
  currentIntent: IntentData | null;
  setCurrentIntent: (intent: IntentData | null) => void;
  isProcessing: boolean;
  setProcessing: (v: boolean) => void;

  // Stats
  queryCount: number;
  successCount: number;
  incrementQuery: (success: boolean) => void;

  // Attachments
  uploadedImage: { base64: string; type: string; name: string } | null;
  setUploadedImage: (img: { base64: string; type: string; name: string } | null) => void;

  // Settings
  ttsEnabled: boolean;
  toggleTts: () => void;
  apiKey: string;
  setApiKey: (key: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  token: null,
  setUser: (user, token) => set({ user, token }),
  logout: () =>
    set({ user: null, token: null, messages: [], conversations: [], currentPage: 'dashboard' }),

  // Navigation
  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page }),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  // Messages
  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [], currentIntent: null }),

  // Conversations
  conversations: [],
  activeConversationId: null,
  setConversations: (convs) => set({ conversations: convs }),
  setActiveConversation: (id) => set({ activeConversationId: id }),

  // Pipeline
  currentIntent: null,
  setCurrentIntent: (intent) => set({ currentIntent: intent }),
  isProcessing: false,
  setProcessing: (v) => set({ isProcessing: v }),

  // Stats
  queryCount: 0,
  successCount: 0,
  incrementQuery: (success) =>
    set((s) => ({
      queryCount: s.queryCount + 1,
      successCount: success ? s.successCount + 1 : s.successCount,
    })),

  // Attachments
  uploadedImage: null,
  setUploadedImage: (img) => set({ uploadedImage: img }),

  // Settings
  ttsEnabled: false,
  toggleTts: () => set((s) => ({ ttsEnabled: !s.ttsEnabled })),
  apiKey: '',
  setApiKey: (key) => set({ apiKey: key }),
}));
