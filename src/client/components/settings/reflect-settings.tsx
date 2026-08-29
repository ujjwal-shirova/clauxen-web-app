"use client";

import { RefreshCw } from "lucide-react";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
} from "@/components/settings/settings-ui";

const RANGE_OPTIONS = [
  "Past week",
  "Past month",
  "Past 3 months",
  "Past year",
] as const;

interface ReflectSettingsProps {
  range?: string;
  onRangeChange?: (value: string) => void;
  onRefresh?: () => void;
}

export function ReflectSettings({
  range = "Past month",
  onRangeChange,
  onRefresh,
}: ReflectSettingsProps) {
  return (
    <div className="flex min-h-full animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Reflect</SettingsPanelTitle>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-[var(--settings-fg-muted)]">
          Based on your conversations in Clauxen chat.
        </p>
        <div className="flex items-center gap-2">
          <SettingsOptionPicker
            value={range}
            options={RANGE_OPTIONS}
            onValueChange={(v) => onRangeChange?.(v)}
          />
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--settings-fg-muted)] transition-colors hover:bg-[var(--settings-nav-hover-bg)]"
            aria-label="Refresh reflect"
          >
            <RefreshCw className="size-5" />
          </button>
        </div>
      </div>

      <div className="settings-card flex flex-1 flex-col items-center justify-center gap-2.5 px-6 py-14 text-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--settings-icon-bg)] text-[var(--settings-fg-muted)]">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <path d="M6 4h9a2 2 0 0 1 2 2v14l-4-2-4 2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12" />
            <path d="M9 8h5M9 11h5M9 14h3" />
          </svg>
        </div>
        <p className="text-[14px] font-medium text-[var(--settings-fg)]">
          Surfacing themes and patterns.
        </p>
        <p className="text-[13px] text-[var(--settings-fg-muted)]">
          This should only take a minute or so.
        </p>
      </div>
    </div>
  );
}
