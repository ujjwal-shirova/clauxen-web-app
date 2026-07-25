/**
 * Compute next_run_at for scheduled tasks from frequency + local time + timezone.
 * Pure helpers — no DB. Times are wall-clock in the task timezone.
 */

export type ScheduleFrequency = "once" | "daily" | "weekly" | "monthly";

export type ScheduleSpec = {
  frequency: ScheduleFrequency;
  /** "HH:MM" 24h */
  timeLocal: string;
  timezone: string;
  /** YYYY-MM-DD for once */
  runDate?: string | null;
  /** 0=Sun .. 6=Sat */
  dayOfWeek?: number | null;
  /** 1..31 */
  dayOfMonth?: number | null;
  /** YYYY-MM-DD exclusive end (task stops after this calendar day) */
  expiresAt?: string | null;
};

const TIME_RE = /^(\d{2}):(\d{2})$/;

export function parseTimeLocal(timeLocal: string): { hour: number; minute: number } {
  const m = TIME_RE.exec(timeLocal.trim());
  if (!m) throw new Error("Invalid time_local. Use HH:MM.");
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) throw new Error("Invalid time_local.");
  return { hour, minute };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Parts of an instant in a given IANA timezone. */
function zonedParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=Sun
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  // hour12:false can still yield "24" for midnight in some engines
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayMap[parts.weekday ?? "Sun"] ?? 0,
  };
}

/**
 * Convert a local wall time in `timeZone` to a UTC Date.
 * Uses iterative offset correction (handles DST).
 */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  // Initial guess: treat local as UTC
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const parts = zonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = desired - asUtc;
    utc += delta;
    if (delta === 0) break;
  }
  return new Date(utc);
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampDayOfMonth(year: number, month: number, dayOfMonth: number): number {
  return Math.min(dayOfMonth, daysInMonth(year, month));
}

function isExpired(
  year: number,
  month: number,
  day: number,
  expiresAt: string | null | undefined,
): boolean {
  if (!expiresAt) return false;
  const exp = expiresAt.slice(0, 10);
  const cur = `${year}-${pad2(month)}-${pad2(day)}`;
  return cur > exp;
}

/**
 * Next run instant (UTC) strictly after `after`, or null if no future run
 * (expired / once already passed).
 */
export function computeNextRunAt(
  spec: ScheduleSpec,
  after: Date = new Date(),
): Date | null {
  const { hour, minute } = parseTimeLocal(spec.timeLocal);
  const tz = spec.timezone?.trim() || "UTC";
  const nowParts = zonedParts(after, tz);

  if (spec.frequency === "once") {
    if (!spec.runDate) return null;
    const [y, m, d] = spec.runDate.split("-").map(Number);
    if (!y || !m || !d) return null;
    if (isExpired(y, m, d, spec.expiresAt)) return null;
    const runAt = zonedLocalToUtc(y, m, d, hour, minute, tz);
    if (runAt.getTime() <= after.getTime()) return null;
    return runAt;
  }

  // Search up to ~400 days ahead for weekly/monthly edge cases.
  for (let offset = 0; offset < 400; offset++) {
    let y = nowParts.year;
    let m = nowParts.month;
    let d = nowParts.day;

    if (spec.frequency === "daily") {
      ({ year: y, month: m, day: d } = addCalendarDays(
        nowParts.year,
        nowParts.month,
        nowParts.day,
        offset,
      ));
    } else if (spec.frequency === "weekly") {
      const targetDow = spec.dayOfWeek ?? 0;
      const delta = (targetDow - nowParts.weekday + 7) % 7;
      const daysAhead = delta + offset * 7;
      ({ year: y, month: m, day: d } = addCalendarDays(
        nowParts.year,
        nowParts.month,
        nowParts.day,
        daysAhead,
      ));
    } else if (spec.frequency === "monthly") {
      const targetDom = spec.dayOfMonth ?? 1;
      const monthOffset = offset;
      const base = new Date(Date.UTC(nowParts.year, nowParts.month - 1 + monthOffset, 1));
      y = base.getUTCFullYear();
      m = base.getUTCMonth() + 1;
      d = clampDayOfMonth(y, m, targetDom);
    }

    if (isExpired(y, m, d, spec.expiresAt)) return null;

    const candidate = zonedLocalToUtc(y, m, d, hour, minute, tz);
    if (candidate.getTime() > after.getTime()) {
      return candidate;
    }

    // For weekly/monthly, first iteration may land on "today" before the time —
    // loop continues. For weekly with offset=0 already handled; bump needed for
    // daily when today's slot passed (offset++).
    if (spec.frequency === "weekly" && offset === 0) {
      // if same weekday but time passed, next loop adds 7 days
      continue;
    }
  }

  return null;
}

export function formatExpirationLabel(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "Never";
  const d = new Date(`${expiresAt.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatTimeLabel(timeLocal: string): string {
  const { hour, minute } = parseTimeLocal(timeLocal);
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function frequencyLabel(frequency: ScheduleFrequency): string {
  switch (frequency) {
    case "once":
      return "Once";
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
  }
}
