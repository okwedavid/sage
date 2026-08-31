/**
 * components/layout/Sidebar.tsx — Left navigation
 */
'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BrainCircuit,
  Wrench,
  Settings,
  ShieldCheck,
  Building2,
  CreditCard,
  Plus,
  LogOut,
  X,
  History,
  Trash2,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'memory', label: 'Memory', icon: BrainCircuit },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const {
    currentPage,
    setPage,
    user,
    logout,
    sidebarOpen,
    toggleSidebar,
    conversations,
    setConversations,
    loadConversation,
    newConversation,
    activeConversationId,
  } = useAppStore();

  // Load the user's saved sessions when authenticated (Phase 5/6 memory).
  useEffect(() => {
    if (!user) return;
    api
      .getConversations()
      .then((res) => {
        if (res?.conversations) setConversations(res.conversations);
      })
      .catch(() => {});
  }, [user, setConversations]);

  const handleNavClick = (pageId: string) => {
    setPage(pageId);
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      toggleSidebar();
    }
  };

  const handleNewConversation = () => {
    newConversation();
    setPage('conversations');
    if (window.innerWidth < 1024) {
      toggleSidebar();
    }
  };

  const handleOpenSession = async (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      // Fetch full conversation with messages to ensure we have the latest state
      try {
        const full = await api.getConversation(id);
        if (full) {
          loadConversation(full);
        } else {
          loadConversation(conv);
        }
      } catch {
        // Fallback to cached version if fetch fails
        loadConversation(conv);
      }
      setPage('conversations');
      if (window.innerWidth < 1024) toggleSidebar();
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations(conversations.filter((c) => c.id !== id));
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:relative z-50 lg:z-auto h-full flex flex-col border-r border-sage-border bg-sage-surface/95 backdrop-blur-xl transition-all duration-300 overflow-hidden',
          'w-[280px] lg:w-[240px]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:w-0'
        )}
      >
        {/* Mobile close button */}
        <div className="lg:hidden flex justify-end p-3 pb-0">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-sage-hover transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New conversation button */}
        <div className="p-3 pb-2">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-button text-white font-semibold text-sm shadow-glow-md hover:shadow-glow-lg hover:-translate-y-0.5 transition-all duration-200 active:translate-y-0"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        {/* Recent sessions (memory) */}
        {user && conversations.length > 0 && (
          <div className="px-3 pb-1">
            <div className="flex items-center gap-1.5 px-3.5 mb-1.5">
              <History className="w-3 h-3 text-txt-muted" />
              <span className="text-[10px] font-bold tracking-[0.12em] text-txt-muted uppercase">
                Recent Sessions
              </span>
            </div>
            <div className="space-y-1 max-h-[30vh] overflow-y-auto pr-1">
              {conversations.slice(0, 12).map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-all',
                    activeConversationId === conv.id
                      ? 'bg-accent-primary/15 border border-accent-primary/30'
                      : 'hover:bg-sage-hover border border-transparent'
                  )}
                  onClick={() => handleOpenSession(conv.id)}
                  title={`Reopen: ${conv.title}`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-txt-muted shrink-0" />
                  <span className="flex-1 min-w-0 text-[12px] text-txt-secondary truncate group-hover:text-txt-primary transition-colors">
                    {conv.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-txt-muted hover:text-status-error transition-all"
                    aria-label={`Delete session ${conv.title}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold tracking-[0.12em] text-txt-muted uppercase px-3.5 mb-2">
            Navigation
          </div>
          {NAV_ITEMS.filter(({ adminOnly }) => !adminOnly || user?.isAdmin).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={cn('nav-item w-full', currentPage === id && 'active')}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.7} />
              <span>{label}</span>
              {currentPage === id && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-primary shadow-[0_0_8px_#667eea]" />
              )}
            </button>
          ))}
        </nav>

        {/* System status */}
        <div className="px-3 pb-2">
          <div className="bg-sage-card/80 backdrop-blur-md border border-sage-border rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold tracking-[0.08em] text-txt-muted uppercase">
                Engine Status
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-status-success font-semibold">
                <span className="w-[6px] h-[6px] bg-status-success rounded-full shadow-[0_0_6px_#3fb950] animate-pulse-slow" />
                Online
              </span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-txt-secondary">Model</span>
                <span className="font-mono text-txt-primary text-[10px]">llama-3.3-70b</span>
              </div>
              <div className="flex justify-between">
                <span className="text-txt-secondary">Version</span>
                <span className="font-mono text-txt-primary">v1.0.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* User profile */}
        <div className="p-3 pt-1">
          <div className="flex items-center gap-3 bg-gradient-card border border-sage-border rounded-xl p-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center text-white font-bold text-xs">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-txt-primary truncate">
                {user?.name || 'User'}
              </div>
              <div className="text-[10px] text-txt-muted truncate">{user?.email || ''}</div>
            </div>
            <button
              onClick={() => {
                logout();
                localStorage.removeItem('sage_token');
                localStorage.removeItem('sage_user');
              }}
              className="text-txt-muted hover:text-status-error transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
