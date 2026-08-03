"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "clauxen_sidebar_basics_v1";

type BasicsStep = {
  id: string;
  title: string;
  description?: string;
  onSelect: () => void;
};

type StoredBasicsState = {
  dismissed: boolean;
  completed: string[];
};

function loadState(): StoredBasicsState {
  if (typeof window === "undefined") {
    return { dismissed: false, completed: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dismissed: false, completed: [] };
    return JSON.parse(raw) as StoredBasicsState;
  } catch {
    return { dismissed: false, completed: [] };
  }
}

function saveState(state: StoredBasicsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function SidebarBasicsChecklist({
  steps,
  className,
  onDismiss,
}: {
  steps: BasicsStep[];
  className?: string;
  onDismiss?: () => void;
}) {
  const [state, setState] = useState<StoredBasicsState>(loadState);

  useEffect(() => {
    setState(loadState());
  }, []);

  const completedCount = useMemo(
    () => steps.filter((step) => state.completed.includes(step.id)).length,
    [state.completed, steps],
  );

  if (state.dismissed) return null;

  const progress =
    steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  const markComplete = (stepId: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        completed: prev.completed.includes(stepId)
          ? prev.completed
          : [...prev.completed, stepId],
      };
      saveState(next);
      return next;
    });
  };

  const dismiss = () => {
    setState((prev) => {
      const next = { ...prev, dismissed: true };
      saveState(next);
      return next;
    });
    onDismiss?.();
  };

  return (
    <div className={cn("shrink-0 px-1.5 pb-1", className)}>
      <div className="group/basics rounded-lg border border-[rgba(31,31,30,0.12)] bg-white/90 p-1.5 shadow-[0_1px_2px_rgba(11,11,11,0.045)] backdrop-blur-sm">
        <div className="relative flex max-h-[264px] flex-col">
          <div className="flex items-center gap-2 px-2 pt-2">
            <h2 className="flex-1 truncate text-[11.5px] font-[430] leading-4 text-zinc-900">
              Try the basics
            </h2>
            <div className="relative flex h-7 min-w-[2.25rem] shrink-0 items-center justify-end">
              <span
                aria-hidden="true"
                className="text-[12px] leading-[16.8px] text-[#7b7974] transition-opacity duration-150 group-hover/basics:opacity-0"
              >
                {completedCount} / {steps.length}
              </span>
              <button
                type="button"
                aria-label="Dismiss checklist"
                onClick={dismiss}
                className="no-hover-overlay absolute right-0 flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 opacity-0 transition-[opacity,color,background-color] duration-150 hover:bg-zinc-100 hover:text-zinc-700 group-hover/basics:opacity-100"
              >
                <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="px-2 pb-1.5 pt-1.5">
            <div className="rounded-full bg-[#e6e5e0] p-0.5">
              <div
                className="h-1 rounded-full bg-[#256bc1] transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <ul className="app-scrollbar flex max-h-[150px] flex-col gap-0.5 overflow-y-auto px-1 pb-2 pt-1 [mask-image:linear-gradient(rgba(0,0,0,0)_0px,rgb(0,0,0)_12px,rgb(0,0,0)_calc(100%-12px),rgba(0,0,0,0))]">
            {steps.map((step) => {
              const done = state.completed.includes(step.id);
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markComplete(step.id);
                      step.onSelect();
                    }}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-zinc-100"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        done
                          ? "border-[#256bc1] bg-[#256bc1]"
                          : "border-[rgba(31,31,30,0.15)] bg-white",
                      )}
                    >
                      {done ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <p className="text-[12.5px] leading-[17px] text-zinc-900">
                        {step.title}
                      </p>
                      {step.description ? (
                        <p className="text-[12px] leading-4 text-[#7b7974]">
                          {step.description}
                        </p>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
