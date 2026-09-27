"use client";

import { AuthNumericField } from "@/components/auth/auth-numeric-field";

/**
 * Auth layout — single centered column on the app panel.
 * `atmosphere` draws the numeric field across the top (sign-in).
 */
export function AuthShell({
  children,
  atmosphere = false,
}: {
  children: React.ReactNode;
  atmosphere?: boolean;
}) {
  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--app-shell-bg)] p-1.5 font-sans text-[var(--ui-fg)] sm:p-2">
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[16px] border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] sm:rounded-[18px]">
        {atmosphere ? <AuthNumericField /> : null}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-4 sm:py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
