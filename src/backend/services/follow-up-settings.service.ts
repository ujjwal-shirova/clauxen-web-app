import * as settingsRepo from "@/backend/repositories/settings.repository";

/**
 * Read Settings → Follow-up suggestions. Defaults to true when unset / missing.
 */
export async function loadFollowUpSuggestionsEnabled(
  userId: string | undefined | null,
): Promise<boolean> {
  if (!userId) return true;
  try {
    const row = await settingsRepo.getUserSettings(userId);
    const settings = (row?.settings ?? {}) as {
      general?: { followUpSuggestions?: unknown };
    };
    const value = settings.general?.followUpSuggestions;
    if (typeof value === "boolean") return value;
    return true;
  } catch {
    return true;
  }
}
