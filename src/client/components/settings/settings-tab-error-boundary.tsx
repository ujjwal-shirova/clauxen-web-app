"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  tabLabel?: string;
};

type State = {
  generation: number;
  hasError: boolean;
};

/**
 * Isolates a single settings tab crash so the modal shell + nav stay usable.
 * Silent remount — no "couldn't load" chrome.
 */
export class SettingsTabErrorBoundary extends React.Component<Props, State> {
  override state: State = { generation: 0, hasError: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[settings] tab "${this.props.tabLabel ?? "?"}" failed:`,
      error,
      info.componentStack,
    );
    window.setTimeout(() => {
      this.setState((s) => ({
        hasError: false,
        generation: s.generation + 1,
      }));
    }, 0);
  }

  override componentDidUpdate(prevProps: Props) {
    if (prevProps.tabLabel !== this.props.tabLabel && this.state.hasError) {
      this.setState({ hasError: false, generation: 0 });
    }
  }

  override render() {
    if (this.state.hasError) {
      return <div className="min-h-[120px] w-full bg-transparent" aria-busy />;
    }

    return (
      <React.Fragment key={this.state.generation}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
