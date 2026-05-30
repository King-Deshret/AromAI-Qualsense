'use client';
import React from 'react';

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg m-4">
          <h2 className="text-red-800 font-semibold text-sm mb-2">Terjadi Error</h2>
          <pre className="text-xs text-red-700 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            className="mt-3 text-xs text-red-600 underline"
            onClick={() => this.setState({ error: null })}
          >
            Coba lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
