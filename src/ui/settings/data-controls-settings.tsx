"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  Download,
  FileArchive,
  Trash2,
} from "lucide-react";
import {
  SettingsButton,
  SettingsConfirmDialog,
  SettingsInlineNote,
  SettingsListItem,
  SettingsOptionPicker,
  SettingsPage,
  SettingsPanelTitle,
  SettingsRow,
  SettingsSection,
  SettingsStatusBadge,
  SettingsToggleRow,
} from "@/components/settings/settings-ui";
import * as settingsApi from "@/lib/api/settings-extended";
import * as chatsApi from "@/lib/api/chats";
import { openCookieSettings } from "@/lib/cookie-consent";

export type PrivacySettingsState = {
  locationMetadata: boolean;
  helpImproveModels: boolean;
};

interface DataControlsSettingsProps {
  privacy: PrivacySettingsState;
  onPrivacyChange: (patch: Partial<PrivacySettingsState>) => void;
  reduceSensitiveContent: boolean;
  onSafetyChange: (reduceSensitiveContent: boolean) => void;
  onGoToPersonalization?: () => void;
}

const RETENTION_KEY = "clauxen:chat-retention";
const RETENTION_OPTIONS = [
  { value: "never", label: "Keep forever" },
  { value: "30d", label: "After 30 days" },
  { value: "90d", label: "After 90 days" },
  { value: "1y", label: "After 1 year" },
] as const;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exp;
  return `${value >= 10 || exp === 0 ? Math.round(value) : value.toFixed(1)} ${units[exp]}`;
}

type BulkAction = "archive" | "delete";

