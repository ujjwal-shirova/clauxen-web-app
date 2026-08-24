"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  SettingsPanelTitle,
  SettingsProgressBar,
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
    <div className="flex animate-in fade-in flex-col duration-300 text-zinc-900">
      <SettingsPanelTitle>Storage</SettingsPanelTitle>
      <h2 className="mb-4 text-[20px] font-semibold tracking-tight">Storage</h2>
      <div className="mb-8 border-b border-zinc-200 pb-8">
        <SettingsProgressBar
          value={usedBytes}
          max={quotaBytes}
          label={usedLabel}
        />
      </div>

      <section>
        <h3 className="text-[15px] font-semibold">Manage storage</h3>
        <p className="mt-1 text-[13px] text-zinc-500">
          Manage your files to free up storage
        </p>
        <ul className="mt-4">
          {categories.map((item) => (
            <li key={item.id} className="border-t border-zinc-100 first:border-t-0">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-zinc-50"
              >
                <div>
                  <p className="text-[14px] text-zinc-900">{item.title}</p>
                  <p className="mt-0.5 text-[12px] text-zinc-400">
                    {formatStorage(item.bytes)} • {item.count} {item.unit}
                  </p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-zinc-400"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
