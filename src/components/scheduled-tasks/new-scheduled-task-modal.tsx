"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollTimePicker } from "@/components/scheduled-tasks/scroll-time-picker";
import type { ScheduleFrequency } from "@/server/services/scheduled-tasks-schedule";

const FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "once", label: "Once" },
];

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export type NewScheduledTaskPayload = {
  name: string;
  requirement: string;
  frequency: ScheduleFrequency;
  timeLocal: string;
  timezone: string;
  runDate?: string | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  expiresAt?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: NewScheduledTaskPayload) => Promise<void>;
  saving?: boolean;
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatYmdLabel(ymd: string | null): string {
  if (!ymd) return "Select date";
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function defaultTime(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, "0");
  return `${h}:${m}`;
}

function defaultExpiration(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return toYmd(d);
}

export function NewScheduledTaskModal({
  open,
  onClose,
  onSave,
  saving = false,
}: Props) {
  const [name, setName] = useState("");
  const [requirement, setRequirement] = useState("");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [timeLocal, setTimeLocal] = useState(defaultTime);
  const [runDate, setRunDate] = useState(() => toYmd(new Date()));
  const [dayOfWeek, setDayOfWeek] = useState(() => new Date().getDay());
  const [dayOfMonth, setDayOfMonth] = useState(() => new Date().getDate());
  const [expiresAt, setExpiresAt] = useState(defaultExpiration);
  const [freqOpen, setFreqOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [runDateOpen, setRunDateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setRequirement("");
    setFrequency("daily");
    setTimeLocal(defaultTime());
    setRunDate(toYmd(new Date()));
    setDayOfWeek(new Date().getDay());
    setDayOfMonth(new Date().getDate());
    setExpiresAt(defaultExpiration());
    setError(null);
  }, [open]);

  const canSave = useMemo(() => {
    return name.trim().length > 0 && requirement.trim().length > 0 && !saving;
  }, [name, requirement, saving]);

  if (!open) return null;

  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC";

  const handleSave = async () => {
    if (!canSave) return;
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        requirement: requirement.trim(),
        frequency,
        timeLocal,
        timezone,
        runDate: frequency === "once" ? runDate : null,
        dayOfWeek: frequency === "weekly" ? dayOfWeek : null,
        dayOfMonth: frequency === "monthly" ? dayOfMonth : null,
        expiresAt: expiresAt || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  };

  const fieldBtn =
    "flex h-10 w-full items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-3 text-left text-[14px] text-zinc-900 outline-none transition-colors hover:bg-black/[0.05]";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 transition-opacity duration-225"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-scheduled-task-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[560px] min-w-[320px] flex-col gap-4 rounded-2xl border border-black/[0.03] bg-white p-6 shadow-xl">
        <div className="relative flex items-center justify-between">
          <h2
            id="new-scheduled-task-title"
            className="text-[16px] font-medium leading-6 text-zinc-900"
          >
            New Scheduled Task
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-0 flex h-6 w-6 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-800"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col">
          {/* Name */}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] leading-5 text-zinc-900">Name</label>
            <div className="relative flex w-full items-center">
              <input
                type="text"
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a task name"
                className="h-10 w-full rounded-xl bg-black/[0.03] px-3 pr-[52px] text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <span className="pointer-events-none absolute right-3 text-[12px] leading-[18px] text-black/45">
                {name.length}/50
              </span>
            </div>
          </div>

          {/* Requirement */}
          <div className="mt-6 flex flex-col gap-2">
            <label className="text-[14px] leading-5 text-zinc-900">
              Requirement
            </label>
            <div className="relative">
              <textarea
                maxLength={8000}
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder="Enter your requirement"
                className="min-h-[160px] w-full resize-none rounded-xl bg-black/[0.03] px-3 pb-8 pt-2.5 text-[14px] leading-5 text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <span className="pointer-events-none absolute bottom-2.5 right-3 text-[12px] leading-[18px] text-black/45">
                {requirement.length}/8000
              </span>
            </div>
          </div>

          {/* Execution time */}
          <div className="mt-6 flex flex-col gap-2">
            <label className="text-[14px] leading-5 text-zinc-900">
              Execution time
            </label>
            <div className="grid w-full grid-cols-2 gap-3">
              <Popover open={freqOpen} onOpenChange={setFreqOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className={fieldBtn}>
                    <span className="truncate">
                      {FREQUENCIES.find((f) => f.value === frequency)?.label}
                    </span>
                    <ChevronDown className="h-5 w-5 shrink-0 text-zinc-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[200px] rounded-xl border border-black/[0.06] p-1 shadow-lg"
                >
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => {
                        setFrequency(f.value);
                        setFreqOpen(false);
                      }}
                      className={cn(
                        "flex w-full rounded-lg px-3 py-2 text-left text-[14px] transition-colors hover:bg-zinc-100",
                        frequency === f.value
                          ? "font-medium text-zinc-900"
                          : "text-zinc-700",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Popover open={timeOpen} onOpenChange={setTimeOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className={fieldBtn}>
                    <span className="tabular-nums">{timeLocal}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 text-zinc-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-auto rounded-2xl border border-black/[0.06] p-2 shadow-lg"
                >
                  <ScrollTimePicker
                    value={timeLocal}
                    onChange={setTimeLocal}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {frequency === "weekly" ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDayOfWeek(d.value)}
                    className={cn(
                      "h-8 min-w-10 rounded-lg px-2 text-[13px] transition-colors",
                      dayOfWeek === d.value
                        ? "bg-zinc-900 text-white"
                        : "bg-black/[0.03] text-zinc-700 hover:bg-black/[0.06]",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            ) : null}

            {frequency === "monthly" ? (
              <div className="mt-1 flex items-center gap-2 text-[13px] text-zinc-600">
                <span>Day</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) =>
                    setDayOfMonth(
                      Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                    )
                  }
                  className="h-9 w-16 rounded-xl bg-black/[0.03] px-2 text-center text-[14px] text-zinc-900 outline-none"
                />
                <span>of each month</span>
              </div>
            ) : null}

            {frequency === "once" ? (
              <Popover open={runDateOpen} onOpenChange={setRunDateOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className={cn(fieldBtn, "mt-1")}>
                    <span>Run on {formatYmdLabel(runDate)}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 text-zinc-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-auto rounded-2xl border border-black/[0.06] p-2 shadow-lg"
                >
                  <Calendar
                    mode="single"
                    selected={new Date(`${runDate}T12:00:00`)}
                    onSelect={(d) => {
                      if (!d) return;
                      setRunDate(toYmd(d));
                      setRunDateOpen(false);
                    }}
                    disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                    classNames={{
                      day_selected:
                        "bg-zinc-900 text-white hover:bg-zinc-900 hover:text-white focus:bg-zinc-900 focus:text-white rounded-lg",
                    }}
                  />
                </PopoverContent>
              </Popover>
            ) : null}
          </div>

          {/* Expiration */}
          <div className="mt-6 flex flex-col gap-2">
            <label className="text-[14px] leading-5 text-zinc-900">
              Expiration
            </label>
            <Popover open={expOpen} onOpenChange={setExpOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={fieldBtn}>
                  <span>{formatYmdLabel(expiresAt)}</span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-zinc-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto rounded-2xl border border-black/[0.06] p-2 shadow-lg"
              >
                <Calendar
                  mode="single"
                  selected={
                    expiresAt ? new Date(`${expiresAt}T12:00:00`) : undefined
                  }
                  onSelect={(d) => {
                    if (!d) return;
                    setExpiresAt(toYmd(d));
                    setExpOpen(false);
                  }}
                  disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                  classNames={{
                    day_selected:
                      "bg-zinc-900 text-white hover:bg-zinc-900 hover:text-white focus:bg-zinc-900 focus:text-white rounded-lg",
                    caption_label: "text-sm font-medium",
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {error ? (
            <p className="mt-3 text-[13px] text-red-600">{error}</p>
          ) : null}

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 min-w-[62px] items-center justify-center rounded-[10px] bg-black/[0.03] px-2.5 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-black/[0.06]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void handleSave()}
              className={cn(
                "flex h-8 min-w-[62px] items-center justify-center rounded-[10px] px-2.5 text-[14px] font-medium transition-colors",
                canSave
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "cursor-not-allowed bg-black/15 text-black/30",
              )}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