export function DataControlsSettings({
  privacy,
  onPrivacyChange,
  reduceSensitiveContent,
  onSafetyChange,
  onGoToPersonalization,
}: DataControlsSettingsProps) {
  const [retention, setRetention] = useState<string>("never");
  const [storage, setStorage] = useState<settingsApi.StorageSummary | null>(null);
  const [exports, setExports] = useState<Array<{ id: string; status: string }>>([]);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<{ tone: "muted" | "danger"; text: string } | null>(null);

  const [bulk, setBulk] = useState<BulkAction | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNote, setBulkNote] = useState<{ tone: "muted" | "danger"; text: string } | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RETENTION_KEY);
      if (saved) setRetention(saved);
    } catch {}
    void settingsApi
      .getStorageSummary()
      .then(({ storage: summary }) => setStorage(summary))
      .catch(() => setStorage(null));
  }, []);

  const loadExports = useCallback(() => {
    void settingsApi
      .listDataExports()
      .then(({ jobs }) => setExports(jobs.slice(0, 3)))
      .catch(() => setExports([]));
  }, []);

  useEffect(loadExports, [loadExports]);

  const handleRetention = (value: string) => {
    setRetention(value);
    try {
      window.localStorage.setItem(RETENTION_KEY, value);
    } catch {}
  };

  const handleExport = async () => {
    setExporting(true);
    setExportNote(null);
    try {
      await settingsApi.requestDataExport();
      setExportNote({
        tone: "muted",
        text: "Export started. We'll email you a download link when it's ready.",
      });
      loadExports();
    } catch (err) {
      setExportNote({
        tone: "danger",
        text: err instanceof Error ? err.message : "Export failed.",
      });
    } finally {
      setExporting(false);
    }
  };

  const runBulk = async () => {
    if (!bulk) return;
    setBulkBusy(true);
    setBulkNote(null);
    try {
      const { chats } = await chatsApi.listChats();
      const run = bulk === "archive" ? chatsApi.archiveChat : chatsApi.deleteChat;
      const results = await Promise.allSettled(chats.map((chat) => run(chat.id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      const done = chats.length - failed;
      const verb = bulk === "archive" ? "archived" : "deleted";
      setBulkNote({
        tone: failed ? "danger" : "muted",
        text:
          chats.length === 0
            ? "There are no chats to update."
            : failed
              ? `${done} ${verb}, ${failed} failed. Try again.`
              : `${done} chat${done === 1 ? "" : "s"} ${verb}.`,
      });
      setBulk(null);
    } catch (err) {
      setBulkNote({
        tone: "danger",
        text: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const usedPct =
    storage && storage.quotaBytes > 0
      ? Math.min(100, (storage.usedBytes / storage.quotaBytes) * 100)
      : 0;

  return (
    <SettingsPage>
      <SettingsPanelTitle>Data controls</SettingsPanelTitle>

      <SettingsSection
        title="Model improvement"
        description="Choose what Clauxen can learn from. Changes apply to new chats."
      >
        <SettingsToggleRow
          label="Improve the model for everyone"
          description="Allow your chats and coding sessions to help train future models."
          checked={privacy.helpImproveModels}
          onCheckedChange={(helpImproveModels) => onPrivacyChange({ helpImproveModels })}
        />
        <SettingsToggleRow
          label="Use approximate location"
          description="Share city or region to improve local answers."
          checked={privacy.locationMetadata}
          onCheckedChange={(locationMetadata) => onPrivacyChange({ locationMetadata })}
        />
        <SettingsRow
          label="Cookie preferences"
          description="Essential cookies stay on. Choose the optional ones."
          borderless
        >
          <SettingsButton size="sm" onClick={() => openCookieSettings()}>
            Manage
          </SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Chat history"
        description="Archived chats are hidden from the sidebar but stay searchable."
      >
        <SettingsRow
          label="Auto-delete chats"
          description="Remove chats you haven't opened in a while."
        >
          <SettingsOptionPicker
            value={retention}
            options={RETENTION_OPTIONS}
            onValueChange={handleRetention}
            aria-label="Auto-delete chats"
          />
        </SettingsRow>
        <SettingsRow label="Memory" description="Review or remove things Clauxen remembers.">
          <SettingsButton size="sm" onClick={onGoToPersonalization}>
            Manage
          </SettingsButton>
        </SettingsRow>
        <SettingsRow label="Archive all chats" description="Move every chat out of the sidebar.">
          <SettingsButton size="sm" onClick={() => setBulk("archive")}>
            <Archive className="size-3.5" aria-hidden />
            Archive all
          </SettingsButton>
        </SettingsRow>
        <SettingsRow
          label="Delete all chats"
          description="Permanently remove every chat and its messages."
          borderless
        >
          <SettingsButton size="sm" variant="danger" onClick={() => setBulk("delete")}>
            <Trash2 className="size-3.5" aria-hidden />
            Delete all
          </SettingsButton>
        </SettingsRow>
        {bulkNote ? (
          <div className="border-t border-[var(--settings-hairline)]">
            <SettingsInlineNote tone={bulkNote.tone}>{bulkNote.text}</SettingsInlineNote>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Export data"
        description="Download a copy of your chats, files, and settings as a ZIP archive."
        action={
          <SettingsButton
            size="sm"
            variant="primary"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            <Download className="size-3.5" aria-hidden />
            {exporting ? "Requesting…" : "Export"}
          </SettingsButton>
        }
      >
        {exports.length === 0 ? (
          <SettingsInlineNote>No exports yet. Links expire 24 hours after they're sent.</SettingsInlineNote>
        ) : (
          exports.map((job) => {
            const ready = /ready|complete|done|succeeded/i.test(job.status);
            const failed = /fail|error/i.test(job.status);
            return (
              <SettingsListItem
                key={job.id}
                icon={<FileArchive className="size-[15px]" />}
                title={`Export ${job.id.slice(0, 8)}`}
                meta={ready ? "Check your email for the download link" : "Preparing archive"}
                action={
                  <SettingsStatusBadge tone={ready ? "success" : failed ? "danger" : "neutral"}>
                    {ready ? "Ready" : failed ? "Failed" : "Processing"}
                  </SettingsStatusBadge>
                }
              />
            );
          })
        )}
        {exportNote ? (
          <div className="border-t border-[var(--settings-hairline)]">
            <SettingsInlineNote tone={exportNote.tone}>{exportNote.text}</SettingsInlineNote>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Storage" description="Files, images, and artifacts saved to your library.">
        <div className="flex flex-col gap-2.5 px-3.5 py-3 sm:px-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13.5px] font-medium text-[var(--settings-fg)]">
              {storage ? formatBytes(storage.usedBytes) : "—"}
              <span className="font-normal text-[var(--settings-fg-muted)]">
                {" "}of {storage ? formatBytes(storage.quotaBytes) : "—"} used
              </span>
            </span>
            <span className="text-[12px] tabular-nums text-[var(--settings-fg-muted)]">
              {storage ? `${usedPct.toFixed(usedPct < 10 ? 1 : 0)}%` : ""}
            </span>
          </div>
          <div
            className="cx-set-bar"
            role="progressbar"
            aria-valuenow={Math.round(usedPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Storage used"
          >
            <span style={{ width: `${Math.max(usedPct, storage ? 0.8 : 0)}%` }} />
          </div>
          {storage && storage.categories.length > 0 ? (
            <ul className="mt-0.5 grid grid-cols-1 gap-x-5 gap-y-1 sm:grid-cols-2">
              {storage.categories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between gap-3 text-[12.5px] leading-5"
                >
                  <span className="truncate text-[var(--settings-fg-muted)]">
                    {category.title}
                    <span className="text-[var(--settings-fg-subtle)]"> · {category.count}</span>
                  </span>
                  <span className="tabular-nums text-[var(--settings-fg)]">
                    {formatBytes(category.bytes)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Content safety"
        description="Safeguards for sensitive material and younger users."
      >
        <SettingsToggleRow
          label="Reduce sensitive content"
          description="Soften graphic or highly sensitive material when possible."
          checked={reduceSensitiveContent}
          onCheckedChange={onSafetyChange}
        />
        <SettingsRow
          label="Parental controls"
          description="Link a teen's account to set limits and quiet hours."
        >
          <SettingsButton size="sm">Add member</SettingsButton>
        </SettingsRow>
        <SettingsRow
          label="Trusted contact"
          description="Someone 18+ we can notify if you may be at risk."
          borderless
        >
          <SettingsButton size="sm">Add contact</SettingsButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsConfirmDialog
        open={bulk !== null}
        onOpenChange={(open) => {
          if (!open && !bulkBusy) setBulk(null);
        }}
        title={bulk === "delete" ? "Delete all chats?" : "Archive all chats?"}
        description={
          bulk === "delete"
            ? "Every chat and its messages will be permanently deleted. Files in your library are kept."
            : "Chats move out of the sidebar. You can unarchive them any time."
        }
        confirmLabel={bulk === "delete" ? "Delete all" : "Archive all"}
        tone={bulk === "delete" ? "danger" : "default"}
        confirmPhrase={bulk === "delete" ? "DELETE" : undefined}
        busy={bulkBusy}
        onConfirm={runBulk}
      />
    </SettingsPage>
  );
}

/** @deprecated Use DataControlsSettings. */
export const PrivacySafetySettings = DataControlsSettings;
