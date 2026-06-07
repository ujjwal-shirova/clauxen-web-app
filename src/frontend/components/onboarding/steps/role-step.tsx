"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { OnboardingState } from "../onboarding-types";
import { OnboardingShell } from "../onboarding-shell";
import {
  OnboardingGhostButton,
  OnboardingHeading,
} from "../onboarding-ui";
import { RoleSelectionDropdown } from "../role-selection-dropdown";
import { cn } from "@/frontend/lib/utils";

type RoleStepProps = {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function RoleStep({
  state,
  onChange,
  onContinue,
  onSkip,
}: RoleStepProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const openDropdown = () => {
    const rect = triggerRef.current?.getBoundingClientRect() ?? null;
    setAnchorRect(rect);
    setDropdownOpen(true);
  };

  return (
    <OnboardingShell>
      <div className="flex w-full max-w-[450px] flex-col items-center gap-5">
        <OnboardingHeading
          title="What kind of work do you do?"
          subtitle="Pick a role so Clauxen can tailor your experience."
        />

        <fieldset className="w-full min-w-0 border-0 p-0">
          <div className="w-full">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => (dropdownOpen ? setDropdownOpen(false) : openDropdown())}
              className={cn(
                "flex h-16 w-full items-center rounded-2xl border border-zinc-200 bg-white px-6 text-left text-lg transition-colors",
                "hover:border-[#1f1f1e]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2977d6]/30",
              )}
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
            >
              <span
                className={cn(
                  "flex-1 truncate font-medium",
                  state.role ? "text-zinc-900" : "text-zinc-500",
                )}
              >
                {state.role || "Select your role"}
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-zinc-500" />
            </button>
          </div>
        </fieldset>

        <RoleSelectionDropdown
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
          anchorRect={anchorRect}
          value={state.role}
          onSelect={(role) => {
            onChange({ role });
            onContinue();
          }}
        />

        <OnboardingGhostButton type="button" onClick={onSkip} className="mt-2">
          Set up later
        </OnboardingGhostButton>
      </div>
    </OnboardingShell>
  );
}
