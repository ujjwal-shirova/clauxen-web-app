"use client";

import React from "react";

type SettingsErrorBoundaryProps = {
  children: React.ReactNode;
  onClose?: () => void;
  onReload?: () => void;
};

type SettingsErrorBoundaryState = {
  generation: number;
  hasError: boolean;
};

/**
 * Isolates settings modal crashes — silent remount, no "couldn't load" chrome.
 */
export class SettingsErrorBoundary extends React.Component<
  SettingsErrorBoundaryProps,
  SettingsErrorBoundaryState
> {
  override state: SettingsErrorBoundaryState = {
    generation: 0,
    hasError: false,
  };

  private failCount = 0;

  static getDerivedStateFromError(): Partial<SettingsErrorBoundaryState> {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[settings] render failed:", error, info.componentStack);
    this.failCount += 1;
    if (this.failCount > 3) {
      this.props.onClose?.();
      this.failCount = 0;
      this.setState({ hasError: false, generation: 0 });
      return;
    }
    window.setTimeout(() => {
      this.setState((s) => ({
        hasError: false,
        generation: s.generation + 1,
      }));
      // Remount only — never close the overlay from a recoverable render error.
    }, 0);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-[200] bg-[rgba(244,244,245,0.84)]"
          aria-busy="true"
        />
      );
    }

    return (
      <React.Fragment key={this.state.generation}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
