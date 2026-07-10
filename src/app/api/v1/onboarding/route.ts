import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as onboardingService from "@/backend/services/onboarding.service";
import type { OnboardingAnswers } from "@/backend/services/onboarding.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const onboarding = await onboardingService.getOnboardingState(
      user.id,
      user.email,
    );
    return jsonData({ onboarding });
  },
  { requireAuth: true },
);

export const PATCH = withApiHandler(
  async ({ session, request }) => {
    const user = requireSession(session);
    const body = (await request.json()) as {
      step?: string;
      completed?: boolean;
      answers?: OnboardingAnswers;
    };
    const onboarding = await onboardingService.updateOnboardingState(user.id, {
      step: body.step,
      completed: body.completed,
      answers: body.answers,
      email: user.email,
    });
    return jsonData({ onboarding });
  },
  { requireAuth: true },
);
