"use client";

import { notificationDeliveryOptions } from "@/frontend/components/settings/constants";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsRow,
  SettingsToggleRow,
} from "@/frontend/components/settings/settings-ui";

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
    <div className="flex animate-in fade-in flex-col gap-8 duration-300 text-zinc-900">
      <SettingsPanelTitle>Notifications</SettingsPanelTitle>

      <div className="flex flex-col">
        <SettingsRow
          label="Codex"
          description="Get notified about Codex tasks."
        >
          <SettingsOptionPicker
            value={codexChannel}
            options={notificationDeliveryOptions}
            onValueChange={setCodexChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Group chats"
          description="You'll receive notifications for new messages from group chats."
        >
          <SettingsOptionPicker
            value={groupChatChannel}
            options={notificationDeliveryOptions}
            onValueChange={setGroupChatChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Projects"
          description="Get notified when you receive an email invitation to a shared project."
        >
          <SettingsOptionPicker
            value={projectsChannel}
            options={notificationDeliveryOptions}
            onValueChange={setProjectsChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Recommendations"
          description="Stay in the loop on new tools, tips, and features from Clauxen."
        >
          <SettingsOptionPicker
            value={recommendationsChannel}
            options={notificationDeliveryOptions}
            onValueChange={setRecommendationsChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Responses"
          description="Get notified when Clauxen responds to requests that take time, like research or image generation."
        >
          <SettingsOptionPicker
            value={responseChannel}
            options={notificationDeliveryOptions}
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
                className="underline decoration-zinc-400/60 underline-offset-2 hover:text-zinc-900"
              >
                Manage tasks
              </button>
            </>
          }
        >
          <SettingsOptionPicker
            value={tasksChannel}
            options={notificationDeliveryOptions}
            onValueChange={setTasksChannel}
          />
        </SettingsRow>

        <SettingsRow
          label="Usage"
          description="We'll notify you when limits reset for features like image creation."
          borderless
        >
          <SettingsOptionPicker
            value={usageChannel}
            options={notificationDeliveryOptions}
            onValueChange={setUsageChannel}
          />
        </SettingsRow>
      </div>

      <section className="flex flex-col gap-2 border-t border-zinc-200 pt-4">
        <h3 className="text-[14px] font-semibold text-zinc-700">
          Local alerts
        </h3>
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
      </section>
    </div>
  );
}
