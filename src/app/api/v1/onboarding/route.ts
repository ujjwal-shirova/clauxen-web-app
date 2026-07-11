import { withApiHandler } from "@/backend/http/api-handler";
import { jsonData } from "@/backend/http/api-response";
import { requireSession } from "@/backend/auth/require-session";
import { createSupabaseClientFromRequest } from "@/backend/auth/supabase-session";
import * as onboardingService from "@/backend/services/onboarding.service";
import type { OnboardingAnswers } from "@/backend/services/onboarding.service";
import {
  ONBOARDING_DONE_COOKIE,
  onboardingDoneCookieOptions,
  onboardingDoneCookieValue,
} from "@/utils/onboarding-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withOnboardingCookie(
  response: ReturnType<typeof jsonData>,
  userId: string,
  completed: boolean,
) {
  response.cookies.set(
    ONBOARDING_DONE_COOKIE,
    onboardingDoneCookieValue(userId, completed),
    onboardingDoneCookieOptions(),
  );
  return response;
}

export const GET = withApiHandler(
  async ({ session }) => {
    const user = requireSession(session);
    const onboarding = await onboardingService.getOnboardingState(
      user.id,
      user.email,
    );
    return withOnboardingCookie(
      jsonData({ onboarding }),
      user.id,
      onboarding.completed,
    );
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

    let authMetadata: Record<string, unknown> | null = null;
    const supabase = createSupabaseClientFromRequest(request);
    if (supabase) {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      authMetadata = (authUser?.user_metadata ?? null) as Record<
        string,
        unknown
      > | null;
    }

    const onboarding = await onboardingService.updateOnboardingState(user.id, {
      step: body.step,
      completed: body.completed,
      answers: body.answers,
      email: user.email,
      authMetadata,
    });
    return withOnboardingCookie(
      jsonData({ onboarding }),
      user.id,
      onboarding.completed,
    );
  },
  { requireAuth: true },
);
