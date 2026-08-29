"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  SettingsPanelTitle,
  SettingsProgressBar,
  SettingsSection,
} from "@/components/settings/settings-ui";
import * as settingsApi from "@/lib/api/settings-extended";

const FALLBACK_QUOTA = 512 * 1024 * 1024;

function formatStorage(bytes: number) {
  if (bytes <= 0) return "0 B";
  if (bytes >= 1024 ** 3) {
    const gb = bytes / 1024 ** 3;
    return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  }
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function StorageSettings() {
  const [usedBytes, setUsedBytes] = useState(0);
  const [quotaBytes, setQuotaBytes] = useState(FALLBACK_QUOTA);
  const [categories, setCategories] = useState([
    { id: "files", title: "Files", bytes: 0, count: 0, unit: "files" },
    { id: "images", title: "Images", bytes: 0, count: 0, unit: "images" },
  ]);

  useEffect(() => {
    void settingsApi
      .getStorageSummary()
      .then(({ storage }) => {
        setUsedBytes(storage.usedBytes);
        setQuotaBytes(storage.quotaBytes || FALLBACK_QUOTA);
        if (storage.categories?.length) {
          setCategories(
            storage.categories.map((c) => ({
              ...c,
              unit: c.id.includes("image") ? "images" : "files",
            })),
          );
        }
      })
      .catch(() => {
        // ponytail: keep empty demo quota until storage API is wired
      });
  }, []);

  const usedLabel = `${formatStorage(usedBytes)} of ${formatStorage(quotaBytes)} used`;

  return (
    <div className="flex animate-in fade-in flex-col duration-300 text-[var(--settings-fg)]">
      <SettingsPanelTitle>Storage</SettingsPanelTitle>
      <SettingsSection title="Usage">
        <div className="p-5">
          <SettingsProgressBar
            value={usedBytes}
            max={quotaBytes}
            label={usedLabel}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Manage storage"
        description="Manage your library to free up storage."
      >
        <ul>
          {categories.map((item) => (
            <li
              key={item.id}
              className="border-t border-[var(--settings-hairline)] first:border-t-0"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-[var(--settings-row-pad-x)] py-3.5 text-left transition-colors hover:bg-[var(--settings-nav-hover-bg)]"
              >
                <div>
                  <p className="text-[14px] text-[var(--settings-fg)]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--settings-fg-subtle)]">
                    {formatStorage(item.bytes)} • {item.count} {item.unit}
                  </p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--settings-fg-subtle)]"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </div>
  );
}
