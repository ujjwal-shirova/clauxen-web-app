import { withApiHandler } from "@/server/http/api-handler";
import { jsonData } from "@/server/http/api-response";
import { requireSession } from "@/server/auth/require-session";
import { createSupabaseClientFromRequest } from "@/server/auth/supabase-session";
import * as onboardingService from "@/server/services/onboarding.service";
import type { OnboardingAnswers } from "@/server/services/onboarding.service";
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
    onboardingDoneCookieOptions(completed),
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
