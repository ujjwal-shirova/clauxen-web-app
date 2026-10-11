"use client";

import { Archive } from "lucide-react";

interface SettingsPlaceholderProps {
  title: string;
  description?: string;
}

export function SettingsPlaceholder({
  title,
  description = "This setting is not available yet.",
}: SettingsPlaceholderProps) {
  return (
    <div className="settings-card flex flex-col items-center gap-3 px-6 py-12 text-center text-[var(--settings-fg)]">
      <Archive className="size-6 text-[var(--settings-fg-muted)]" aria-hidden />
      <p className="text-sm font-medium">{title} management is coming soon</p>
      <p className="max-w-md text-[13px] leading-5 text-[var(--settings-fg-muted)]">
        {description}
      </p>
    </div>
  );
}
