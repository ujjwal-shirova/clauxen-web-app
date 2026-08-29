"use client";

import { cn } from "@/lib/utils";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-ui";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const BREAK_OPTIONS = [
  "-",
  "Every 30 min",
  "Every hour",
  "Every 2 hours",
] as const;
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
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Time and focus</SettingsPanelTitle>

      <SettingsSection title="Break reminders">
        <SettingsRow
          label="Break reminders"
          description="Get a nudge to take a break from Clauxen. You can snooze or adjust anytime."
          borderless
        >
          <div className="flex w-full flex-col gap-2 min-[520px]:w-auto min-[520px]:flex-row">
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
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Quiet hours">
        <div className="flex flex-col gap-4 px-[var(--settings-row-pad-x)] py-[var(--settings-row-pad-y)]">
          <div>
            <p className="text-[14px] font-medium">Quiet hours</p>
            <p className="mt-1 text-[13px] leading-snug text-[var(--settings-fg-muted)]">
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
                    ? "bg-[var(--settings-fg)] text-[var(--settings-canvas-bg)]"
                    : "bg-[var(--settings-icon-bg)] text-[var(--settings-fg-muted)] hover:bg-[var(--settings-nav-hover-bg)]",
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
