"use client";

import { ChevronRight } from "lucide-react";
import {
  SettingsPanelTitle,
  SettingsProgressBar,
  SettingsSectionHeading,
} from "@/frontend/components/settings/settings-ui";

const STORAGE_CATEGORIES = [
  { id: "files", title: "Files", detail: "49.4 MB · 40 files" },
  { id: "images", title: "Images", detail: "61.3 MB · 138 images" },
  { id: "artifacts", title: "Artifacts", detail: "12.1 MB · 8 items" },
] as const;

const USED_BYTES = 116_133_978;
const TOTAL_BYTES = 20 * 1024 * 1024 * 1024;

function formatStorage(bytes: number) {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }
  if (bytes >= 1024 ** 2) {
    return `${Math.round(bytes / 1024 ** 2)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export function StorageSettings() {
  const usedLabel = `${formatStorage(USED_BYTES)} of ${formatStorage(TOTAL_BYTES)} used`;

  return (
    <div className="flex animate-in fade-in flex-col gap-8 duration-300 text-zinc-900">
      <SettingsPanelTitle>Storage</SettingsPanelTitle>

      <section className="border-b border-zinc-200 pb-8">
        <SettingsProgressBar value={USED_BYTES} max={TOTAL_BYTES} label={usedLabel} />
      </section>

      <section>
        <SettingsSectionHeading>Manage storage</SettingsSectionHeading>
        <p className="mb-3 text-[12px] leading-4 text-zinc-400">
          Manage your library to free up storage
        </p>
        <ul>
          {STORAGE_CATEGORIES.map((item, index) => (
            <li key={item.id} className={index > 0 ? "border-t border-zinc-100" : ""}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 py-3 text-left transition-colors hover:bg-zinc-100/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] text-zinc-900">{item.title}</p>
                  <p className="mt-1 truncate text-[12px] text-zinc-400">{item.detail}</p>
                </div>
                <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
