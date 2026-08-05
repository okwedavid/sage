/**
 * app/page.tsx — Main entry point (client-side routing)
 */
'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { LandingPage } from '@/components/pages/LandingPage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardPage } from '@/components/pages/DashboardPage';
import { ChatPage } from '@/components/pages/ChatPage';
import { AgentsPage } from '@/components/pages/AgentsPage';
import { SettingsPage } from '@/components/pages/SettingsPage';
import { AdminPage } from '@/components/pages/AdminPage';
import { LoginPage } from '@/components/pages/LoginPage';

export default function Home() {
  const { user, token, currentPage, setUser } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Restore session
    const savedToken = localStorage.getItem('sage_token');
    const savedUser = localStorage.getItem('sage_user');
    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser), savedToken);
      } catch {
        localStorage.removeItem('sage_token');
        localStorage.removeItem('sage_user');
      }
    }
  }, []);

  if (!mounted) return null;

  // Not authenticated — show landing/login
  if (!token) {
    return <LandingPage />;
  }

  // Authenticated — show app
  return (
    <DashboardLayout>
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'conversations' && <ChatPage />}
      {currentPage === 'agents' && <AgentsPage />}
      {currentPage === 'memory' && <PlaceholderPage title="Memory" subtitle="Coming in Sprint 7 — Conversation Memory + RAG" />}
      {currentPage === 'tools' && <PlaceholderPage title="Tools" subtitle="Coming in Sprint 8 — Advanced Tool Integrations" />}
      {currentPage === 'settings' && <SettingsPage />}
      {currentPage === 'admin' && <AdminPage />}
    </DashboardLayout>
  );
}

function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow-lg">
          <span className="text-3xl">🔮</span>
        </div>
        <h2 className="text-2xl font-display font-bold text-txt-primary mb-2">{title}</h2>
        <p className="text-txt-muted text-sm max-w-md">{subtitle}</p>
      </div>
    </div>
  );
}
