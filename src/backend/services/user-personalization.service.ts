/**
 * Loads user profile personalization and formats it for the chat system prompt.
 * Appended after the static model + platform UI prefix so prompt cache stays stable.
 *
 * Custom instructions are scoped under Shirova guidelines — they never override
 * safety / platform rules.
 */

import * as settingsRepo from "@/backend/repositories/settings.repository";
import * as profileRepo from "@/backend/repositories/profile.repository";
import { trimProfileName } from "@/lib/profile-names";

export const MAX_CUSTOM_INSTRUCTIONS_LEN = 1500;

export type UserPersonalization = {
  fullName: string | null;
  nickname: string | null;
  occupation: string | null;
  customInstructions: string | null;
  personality: string | null;
  baseStyleTone: string | null;
};

function asTrimmedString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed || null;
}

export async function loadUserPersonalization(
  userId: string,
): Promise<UserPersonalization> {
  const [settingsRow, profile] = await Promise.all([
    settingsRepo.getUserSettings(userId),
    profileRepo.getProfile(userId),
  ]);

  const personalization = ((settingsRow?.settings ?? {}) as Record<
    string,
    unknown
  >).personalization as Record<string, unknown> | undefined;
  const onboardingAnswers =
    ((settingsRow as { onboarding_answers?: Record<string, unknown> } | null)
      ?.onboarding_answers as Record<string, unknown> | undefined) ?? undefined;

  const fullName =
    trimProfileName(profile?.display_name) ??
    asTrimmedString(personalization?.fullName, 120);
  const nickname =
    trimProfileName(profile?.preferred_name) ??
    asTrimmedString(personalization?.nickname, 120) ??
    asTrimmedString(onboardingAnswers?.displayName, 120);
  const occupation =
    asTrimmedString(personalization?.occupation, 120) ??
    asTrimmedString(onboardingAnswers?.role, 120);
  const customInstructions = asTrimmedString(
    personalization?.customInstructions,
    MAX_CUSTOM_INSTRUCTIONS_LEN,
  );
  const personality = asTrimmedString(personalization?.personality, 64);
  const baseStyleTone = asTrimmedString(personalization?.baseStyleTone, 64);

  return {
    fullName,
    nickname,
    occupation,
    customInstructions,
    personality:
      personality && personality !== "Default" ? personality : null,
    baseStyleTone:
      baseStyleTone && baseStyleTone !== "Default" ? baseStyleTone : null,
  };
}

/** Format personalization as a dynamic system-prompt suffix. */
export function formatPersonalizationAppend(
  p: UserPersonalization,
): string {
  const profileLines: string[] = [];
  const callName = p.nickname || p.fullName;
  if (callName) {
    profileLines.push(`Preferred name: ${callName}`);
  }
  if (p.fullName && p.fullName !== callName) {
    profileLines.push(`Full name: ${p.fullName}`);
  }
  if (p.occupation) {
    profileLines.push(`Work / role: ${p.occupation}`);
  }
  if (p.personality) {
    profileLines.push(`Preferred personality: ${p.personality}`);
  }
  if (p.baseStyleTone) {
    profileLines.push(`Preferred tone: ${p.baseStyleTone}`);
  }

  const blocks: string[] = [];

  if (profileLines.length > 0) {
    blocks.push(
      [
        "<user_profile>",
        "Use this context to personalize replies. Address the user by their preferred name when natural.",
        ...profileLines,
        "</user_profile>",
      ].join("\n"),
    );
  }

  if (p.customInstructions) {
    blocks.push(
      [
        "<custom_instructions>",
        "The user wrote preferences for how Clauxen should respond across chats.",
        "Follow them when they do not conflict with Shirova safety, policy, or platform guidelines.",
        "If a preference would violate those guidelines, ignore that part and continue helpfully.",
        "",
        p.customInstructions,
        "</custom_instructions>",
      ].join("\n"),
    );
  }

  return blocks.join("\n\n");
}

/**
 * Load + format personalization for inference. Failures return "" so chat
 * never blocks on settings DB blips.
 */
export async function buildUserPersonalizationAppend(
  userId: string | null | undefined,
): Promise<string> {
  if (!userId) return "";
  try {
    const personalization = await loadUserPersonalization(userId);
    return formatPersonalizationAppend(personalization);
  } catch (error) {
    console.error("[personalization] failed to load for prompt:", error);
    return "";
  }
}

/** Sanitize custom instructions on write. */
export function sanitizeCustomInstructions(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_CUSTOM_INSTRUCTIONS_LEN);
}
