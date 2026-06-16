"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Contains render crashes so one broken subtree (e.g. a malformed flashcard)
 * doesn't white-screen the whole page. Shows `fallback` instead.
 */
export class ErrorBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="grid place-items-center p-8 text-center text-sm text-muted">
            Something went wrong rendering this view.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
