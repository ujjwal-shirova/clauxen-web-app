import * as repo from "@/server/repositories/my-clauxen.repository";

export type ActivityDayDto = {
  date: string;
  count: number;
};

export type MyClauxenDto = {
  displayName: string;
  daysWithClauxen: number;
  chatCount: number;
  messageCount: number;
  streakDays: number;
  selfGrowthEnabled: boolean;
  selfGrowthEnabledAt: string | null;
  heatmap: ActivityDayDto[];
  heatmapFrom: string;
  heatmapTo: string;
  growth: {
    activeDays: number;
    totalMessages: number;
    peakDay: ActivityDayDto | null;
    weeksActive: number;
  };
};

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateString(d);
}

function startOfUtcWeekSunday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - day);
  return utcDateString(d);
}

/** Rolling ~53-week GitHub-style window ending today (UTC). */
export function heatmapRange(now = new Date()): { from: string; to: string } {
  const to = utcDateString(now);
  const endWeekStart = startOfUtcWeekSunday(to);
  const from = addUtcDays(endWeekStart, -(52 * 7));
  return { from, to };
}

function daysBetweenInclusive(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso.slice(0, 10)}T00:00:00.000Z`);
  const to = new Date(`${toIso.slice(0, 10)}T00:00:00.000Z`);
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

function computeStreak(
  activityByDate: Map<string, number>,
  today: string,
): number {
  let cursor = today;
  // If today has no activity, allow streak to continue from yesterday.
  if ((activityByDate.get(cursor) ?? 0) <= 0) {
    cursor = addUtcDays(today, -1);
  }
  let streak = 0;
  while ((activityByDate.get(cursor) ?? 0) > 0) {
    streak += 1;
    cursor = addUtcDays(cursor, -1);
  }
  return streak;
}

function pickDisplayName(
  preferred: string | null | undefined,
  display: string | null | undefined,
): string {
  const preferredName = preferred?.trim();
  if (preferredName) return preferredName;
  const displayName = display?.trim();
  if (displayName) return displayName;
  return "You";
}

export async function getMyClauxen(userId: string): Promise<MyClauxenDto> {
  const [{ from, to }, profile, insights, chatCount] = await Promise.all([
    Promise.resolve(heatmapRange()),
    repo.getProfileCreatedAt(userId),
    repo.ensureInsights(userId),
    repo.countUserChats(userId),
  ]);

  const rows = await repo.listActivityDays(userId, from, to);
  const activityByDate = new Map(
    rows.map((r) => [r.activity_date.slice(0, 10), Number(r.message_count)]),
  );

  const heatmap: ActivityDayDto[] = [];
  for (let cursor = from; cursor <= to; cursor = addUtcDays(cursor, 1)) {
    heatmap.push({
      date: cursor,
      count: activityByDate.get(cursor) ?? 0,
    });
  }

  const messageCount = heatmap.reduce((sum, d) => sum + d.count, 0);
  const today = to;
  const createdAt = profile?.created_at ?? new Date().toISOString();
  const daysWithClauxen = daysBetweenInclusive(createdAt, today);

  const activeDays = heatmap.filter((d) => d.count > 0).length;
  let peakDay: ActivityDayDto | null = null;
  for (const day of heatmap) {
    if (!peakDay || day.count > peakDay.count) peakDay = day;
  }
  if (peakDay && peakDay.count <= 0) peakDay = null;

  const weeksActive = new Set(
    heatmap.filter((d) => d.count > 0).map((d) => startOfUtcWeekSunday(d.date)),
  ).size;

  return {
    displayName: pickDisplayName(profile?.preferred_name, profile?.display_name),
    daysWithClauxen,
    chatCount,
    messageCount,
    streakDays: computeStreak(activityByDate, today),
    selfGrowthEnabled: Boolean(insights?.self_growth_enabled),
    selfGrowthEnabledAt: insights?.self_growth_enabled_at ?? null,
    heatmap,
    heatmapFrom: from,
    heatmapTo: to,
    growth: {
      activeDays,
      totalMessages: messageCount,
      peakDay,
      weeksActive,
    },
  };
}

export async function setSelfGrowth(userId: string, enabled: boolean) {
  await repo.setSelfGrowthEnabled(userId, enabled);
  return getMyClauxen(userId);
}
