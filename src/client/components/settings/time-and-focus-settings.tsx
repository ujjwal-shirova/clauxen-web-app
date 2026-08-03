"use client";

import { cn } from "@/lib/utils";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsSection,
} from "@/components/settings/settings-ui";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const BREAK_OPTIONS = ["-", "Every 30 min", "Every hour", "Every 2 hours"] as const;
const QUIET_OPTIONS = ["-", "9pm–7am", "10pm–8am", "Custom"] as const;

export type TimeAndFocusSettingsState = {
  breakReminder: string;
  breakSnooze: string;
  quietHours: string;
  quietDays: boolean[];
};

interface TimeAndFocusSettingsProps {
  timeAndFocus: TimeAndFocusSettingsState;
  onChange: (patch: Partial<TimeAndFocusSettingsState>) => void;
}

export function TimeAndFocusSettings({
  timeAndFocus,
  onChange,
}: TimeAndFocusSettingsProps) {
  const toggleDay = (index: number) => {
    const next = [...timeAndFocus.quietDays];
    next[index] = !next[index];
    onChange({ quietDays: next });
  };

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Time and focus</SettingsPanelTitle>
      <h2 className="mb-6 text-[20px] font-semibold tracking-tight">
        Time and focus
      </h2>

      <SettingsSection title="Break reminders">
        <div className="flex min-h-[72px] items-start justify-between gap-4 border-b border-zinc-100 py-3">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-[14px] font-medium">Break reminders</p>
            <p className="mt-1 text-[13px] leading-snug text-zinc-500">
              Get a nudge to take a break from Clauxen. You can snooze or adjust
              anytime.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SettingsOptionPicker
              value={timeAndFocus.breakReminder}
              options={BREAK_OPTIONS}
              onValueChange={(breakReminder) => onChange({ breakReminder })}
            />
            <SettingsOptionPicker
              value={timeAndFocus.breakSnooze}
              options={QUIET_OPTIONS}
              onValueChange={(breakSnooze) => onChange({ breakSnooze })}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Quiet hours">
        <div className="flex flex-col gap-4 border-b border-zinc-100 py-3">
          <div>
            <p className="text-[14px] font-medium">Quiet hours</p>
            <p className="mt-1 text-[13px] leading-snug text-zinc-500">
              Set time limits for Clauxen. You can dismiss or adjust anytime.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, index) => (
              <button
                key={`${day}-${index}`}
                type="button"
                onClick={() => toggleDay(index)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-medium transition-colors",
                  timeAndFocus.quietDays[index]
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                )}
                aria-pressed={timeAndFocus.quietDays[index]}
                aria-label={`Quiet hours on ${day}`}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <SettingsOptionPicker
              value={timeAndFocus.quietHours}
              options={QUIET_OPTIONS}
              onValueChange={(quietHours) => onChange({ quietHours })}
            />
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
