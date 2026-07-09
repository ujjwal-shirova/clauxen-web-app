"use client";

import { useState } from "react";
import {
  SettingsPanelTitle,
  SettingsPillButton,
} from "@/frontend/components/settings/settings-ui";
import * as settingsApi from "@/frontend/lib/api/settings-extended";

export function DataControlsSettings() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const { job } = await settingsApi.requestDataExport();
      setMessage(`Export requested (job ${job.id.slice(0, 8)}…).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Request account deletion? This queues permanent deletion of your data.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const { request } = await settingsApi.requestDataDeletion();
      setMessage(`Deletion requested (request ${request.id.slice(0, 8)}…).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion request failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex animate-in fade-in flex-col gap-2 duration-300 text-zinc-900">
      <SettingsPanelTitle>Data controls</SettingsPanelTitle>

      <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-[#0d0d0d]/5 py-3">
        <span className="text-[14px] font-[430] text-zinc-900">Export data</span>
        <SettingsPillButton onClick={() => void handleExport()}>
          {exporting ? "Requesting…" : "Export"}
        </SettingsPillButton>
      </div>

      <div className="flex min-h-[60px] items-center justify-between gap-4 border-b border-[#0d0d0d]/5 py-3">
        <span className="text-[14px] font-[430] text-zinc-900">
          Delete account & data
        </span>
        <SettingsPillButton
          variant="danger"
          onClick={() => void handleDeleteAccount()}
        >
          {deleting ? "Requesting…" : "Delete"}
        </SettingsPillButton>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
