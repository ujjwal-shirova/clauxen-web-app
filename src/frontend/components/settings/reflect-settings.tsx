"use client";

import { RefreshCw } from "lucide-react";
import {
  SettingsOptionPicker,
  SettingsPanelTitle,
} from "@/frontend/components/settings/settings-ui";

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
    <div className="flex min-h-full animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Reflect</SettingsPanelTitle>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight">Reflect</h2>
          <p className="mt-1 text-[14px] text-zinc-500">
            Based on your conversations in Clauxen chat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SettingsOptionPicker
            value={range}
            options={RANGE_OPTIONS}
            onValueChange={(v) => onRangeChange?.(v)}
          />
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100"
            aria-label="Refresh reflect"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-400">
          <svg
            width="40"
            height="40"
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
        <p className="text-[15px] font-medium text-zinc-800">
          Surfacing themes and patterns.
        </p>
        <p className="text-[13px] text-zinc-500">
          This should only take a minute or so.
        </p>
      </div>
    </div>
  );
}
