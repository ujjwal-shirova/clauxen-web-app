"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
  type OnboardingStep,
} from "./onboarding-types";
import { CreateAccountStep } from "./steps/create-account-step";
import { DesktopStep } from "./steps/desktop-step";
import { BeforeChatStep } from "./steps/before-chat-step";
import { NameStep } from "./steps/name-step";
import { RoleStep } from "./steps/role-step";
import { PlanSelectionStep } from "./steps/plan-selection-step";
import { OnboardingSplash } from "./onboarding-splash";
import * as onboardingApi from "@/lib/api/onboarding";
import * as authApi from "@/lib/api/auth";
import type { OnboardingAnswers } from "@/lib/api/onboarding";
import { ApiError } from "@/lib/api/client";
import {
  ONBOARDING_STEPS,
  isOnboardingStep,
  parseOnboardingHash,
  pushOnboardingStepHash,
  replaceOnboardingStepHash,
} from "@/lib/onboarding-steps";

const STEP_ORDER: OnboardingStep[] = [...ONBOARDING_STEPS];

function stepFromApi(step: string | null | undefined): OnboardingStep {
  if (isOnboardingStep(step)) return step;
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

function enterApp() {
  // Hard navigation so middleware re-reads onboarding_completed_at
  // and we never soft-loop back onto a stale OnboardingFlow instance.
  window.location.assign("/new");
}

export function OnboardingFlow() {
  const [step, setStep] = useState<OnboardingStep>("create-account");
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [splashMessage, setSplashMessage] = useState("Setting things up…");
  const [error, setError] = useState<string | null>(null);
  const stepRef = useRef(step);
  const syncingHashRef = useRef(false);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // Keep /onboarding#step in the address bar (deep links).
  useEffect(() => {
    if (!hydrated || busy) return;
    syncingHashRef.current = true;
    replaceOnboardingStepHash(step);
    // Allow hashchange listeners to ignore our own replace.
    const t = window.setTimeout(() => {
      syncingHashRef.current = false;
    }, 0);
    return () => window.clearTimeout(t);
  }, [step, hydrated, busy]);

  useEffect(() => {
    const onHashChange = () => {
      if (syncingHashRef.current || busy) return;
      const fromHash = parseOnboardingHash(window.location.hash);
      if (fromHash && fromHash !== stepRef.current) {
        setStep(fromHash);
        // Persist soft jump so reload / new tab land on the same step.
        void onboardingApi
          .updateOnboarding({ step: fromHash })
          .catch(() => {
            /* best-effort */
          });
      }
    };

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("popstate", onHashChange);
    };
  }, [busy]);

  useEffect(() => {
    void Promise.all([
      onboardingApi.getOnboarding(),
      authApi.getSession({ quiet: true }),
    ])
      .then(([{ onboarding }, session]) => {
        if (onboarding.completed) {
          enterApp();
          return;
        }
        const answers = answersFromApi(onboarding.answers);
        const fromSession =
          session?.preferredName?.trim() ||
          session?.displayName?.trim() ||
          "";

        // URL hash wins on first paint (copy/paste / reload deep link).
        const hashStep = parseOnboardingHash(
          typeof window !== "undefined" ? window.location.hash : "",
        );
        const resolvedStep = hashStep ?? stepFromApi(onboarding.step);

        setStep(resolvedStep);
        setState((prev) => ({
          ...prev,
          ...answers,
          displayName:
            (typeof answers.displayName === "string" && answers.displayName) ||
            fromSession ||
            prev.displayName,
        }));

        // If the user opened a later hash than the server step, advance server.
        if (hashStep && hashStep !== onboarding.step) {
          void onboardingApi
            .updateOnboarding({ step: hashStep })
            .catch(() => {
              /* best-effort */
            });
        } else {
          replaceOnboardingStepHash(resolvedStep);
        }

        setHydrated(true);
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load onboarding. Please refresh.",
        );
        // Still honor hash so a flaky API does not trap users on create-account.
        const hashStep = parseOnboardingHash(
          typeof window !== "undefined" ? window.location.hash : "",
        );
        if (hashStep) {
          setStep(hashStep);
          replaceOnboardingStepHash(hashStep);
        }
        setHydrated(true);
      });
  }, []);

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
          pushOnboardingStepHash(opts.nextStep);
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
