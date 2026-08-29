"use client";

import { NotificationDeliveryPicker } from "@/components/settings/notification-delivery-picker";
import {
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";

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
}: NotificationsSettingsProps) {
  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Notifications</SettingsPanelTitle>

      <SettingsSection title="Notifications">
        <SettingsRow
          label="Codex"
          description="Get notified about Codex tasks."
        >
          <NotificationDeliveryPicker
            value={codexChannel}
            onValueChange={setCodexChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Group chats"
          description="You'll receive notifications for new messages from group chats."
        >
          <NotificationDeliveryPicker
            value={groupChatChannel}
            onValueChange={setGroupChatChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Projects"
          description="Get notified when you receive an email invitation to a shared project."
        >
          <NotificationDeliveryPicker
            value={projectsChannel}
            onValueChange={setProjectsChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Recommendations"
          description="Stay in the loop on new tools, tips, and features from Clauxen."
        >
          <NotificationDeliveryPicker
            value={recommendationsChannel}
            onValueChange={setRecommendationsChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Responses"
          description="Get notified when Clauxen has finished a response. Useful for long-running tasks."
        >
          <NotificationDeliveryPicker
            value={responseChannel}
            onValueChange={setResponseChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Tasks"
          description={
            <>
              Get notified when tasks you&apos;ve created have updates.{" "}
              <button
                type="button"
                className="font-medium underline decoration-[var(--settings-input-border)] underline-offset-2 hover:text-[var(--settings-fg)]"
              >
                Manage tasks
              </button>
            </>
          }
        >
          <NotificationDeliveryPicker
            value={tasksChannel}
            onValueChange={setTasksChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Usage"
          description="We'll notify you when limits reset for features like image creation."
          borderless
        >
          <NotificationDeliveryPicker
            value={usageChannel}
            onValueChange={setUsageChannel}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Local alerts">
        <SettingsToggleRow
          label="Desktop alerts"
          description="Show browser notifications when background chats, builds, and research tasks finish."
          checked={desktopAlerts}
          onCheckedChange={setDesktopAlerts}
        />
        <SettingsToggleRow
          label="Sound effects"
          description="Play subtle sounds for message delivery, call state changes, and completed actions."
          checked={soundEffects}
          onCheckedChange={setSoundEffects}
          borderless
        />
      </SettingsSection>
    </div>
  );
}
