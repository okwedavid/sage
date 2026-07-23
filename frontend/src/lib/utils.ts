/**
 * lib/utils.ts — Shared utilities
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function formatTime(date?: Date): string {
  const d = date || new Date();
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

export const TASK_COLORS: Record<string, string> = {
  RESEARCH: '#58a6ff',
  ANALYZE: '#a78bfa',
  BUILD: '#3fb950',
  EXPLAIN: '#f0883e',
  DEBUG: '#f85149',
  GENERATE: '#f093fb',
  SUMMARIZE: '#8b949e',
  PLAN: '#d2a8ff',
  TRANSLATE: '#79c0ff',
  REVIEW: '#a1a1aa',
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#8b949e',
  NORMAL: '#e3b341',
  HIGH: '#f0883e',
  CRITICAL: '#f85149',
};
