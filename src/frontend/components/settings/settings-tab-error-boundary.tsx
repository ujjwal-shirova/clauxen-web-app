"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  tabLabel?: string;
};

type State = {
  error: Error | null;
};

/**
 * Isolates a single settings tab crash so the modal shell + nav stay usable.
 */
export class SettingsTabErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[settings] tab "${this.props.tabLabel ?? "?"}" failed:`,
      error,
      info.componentStack,
    );
  }

  override componentDidUpdate(prevProps: Props) {
    if (prevProps.tabLabel !== this.props.tabLabel && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-start gap-3 py-6">
          <h2 className="text-[16px] font-semibold text-zinc-900">
            This section couldn&apos;t load
          </h2>
          <p className="text-sm text-zinc-500">
            Try another category, or reload this section.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
