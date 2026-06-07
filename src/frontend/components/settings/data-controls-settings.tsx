"use client";

import { useState } from "react";
import {
  SettingsChevronRow,
  SettingsManageRow,
  SettingsOptionPicker,
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsRow,
} from "@/frontend/components/settings/settings-ui";

const onOffOptions = ["Off", "On"] as const;

export function DataControlsSettings() {
  const [improveModel, setImproveModel] = useState<"Off" | "On">("Off");
  const [location, setLocation] = useState<"Off" | "On">("On");
  const [remoteBrowser, setRemoteBrowser] = useState<"Off" | "On">("On");

  return (
    <div className="flex animate-in fade-in flex-col gap-2 duration-300 text-zinc-900">
      <SettingsPanelTitle>Data controls</SettingsPanelTitle>

      <SettingsChevronRow
        label="Improve the model for everyone"
        value={improveModel}
        options={onOffOptions}
        onValueChange={(value) => setImproveModel(value as "Off" | "On")}
      />

      <div className="border-b border-[#0d0d0d]/5 py-1">
        <SettingsRow
          label="Location"
          description={
            <>
              Allow Clauxen to use your device&apos;s precise location when providing
              information.{" "}
              <a href="#" className="underline decoration-[#8f8f8f]/60">
                Learn more
              </a>
            </>
          }
          borderless
        >
          <SettingsOptionPicker
            value={location}
            options={onOffOptions}
            onValueChange={(value) => setLocation(value as "Off" | "On")}
          />
        </SettingsRow>
      </div>

      <SettingsChevronRow
        label="Remote browser data"
        value={remoteBrowser}
        options={onOffOptions}
        onValueChange={(value) => setRemoteBrowser(value as "Off" | "On")}
      />

      <SettingsManageRow label="Shared links" />
      <SettingsManageRow label="Archived chats" />

      <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-[#0d0d0d]/5 py-3">
        <span className="text-[14px] font-[430] text-zinc-900">Archive all chats</span>
        <SettingsPillButton>Archive all</SettingsPillButton>
      </div>

      <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-[#0d0d0d]/5 py-3">
        <span className="text-[14px] font-[430] text-zinc-900">Delete all chats</span>
        <SettingsPillButton variant="danger">Delete all</SettingsPillButton>
      </div>

      <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-[#0d0d0d]/5 py-3">
        <span className="text-[14px] font-[430] text-zinc-900">Export data</span>
        <SettingsPillButton>Export</SettingsPillButton>
      </div>

      <SettingsChevronRow label="Marketing privacy" borderless />
    </div>
  );
}
