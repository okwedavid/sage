/**
 * components/layout/Sidebar.tsx — Left navigation
 */
'use client';

import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BrainCircuit,
  Wrench,
  Settings,
  ShieldCheck,
  Plus,
  LogOut,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'memory', label: 'Memory', icon: BrainCircuit },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { currentPage, setPage, clearMessages, user, logout, sidebarOpen, toggleSidebar } = useAppStore();

  const handleNavClick = (pageId: string) => {
    setPage(pageId);
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      toggleSidebar();
    }
  };

  const handleNewConversation = () => {
    clearMessages();
    setPage('conversations');
    if (window.innerWidth < 1024) {
      toggleSidebar();
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

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold tracking-[0.12em] text-txt-muted uppercase px-3.5 mb-2">
            Navigation
          </div>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
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
                <span className="font-mono text-txt-primary">SAGE v7.0</span>
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
