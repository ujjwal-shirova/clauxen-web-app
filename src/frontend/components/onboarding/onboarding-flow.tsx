"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_ONBOARDING_STATE,
  ONBOARDING_STORAGE_KEY,
  type OnboardingState,
  type OnboardingStep,
} from "./onboarding-types";
import { CreateAccountStep } from "./steps/create-account-step";
import { PlanSelectionStep } from "./steps/plan-selection-step";
import { DesktopStep } from "./steps/desktop-step";
import { BeforeChatStep } from "./steps/before-chat-step";
import { NameStep } from "./steps/name-step";
import { RoleStep } from "./steps/role-step";

const STEP_ORDER: OnboardingStep[] = [
  "create-account",
  "plan-selection",
  "desktop",
  "before-chat",
  "name",
  "role",
];

function loadState(): OnboardingState {
  if (typeof window === "undefined") return DEFAULT_ONBOARDING_STATE;
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return DEFAULT_ONBOARDING_STATE;
    return { ...DEFAULT_ONBOARDING_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
}

function saveState(state: OnboardingState) {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function markOnboardingComplete() {
  try {
    localStorage.setItem("clauxen_onboarding_complete", "1");
  } catch {
    /* ignore */
  }
}

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("create-account");
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);

  useEffect(() => {
    setState(loadState());
  }, []);

  const patch = useCallback((partial: Partial<OnboardingState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      saveState(next);
      return next;
    });
  }, []);

  const goTo = useCallback((next: OnboardingStep) => {
    setStep(next);
  }, []);

  const goNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[idx + 1]);
    } else {
      markOnboardingComplete();
      router.replace("/");
    }
  }, [step, router]);

  const finishOnboarding = useCallback(() => {
    markOnboardingComplete();
    router.replace("/");
  }, [router]);

  switch (step) {
    case "create-account":
      return (
        <CreateAccountStep state={state} onChange={patch} onContinue={goNext} />
      );
    case "plan-selection":
      return (
        <PlanSelectionStep
          state={state}
          onChange={patch}
          onContinue={goNext}
          onSelectFree={goNext}
        />
      );
    case "desktop":
      return <DesktopStep onContinue={goNext} onSkip={goNext} />;
    case "before-chat":
      return (
        <BeforeChatStep state={state} onChange={patch} onContinue={goNext} />
      );
    case "name":
      return <NameStep state={state} onChange={patch} onContinue={goNext} />;
    case "role":
      return (
        <RoleStep
          state={state}
          onChange={patch}
          onContinue={finishOnboarding}
          onSkip={finishOnboarding}
        />
      );
    default:
      return null;
  }
}
