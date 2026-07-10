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
import type { OnboardingAnswers } from "@/frontend/lib/api/onboarding";

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

function answersFromApi(
  answers: OnboardingAnswers | Record<string, unknown> | undefined,
): Partial<OnboardingState> {
  if (!answers) return {};
  const a = answers as OnboardingAnswers;
  return {
    ...(typeof a.termsAccepted === "boolean"
      ? { termsAccepted: a.termsAccepted }
      : {}),
    ...(typeof a.privacyAccepted === "boolean"
      ? { privacyAccepted: a.privacyAccepted }
      : {}),
    ...(typeof a.marketingOptIn === "boolean"
      ? { marketingOptIn: a.marketingOptIn }
      : {}),
    ...(typeof a.modelImprovementOptIn === "boolean"
      ? { modelImprovementOptIn: a.modelImprovementOptIn }
      : {}),
    ...(typeof a.displayName === "string" ? { displayName: a.displayName } : {}),
    ...(typeof a.role === "string" ? { role: a.role } : {}),
    ...(typeof a.selectedPlanId === "string"
      ? { selectedPlanId: a.selectedPlanId }
      : {}),
    ...(a.selectedBillingCycle === "monthly" ||
    a.selectedBillingCycle === "yearly"
      ? { selectedBillingCycle: a.selectedBillingCycle }
      : {}),
  };
}

function answersForStep(
  step: OnboardingStep,
  state: OnboardingState,
): OnboardingAnswers {
  switch (step) {
    case "create-account":
      return {
        termsAccepted: state.termsAccepted,
        privacyAccepted: state.privacyAccepted,
        marketingOptIn: state.marketingOptIn,
      };
    case "plan-selection":
      return {
        selectedPlanId: String(state.selectedPlanId),
        selectedBillingCycle: state.selectedBillingCycle,
      };
    case "before-chat":
      return { modelImprovementOptIn: state.modelImprovementOptIn };
    case "name":
      return { displayName: state.displayName };
    case "role":
      return { role: state.role };
    default:
      return {};
  }
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
        setState((prev) => ({
          ...prev,
          ...answersFromApi(onboarding.answers),
        }));
      })
      .catch(() => {
        // ponytail: unauthenticated users fall through to create-account step
      })
      .finally(() => setHydrated(true));
  }, [router]);

  const patch = useCallback((partial: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const persistAndAdvance = useCallback(
    async (opts: {
      nextStep?: OnboardingStep;
      completed?: boolean;
      answerOverride?: OnboardingAnswers;
      stateOverride?: Partial<OnboardingState>;
    }) => {
      const mergedState = { ...state, ...opts.stateOverride };
      if (opts.stateOverride) {
        setState(mergedState);
      }
      try {
        await onboardingApi.updateOnboarding({
          ...(opts.nextStep ? { step: opts.nextStep } : {}),
          ...(opts.completed ? { completed: true } : {}),
          answers: {
            ...answersForStep(step, mergedState),
            ...opts.answerOverride,
          },
        });
      } catch {
        /* ignore — UI still advances */
      }
      if (opts.completed) {
        router.replace("/");
        return;
      }
      if (opts.nextStep) setStep(opts.nextStep);
    },
    [state, step, router],
  );

  const goNext = useCallback(
    (opts?: {
      answerOverride?: OnboardingAnswers;
      stateOverride?: Partial<OnboardingState>;
    }) => {
      const idx = STEP_ORDER.indexOf(step);
      if (idx < STEP_ORDER.length - 1) {
        void persistAndAdvance({
          nextStep: STEP_ORDER[idx + 1],
          answerOverride: opts?.answerOverride,
          stateOverride: opts?.stateOverride,
        });
      } else {
        void persistAndAdvance({
          completed: true,
          answerOverride: opts?.answerOverride,
          stateOverride: opts?.stateOverride,
        });
      }
    },
    [step, persistAndAdvance],
  );

  const finishOnboarding = useCallback(
    (opts?: {
      answerOverride?: OnboardingAnswers;
      stateOverride?: Partial<OnboardingState>;
    }) => {
      void persistAndAdvance({
        completed: true,
        answerOverride: opts?.answerOverride,
        stateOverride: opts?.stateOverride,
      });
    },
    [persistAndAdvance],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-shell-bg,#f9f9f9)]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200" />
      </div>
    );
  }

  switch (step) {
    case "create-account":
      return (
        <CreateAccountStep
          state={state}
          onChange={patch}
          onContinue={() => goNext()}
        />
      );
    case "plan-selection":
      return (
        <PlanSelectionStep
          state={state}
          onChange={patch}
          onContinue={(planAnswers) =>
            goNext({
              answerOverride: planAnswers,
              stateOverride: planAnswers
                ? {
                    selectedPlanId: planAnswers.selectedPlanId ?? state.selectedPlanId,
                    selectedBillingCycle:
                      (planAnswers.selectedBillingCycle as
                        | "monthly"
                        | "yearly"
                        | undefined) ?? state.selectedBillingCycle,
                  }
                : undefined,
            })
          }
          onSelectFree={() =>
            goNext({
              answerOverride: {
                selectedPlanId: "free",
                selectedBillingCycle: "monthly",
              },
              stateOverride: {
                selectedPlanId: "free",
                selectedBillingCycle: "monthly",
              },
            })
          }
        />
      );
    case "desktop":
      return (
        <DesktopStep onContinue={() => goNext()} onSkip={() => goNext()} />
      );
    case "before-chat":
      return (
        <BeforeChatStep
          state={state}
          onChange={patch}
          onContinue={() => goNext()}
        />
      );
    case "name":
      return (
        <NameStep state={state} onChange={patch} onContinue={() => goNext()} />
      );
    case "role":
      return (
        <RoleStep
          state={state}
          onChange={patch}
          onContinue={(role) =>
            finishOnboarding({
              answerOverride: { role: role ?? state.role },
              stateOverride: role ? { role } : undefined,
            })
          }
          onSkip={() => finishOnboarding()}
        />
      );
    default:
      return null;
  }
}
