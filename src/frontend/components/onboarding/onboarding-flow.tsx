"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import { OnboardingSplash } from "./onboarding-splash";
import * as onboardingApi from "@/frontend/lib/api/onboarding";
import type { OnboardingAnswers } from "@/frontend/lib/api/onboarding";
import { ApiError } from "@/frontend/lib/api/client";

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

function clearOnboardingHash() {
  if (typeof window === "undefined") return;
  if (!window.location.hash) return;
  window.history.replaceState(null, "", "/onboarding");
}

function enterApp() {
  // Hard navigation so middleware re-reads onboarding_completed_at
  // and we never soft-loop back onto a stale OnboardingFlow instance.
  window.location.assign("/");
}

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("create-account");
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [splashMessage, setSplashMessage] = useState("Setting things up…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearOnboardingHash();

    void onboardingApi
      .getOnboarding()
      .then(({ onboarding }) => {
        if (onboarding.completed) {
          enterApp();
          return;
        }
        setStep(stepFromApi(onboarding.step));
        setState((prev) => ({
          ...prev,
          ...answersFromApi(onboarding.answers),
        }));
        setHydrated(true);
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load onboarding. Please refresh.",
        );
        setHydrated(true);
      });
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
      splash?: string;
    }) => {
      if (busy) return;

      const mergedState = { ...state, ...opts.stateOverride };
      if (opts.stateOverride) {
        setState(mergedState);
      }

      setBusy(true);
      setError(null);
      setSplashMessage(
        opts.splash ??
          (opts.completed ? "Finishing setup…" : "Saving your progress…"),
      );

      try {
        const { onboarding } = await onboardingApi.updateOnboarding({
          ...(opts.nextStep ? { step: opts.nextStep } : {}),
          ...(opts.completed ? { completed: true } : {}),
          answers: {
            ...answersForStep(step, mergedState),
            ...opts.answerOverride,
          },
        });

        if (opts.completed || onboarding.completed) {
          setSplashMessage("Taking you to Clauxen…");
          enterApp();
          return;
        }

        if (opts.nextStep) {
          setStep(opts.nextStep);
        }
        setBusy(false);
      } catch (err) {
        setBusy(false);
        setError(
          err instanceof ApiError
            ? err.message
            : "Something went wrong. Please try again.",
        );
      }
    },
    [busy, state, step],
  );

  const goNext = useCallback(
    (opts?: {
      answerOverride?: OnboardingAnswers;
      stateOverride?: Partial<OnboardingState>;
      splash?: string;
    }) => {
      const idx = STEP_ORDER.indexOf(step);
      if (idx < STEP_ORDER.length - 1) {
        void persistAndAdvance({
          nextStep: STEP_ORDER[idx + 1],
          answerOverride: opts?.answerOverride,
          stateOverride: opts?.stateOverride,
          splash: opts?.splash,
        });
      } else {
        void persistAndAdvance({
          completed: true,
          answerOverride: opts?.answerOverride,
          stateOverride: opts?.stateOverride,
          splash: opts?.splash ?? "Finishing setup…",
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
        splash: "Finishing setup…",
      });
    },
    [persistAndAdvance],
  );

  if (!hydrated) {
    return <OnboardingSplash message="Loading…" />;
  }

  const errorBanner = error ? (
    <div
      className="fixed bottom-6 left-1/2 z-[210] w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-center text-sm text-rose-700 shadow-lg"
      role="alert"
    >
      {error}
    </div>
  ) : null;

  const splash = busy ? <OnboardingSplash message={splashMessage} /> : null;

  let body: ReactNode = null;

  switch (step) {
    case "create-account":
      body = (
        <CreateAccountStep
          state={state}
          onChange={patch}
          busy={busy}
          onContinue={() =>
            goNext({ splash: "Creating your account…" })
          }
        />
      );
      break;
    case "plan-selection":
      body = (
        <PlanSelectionStep
          state={state}
          onChange={patch}
          busy={busy}
          onContinue={(planAnswers) =>
            goNext({
              answerOverride: planAnswers,
              stateOverride: planAnswers
                ? {
                    selectedPlanId:
                      planAnswers.selectedPlanId ?? state.selectedPlanId,
                    selectedBillingCycle:
                      (planAnswers.selectedBillingCycle as
                        | "monthly"
                        | "yearly"
                        | undefined) ?? state.selectedBillingCycle,
                  }
                : undefined,
              splash: "Saving your plan…",
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
              splash: "Continuing with Free…",
            })
          }
        />
      );
      break;
    case "desktop":
      body = (
        <DesktopStep
          busy={busy}
          onContinue={() => goNext({ splash: "Continuing…" })}
          onSkip={() => goNext({ splash: "Continuing…" })}
        />
      );
      break;
    case "before-chat":
      body = (
        <BeforeChatStep
          state={state}
          onChange={patch}
          busy={busy}
          onContinue={() => goNext({ splash: "Saving preferences…" })}
        />
      );
      break;
    case "name":
      body = (
        <NameStep
          state={state}
          onChange={patch}
          busy={busy}
          onContinue={() => goNext({ splash: "Saving your name…" })}
        />
      );
      break;
    case "role":
      body = (
        <RoleStep
          state={state}
          onChange={patch}
          busy={busy}
          onContinue={(role) =>
            finishOnboarding({
              answerOverride: { role: role ?? state.role },
              stateOverride: role ? { role } : undefined,
            })
          }
          onSkip={() => finishOnboarding()}
        />
      );
      break;
    default:
      body = null;
  }

  return (
    <>
      {body}
      {splash}
      {errorBanner}
    </>
  );
}
