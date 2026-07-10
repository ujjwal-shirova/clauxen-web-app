"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

type SettingsErrorBoundaryProps = {
  children: React.ReactNode;
  onClose?: () => void;
};

type SettingsErrorBoundaryState = {
  error: Error | null;
};

export class SettingsErrorBoundary extends React.Component<
  SettingsErrorBoundaryProps,
  SettingsErrorBoundaryState
> {
  override state: SettingsErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SettingsErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error("[settings] render failed:", error);
  }

  private handleReload = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-[rgba(244,244,245,0.92)] p-6">
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center shadow-lg">
            <AlertTriangle className="h-10 w-10 text-zinc-900" strokeWidth={1.5} />
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                Settings couldn&apos;t load
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Reload to try again, or go back.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => this.props.onClose?.()}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
