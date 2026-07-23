/**
 * services/supabase.ts
 * OWNS: Supabase client initialization
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Settings } from '../config/settings';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;

  if (!Settings.SUPABASE_URL || !Settings.SUPABASE_SERVICE_KEY) {
    console.warn('⚠️ Supabase not configured — running without persistence');
    return null;
  }

  supabase = createClient(Settings.SUPABASE_URL, Settings.SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('✅ Supabase connected');
  return supabase;
}

export async function saveConversation(
  userId: string,
  title: string,
  messages: any[]
): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;

  const { data, error } = await db
    .from('conversations')
    .insert({
      user_id: userId,
      title,
      messages,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save conversation:', error.message);
    return null;
  }
  return data.id;
}

export async function getConversations(userId: string): Promise<any[]> {
  const db = getSupabase();
  if (!db) return [];

  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to fetch conversations:', error.message);
    return [];
  }
  return data || [];
}

export async function saveUserStats(userId: string, stats: Record<string, any>): Promise<void> {
  const db = getSupabase();
  if (!db) return;

  await db.from('user_stats').upsert({
    user_id: userId,
    ...stats,
    updated_at: new Date().toISOString(),
  });
}
