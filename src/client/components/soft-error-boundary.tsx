"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  name?: string;
};

type State = {
  generation: number;
  hasError: boolean;
  giveUp: boolean;
};

/**
 * Catches render failures and remounts children silently.
 * Never shows "couldn't load" chrome — recovery stays invisible.
 */
export class SoftErrorBoundary extends React.Component<Props, State> {
  override state: State = {
    generation: 0,
    hasError: false,
    giveUp: false,
  };

  private failCount = 0;

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[soft-boundary${this.props.name ? `:${this.props.name}` : ""}]`,
      error,
      info.componentStack,
    );
    this.failCount += 1;
    if (this.failCount > 3) {
      this.setState({ giveUp: true, hasError: true });
      return;
    }
    // Clear error flag and remount on next tick (breaks sync rethrow loops).
    window.setTimeout(() => {
      this.setState((s) => ({
        hasError: false,
        generation: s.generation + 1,
      }));
    }, 0);
  }

  override render() {
    if (this.state.giveUp || this.state.hasError) {
      return <div className="min-h-0 flex-1 bg-white" aria-hidden />;
    }
    return (
      <React.Fragment key={this.state.generation}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
