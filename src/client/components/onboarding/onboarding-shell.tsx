"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { ClauxenWordmark } from "./clauxen-wordmark";
import { cn } from "@/lib/utils";
import type { OnboardingStepId } from "@/lib/onboarding-steps";

export const OnboardingNavigation = createContext<{
  step: OnboardingStepId;
  busy: boolean;
  onBack: () => void;
} | null>(null);

export function OnboardingShell({
  children,
  footer,
  className,
  contentClassName,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const navigation = useContext(OnboardingNavigation);
  return (
    <div
      className={cn(
        "min-h-dvh bg-white font-sans text-zinc-950 selection:bg-zinc-200",
        className,
      )}
      style={{ colorScheme: "light" }}
    >
      <header className="flex h-20 items-center border-b border-zinc-100 px-6 md:px-12">
        <ClauxenWordmark height={26} />
      </header>
      <main className="mx-auto w-full max-w-2xl px-6 py-10 md:py-16">
        <div className="mb-7 flex h-6 items-center">
          {navigation && navigation.step !== "create-account" ? (
            <button
              type="button"
              onClick={navigation.onBack}
              disabled={navigation.busy}
              className="inline-flex items-center gap-2 rounded text-sm text-zinc-500 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back
            </button>
          ) : null}
        </div>
        <div className={cn("flex flex-col items-start", contentClassName)}>
          {children}
        </div>
        {footer ? (
          <div className="mt-8 border-t border-zinc-100 pt-6 text-sm text-zinc-500">
            {footer}
          </div>
        ) : null}
      </main>
    </div>
  );
}
