"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
  type OnboardingStep,
} from "./onboarding-types";
import { CreateAccountStep } from "./steps/create-account-step";
import { PlanSelectionStep } from "./steps/plan-selection-step";
import { DesktopStep } from "./steps/desktop-step";
import { BeforeChatStep } from "./steps/before-chat-step";
import { NameStep } from "./steps/name-step";
import { RoleStep } from "./steps/role-step";
import * as onboardingApi from "@/frontend/lib/api/onboarding";

const STEP_ORDER: OnboardingStep[] = [
  "create-account",
  "plan-selection",
  "desktop",
  "before-chat",
  "name",
  "role",
];

function stepFromApi(step: string | null | undefined): OnboardingStep {
  if (step && STEP_ORDER.includes(step as OnboardingStep)) {
    return step as OnboardingStep;
  }
  return "create-account";
}

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("create-account");
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void onboardingApi
      .getOnboarding()
      .then(({ onboarding }) => {
        if (onboarding.completed) {
          router.replace("/");
          return;
        }
        setStep(stepFromApi(onboarding.step));
      })
      .catch(() => {
        // ponytail: unauthenticated users fall through to create-account step
      })
      .finally(() => setHydrated(true));
  }, [router]);

  const persistStep = useCallback(async (nextStep: OnboardingStep) => {
    try {
      await onboardingApi.updateOnboarding({ step: nextStep });
    } catch {
      /* ignore — UI still advances */
    }
  }, []);

  const patch = useCallback((partial: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const goTo = useCallback(
    (next: OnboardingStep) => {
      setStep(next);
      void persistStep(next);
    },
    [persistStep],
  );

  const goNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) {
      goTo(STEP_ORDER[idx + 1]);
    } else {
      void onboardingApi.updateOnboarding({ completed: true }).then(() => {
        router.replace("/");
      });
    }
  }, [step, router, goTo]);

  const finishOnboarding = useCallback(() => {
    void onboardingApi.updateOnboarding({ completed: true }).then(() => {
      router.replace("/");
    });
  }, [router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#faf9f5]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-black/10" />
      </div>
    );
  }

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
