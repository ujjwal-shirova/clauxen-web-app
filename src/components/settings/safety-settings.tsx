"use client";

import {
  SettingsPanelTitle,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";

interface SafetySettingsProps {
  reduceSensitiveContent: boolean;
  onChange: (reduceSensitiveContent: boolean) => void;
}

export function SafetySettings({
  reduceSensitiveContent,
  onChange,
}: SafetySettingsProps) {
  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Safety</SettingsPanelTitle>
      <h2 className="mb-6 text-[20px] font-semibold tracking-tight">Safety</h2>

      <SettingsSection title="Content">
        <SettingsToggleRow
          label="Reduce sensitive content"
          description="Ask Clauxen to avoid graphic or highly sensitive material when possible. This doesn’t replace your own judgment."
          checked={reduceSensitiveContent}
          onCheckedChange={onChange}
          borderless
        />
      </SettingsSection>

      <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
        For family safeguards, use Parental controls. For crisis support
        contacts, use Trusted contact.
      </p>
    </div>
  );
}
