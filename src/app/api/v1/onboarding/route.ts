import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import * as onboardingService from "@/backend/services/onboarding.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const onboarding = await onboardingService.getOnboardingState(user.id);
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
    };
    const onboarding = await onboardingService.updateOnboardingState(user.id, {
      step: body.step,
      completed: body.completed,
    });
    return jsonData({ onboarding });
  },
  { requireAuth: true },
);
