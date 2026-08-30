/**
 * components/ErrorBoundary.tsx — Client-side error boundary.
 *
 * Catches render/lifecycle errors anywhere beneath it and renders a graceful
 * recovery screen instead of white-screening the whole app (audit P1-2).
 */
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional label identifying the region, shown in the error card. */
  label?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the console diagnostic for developers without crashing the app.
    console.error('[ErrorBoundary]', this.props.label || 'app', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <div className="glass-card p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-status-error/10 border border-status-error/30 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="font-display text-xl font-bold text-txt-primary mb-2">
              Something went wrong
            </h2>
            <p className="text-txt-secondary text-sm mb-1">
              {this.props.label ? `${this.props.label} hit an unexpected error.` : 'This view hit an unexpected error.'}
            </p>
            <p className="text-[11px] font-mono text-txt-muted mb-5 break-words">
              {this.state.error.message || 'Unknown error'}
            </p>
            <div className="flex justify-center gap-2">
              <button onClick={this.reset} className="btn-primary py-2 px-4 text-sm">
                Try Again
              </button>
              <button
                onClick={() => typeof window !== 'undefined' && window.location.reload()}
                className="py-2 px-4 rounded-xl bg-sage-input border border-sage-border text-sm text-txt-secondary hover:text-txt-primary transition-all"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}