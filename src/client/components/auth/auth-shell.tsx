"use client";

/**
 * Auth layout — single centered column (no demo rail / split view).
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--app-shell-bg)] p-1.5 font-sans text-zinc-800 sm:p-2">
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[16px] border border-zinc-200/80 bg-[var(--app-panel-bg)] sm:rounded-[18px]">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-4 sm:py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
