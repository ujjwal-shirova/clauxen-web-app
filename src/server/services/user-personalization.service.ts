/**
 * Loads user profile personalization and formats it for the chat system prompt.
 * Appended after the static model + platform UI prefix so prompt cache stays stable.
 *
 * Style / tone / characteristics come from modular .md instruction files that
 * swap when the user changes Personalization settings. Custom instructions are
 * scoped under Shirova guidelines — they never override safety / platform rules.
 */

import * as settingsRepo from "@/server/repositories/settings.repository";
import * as profileRepo from "@/server/repositories/profile.repository";
import { trimProfileName } from "@/lib/profile-names";
import { formatPersonalizationStyleBlock } from "@/server/services/personalization-style-instructions";

export const MAX_CUSTOM_INSTRUCTIONS_LEN = 1500;

export type UserPersonalization = {
  fullName: string | null;
  nickname: string | null;
  occupation: string | null;
  customInstructions: string | null;
  /** @deprecated Removed from UI — ignored in prompt (base style covers this). */
  personality: string | null;
  baseStyleTone: string | null;
  characteristicWarm: string | null;
  characteristicEnthusiastic: string | null;
  characteristicHeadersLists: string | null;
  characteristicEmoji: string | null;
  fastAnswers: boolean;
  referenceSavedMemories: boolean;
  referenceChatHistory: boolean;
  webSearch: boolean;
};

function asTrimmedString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed || null;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Keep raw level including Default — modular Default .md files are intentional. */
function asStyleChoice(value: unknown, maxLen: number): string | null {
  return asTrimmedString(value, maxLen);
}

export async function loadUserPersonalization(
  userId: string,
): Promise<UserPersonalization> {
  const [settingsRow, profile] = await Promise.all([
    settingsRepo.getUserSettings(userId),
    profileRepo.getProfile(userId),
  ]);

  const stored = (settingsRow?.settings ?? {}) as Record<string, unknown>;
  const personalization = stored.personalization as
    | Record<string, unknown>
    | undefined;
  const capabilities = stored.capabilities as
    | Record<string, unknown>
    | undefined;
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

  return {
    fullName,
    nickname,
    occupation,
    customInstructions: asTrimmedString(
      personalization?.customInstructions,
      MAX_CUSTOM_INSTRUCTIONS_LEN,
    ),
    personality: asStyleChoice(personalization?.personality, 64),
    baseStyleTone: asStyleChoice(personalization?.baseStyleTone, 64),
    characteristicWarm: asStyleChoice(
      personalization?.characteristicWarm,
      32,
    ),
    characteristicEnthusiastic: asStyleChoice(
      personalization?.characteristicEnthusiastic,
      32,
    ),
    characteristicHeadersLists: asStyleChoice(
      personalization?.characteristicHeadersLists,
      32,
    ),
    characteristicEmoji: asStyleChoice(
      personalization?.characteristicEmoji,
      32,
    ),
    fastAnswers: asBool(personalization?.fastAnswers, true),
    referenceSavedMemories: asBool(
      personalization?.referenceSavedMemories,
      true,
    ),
    referenceChatHistory: asBool(personalization?.referenceChatHistory, true),
    webSearch: asBool(
      personalization?.webSearch ?? capabilities?.networkEgress,
      true,
    ),
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

  const styleBlock = formatPersonalizationStyleBlock({
    baseStyleTone: p.baseStyleTone,
    characteristicWarm: p.characteristicWarm,
    characteristicEnthusiastic: p.characteristicEnthusiastic,
    characteristicHeadersLists: p.characteristicHeadersLists,
    characteristicEmoji: p.characteristicEmoji,
  });

  const fastAnswersLine = p.fastAnswers
    ? "Fast answers: preferred — concise general-knowledge answers are OK when personalization is not required."
    : "Fast answers: off — prefer thorough, personalized replies.";

  const memoryLines: string[] = [];
  memoryLines.push(
    p.referenceSavedMemories
      ? "Reference saved memories when relevant."
      : "Do not rely on saved long-term memories for this user.",
  );
  memoryLines.push(
    p.referenceChatHistory
      ? "Use recent chat history for continuity."
      : "Minimize reliance on prior chat history beyond the current turn.",
  );
  memoryLines.push(
    p.webSearch
      ? "Web search is enabled — search when facts may be outdated or unknown."
      : "Web search is disabled for this user unless they explicitly ask to search.",
  );

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

  if (styleBlock) {
    blocks.push(styleBlock);
  }

  blocks.push(
    [
      "<response_preferences>",
      fastAnswersLine,
      "</response_preferences>",
    ].join("\n"),
  );

  blocks.push(
    ["<memory_and_tools>", ...memoryLines, "</memory_and_tools>"].join("\n"),
  );

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
