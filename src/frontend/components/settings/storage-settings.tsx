"use client";

import { useEffect, useState } from "react";
import {
  SettingsPanelTitle,
  SettingsPillButton,
  SettingsSectionHeading,
  SettingsProgressBar,
} from "@/frontend/components/settings/settings-ui";
import * as settingsApi from "@/frontend/lib/api/settings-extended";

function formatStorage(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function StorageSettings() {
  const [loading, setLoading] = useState(true);
  const [usedBytes, setUsedBytes] = useState(0);
  const [quotaBytes, setQuotaBytes] = useState(20 * 1024 ** 3);
  const [categories, setCategories] = useState<
    Array<{ id: string; title: string; bytes: number; count: number }>
  >([]);

  useEffect(() => {
    void settingsApi
      .getStorageSummary()
      .then(({ storage }) => {
        setUsedBytes(storage.usedBytes);
        setQuotaBytes(storage.quotaBytes);
        setCategories(storage.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading storage…</p>;
  }

  const usedLabel = `${formatStorage(usedBytes)} of ${formatStorage(quotaBytes)} used`;

  return (
    <div className="flex animate-in fade-in flex-col gap-8 duration-300 text-zinc-900">
      <SettingsPanelTitle>Storage</SettingsPanelTitle>

      <section className="border-b border-zinc-200 pb-8">
        <SettingsProgressBar
          value={usedBytes}
          max={quotaBytes}
          label={usedLabel}
        />
      </section>

      <section>
        <SettingsSectionHeading>Manage storage</SettingsSectionHeading>
        <ul>
          {categories.map((item, index) => (
            <li
              key={item.id}
              className={index > 0 ? "border-t border-zinc-100" : ""}
            >
              <div className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-[14px] text-zinc-900">{item.title}</p>
                  <p className="mt-1 text-[12px] text-zinc-400">
                    {formatStorage(item.bytes)} · {item.count} items
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
