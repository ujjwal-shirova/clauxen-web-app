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
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Safety</SettingsPanelTitle>

      <SettingsSection title="Content">
        <SettingsToggleRow
          label="Reduce sensitive content"
          description="Ask Clauxen to avoid graphic or highly sensitive material when possible. This doesn’t replace your own judgment."
          checked={reduceSensitiveContent}
          onCheckedChange={onChange}
          borderless
        />
      </SettingsSection>

      <p className="mt-2 text-[13px] leading-relaxed text-[var(--settings-fg-muted)]">
        For family safeguards, use Parental controls. For crisis support
        contacts, use Trusted contact.
      </p>
    </div>
  );
}
