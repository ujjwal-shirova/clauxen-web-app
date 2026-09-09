"use client";

import { cn } from "@/lib/utils";
import { NotificationDeliveryPicker } from "@/components/settings/notification-delivery-picker";
import {
  SettingsOptionPicker,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const BREAK_OPTIONS = [
  "-",
  "Every 30 min",
  "Every hour",
  "Every 2 hours",
] as const;
const QUIET_OPTIONS = ["-", "9pm–7am", "10pm–8am", "Custom"] as const;

export type TimeAndFocusValue = {
  breakReminder: string;
  breakSnooze: string;
  quietHours: string;
  quietDays: boolean[];
};

interface NotificationsSettingsProps {
  codexChannel: string;
  responseChannel: string;
  groupChatChannel: string;
  tasksChannel: string;
  projectsChannel: string;
  recommendationsChannel: string;
  usageChannel: string;
  desktopAlerts: boolean;
  soundEffects: boolean;
  setCodexChannel: (value: string) => void;
  setResponseChannel: (value: string) => void;
  setGroupChatChannel: (value: string) => void;
  setTasksChannel: (value: string) => void;
  setProjectsChannel: (value: string) => void;
  setRecommendationsChannel: (value: string) => void;
  setUsageChannel: (value: string) => void;
  setDesktopAlerts: (value: boolean) => void;
  setSoundEffects: (value: boolean) => void;
  timeAndFocus: TimeAndFocusValue;
  onTimeAndFocusChange: (patch: Partial<TimeAndFocusValue>) => void;
}

export function NotificationsSettings({
  codexChannel,
  responseChannel,
  groupChatChannel,
  tasksChannel,
  projectsChannel,
  recommendationsChannel,
  usageChannel,
  desktopAlerts,
  soundEffects,
  setCodexChannel,
  setResponseChannel,
  setGroupChatChannel,
  setTasksChannel,
  setProjectsChannel,
  setRecommendationsChannel,
  setUsageChannel,
  setDesktopAlerts,
  setSoundEffects,
  timeAndFocus,
  onTimeAndFocusChange,
}: NotificationsSettingsProps) {
  const toggleDay = (index: number) => {
    const next = [...timeAndFocus.quietDays];
    next[index] = !next[index];
    onTimeAndFocusChange({ quietDays: next });
  };

  return (
    <SettingsPage>
      <SettingsPanelTitle>Notifications</SettingsPanelTitle>

      <SettingsSection
        title="Updates"
        description="Choose push, email, both, or off per update."
      >
        <SettingsRow label="Responses" description="Long replies finish.">
          <NotificationDeliveryPicker
            value={responseChannel}
            onValueChange={setResponseChannel}
            aria-label="Responses delivery"
          />
        </SettingsRow>
        <SettingsRow label="Tasks" description="Created tasks change.">
          <NotificationDeliveryPicker
            value={tasksChannel}
            onValueChange={setTasksChannel}
            aria-label="Tasks delivery"
          />
        </SettingsRow>
        <SettingsRow label="Projects" description="Project invitations.">
          <NotificationDeliveryPicker
            value={projectsChannel}
            onValueChange={setProjectsChannel}
            aria-label="Projects delivery"
          />
        </SettingsRow>
        <SettingsRow label="Group chats" description="New group messages.">
          <NotificationDeliveryPicker
            value={groupChatChannel}
            onValueChange={setGroupChatChannel}
            aria-label="Group chats delivery"
          />
        </SettingsRow>
        <SettingsRow label="Codex" description="Codex task updates.">
          <NotificationDeliveryPicker
            value={codexChannel}
            onValueChange={setCodexChannel}
            aria-label="Codex delivery"
          />
        </SettingsRow>
        <SettingsRow label="Tips" description="New tools and features.">
          <NotificationDeliveryPicker
            value={recommendationsChannel}
            onValueChange={setRecommendationsChannel}
            aria-label="Tips delivery"
          />
        </SettingsRow>
        <SettingsRow
          label="Usage"
          description="Image and feature limits reset."
          borderless
        >
          <NotificationDeliveryPicker
            value={usageChannel}
            onValueChange={setUsageChannel}
            aria-label="Usage delivery"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="This device"
        description="Browser alerts and sounds."
      >
        <SettingsToggleRow
          label="Desktop alerts"
          description="Notify when background work finishes."
          checked={desktopAlerts}
          onCheckedChange={setDesktopAlerts}
        />
        <SettingsToggleRow
          label="Sounds"
          description="Subtle sounds for messages and actions."
          checked={soundEffects}
          onCheckedChange={setSoundEffects}
          borderless
        />
      </SettingsSection>

      <SettingsSection title="Focus" description="Breaks and quiet hours.">
        <SettingsRow label="Break reminders">
          <div className="flex w-full flex-col gap-2 min-[520px]:w-auto min-[520px]:flex-row">
            <SettingsOptionPicker
              value={timeAndFocus.breakReminder}
              options={BREAK_OPTIONS}
              onValueChange={(breakReminder) =>
                onTimeAndFocusChange({ breakReminder })
              }
              aria-label="Break reminders"
            />
            <SettingsOptionPicker
              value={timeAndFocus.breakSnooze}
              options={QUIET_OPTIONS}
              onValueChange={(breakSnooze) =>
                onTimeAndFocusChange({ breakSnooze })
              }
              aria-label="Break snooze"
            />
          </div>
        </SettingsRow>
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <div>
            <p className="text-[14px] font-medium leading-5">Quiet hours</p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--settings-fg-muted)]">
              Pause non-urgent notifications on selected days.
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
              onValueChange={(quietHours) =>
                onTimeAndFocusChange({ quietHours })
              }
              aria-label="Quiet hours"
            />
          </div>
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
