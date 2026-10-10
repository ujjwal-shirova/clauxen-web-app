"use client";

import { useState } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { ChevronDown, Check } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { apiFetch } from "@/lib/api/client";
import { appBtn } from "@/lib/app-buttons";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { ScheduledTaskRow } from "@/server/repositories/scheduled-tasks.repository";
import {
  computeNextRunAt,
  type ScheduleFrequency,
} from "@/server/services/scheduled-tasks-schedule";

const fieldClass =
  "flex h-10 w-full items-center justify-between rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)] px-3 text-left text-[13px] text-[var(--ui-fg)] shadow-none outline-none placeholder:text-[var(--ui-fg-placeholder)] focus-visible:border-[var(--ui-field-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]";
const dateValue = (value: string) =>
  value ? new Date(`${value}T12:00:00`) : undefined;

function DateField({
  value,
  onChange,
  label,
  optional = false,
  timezone,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  optional?: boolean;
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  let today = startOfDay(new Date());
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    today = new Date(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
    );
  } catch {
    /* Invalid timezone is reported by the form validator. */
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={fieldClass} aria-label={label}>
        {value ? format(dateValue(value)!, "MMM d, yyyy") : "Never"}
        <ChevronDown className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto rounded-xl p-3"
        style={{ zIndex: 60 }}
      >
        <DayPicker
          mode="single"
          selected={dateValue(value)}
          defaultMonth={dateValue(value)}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
          disabled={{ before: today }}
          showOutsideDays
          captionLayout="dropdown"
          startMonth={today}
          endMonth={addDays(today, 3650)}
          classNames={{
            root: "relative",
            months: "relative",
            month: "space-y-4",
            month_caption:
              "flex h-9 items-center justify-center gap-2 px-9 text-[13px] font-medium",
            dropdowns: "flex gap-2",
            dropdown_root: "relative",
            dropdown: "rounded-lg bg-[hsl(var(--background))] p-1",
            caption_label: "hidden",
            nav: "absolute inset-x-0 top-0 flex justify-between",
            button_previous: "rounded-lg p-2 hover:bg-[hsl(var(--muted))]",
            button_next: "rounded-lg p-2 hover:bg-[hsl(var(--muted))]",
            month_grid: "border-collapse",
            weekday:
              "size-8 text-[11px] font-normal text-[hsl(var(--muted-foreground))]",
            day: "size-8 p-0 text-center",
            day_button:
              "size-8 rounded-lg text-[12px] hover:bg-[hsl(var(--muted))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
            selected:
              "rounded-xl no-hover-overlay bg-[hsl(var(--foreground))] text-[hsl(var(--background))]",
            today: "font-bold text-blue-500",
            disabled: "pointer-events-none opacity-25",
            outside: "text-[hsl(var(--muted-foreground)/0.5)]",
          }}
        />
        {optional ? (
          <button
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="mt-3 w-full rounded-xl p-2 text-sm hover:bg-[hsl(var(--muted))]"
          >
            No expiration
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function TimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [hour, minute] = value.split(":");
  return (
    <Popover>
      <PopoverTrigger className={fieldClass} aria-label="Run time">
        {value}
        <ChevronDown className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-56 rounded-xl p-2.5" style={{ zIndex: 60 }}>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Hour", count: 24, selected: hour },
            { label: "Minute", count: 60, selected: minute },
          ].map((column, index) => (
            <div key={column.label}>
              <p className="mb-2 text-center text-xs text-[hsl(var(--muted-foreground))]">
                {column.label}
              </p>
              <div
                className="h-40 overflow-y-auto"
                ref={(node) => {
                  if (node)
                    node.scrollTop = Math.max(
                      0,
                      Number(column.selected) * 32 - 64,
                    );
                }}
                role="listbox"
                aria-label={column.label}
              >
                {Array.from({ length: column.count }, (_, n) =>
                  String(n).padStart(2, "0"),
                ).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="option"
                    aria-selected={column.selected === n}
                    onClick={() =>
                      onChange(index === 0 ? `${n}:${minute}` : `${hour}:${n}`)
                    }
                    className={`flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-[13px] ${column.selected === n ? "bg-[hsl(var(--muted))] font-semibold" : "hover:bg-[hsl(var(--muted)/0.5)]"}`}
                  >
                    {n}
                    {column.selected === n ? (
                      <Check className="size-3" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ScheduledTaskForm({
  task,
  onClose,
  onSaved,
}: {
  task: ScheduledTaskRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(task?.name ?? "");
  const [prompt, setPrompt] = useState(task?.requirement ?? "");
  const [model, setModel] = useState(task?.model_mode ?? "fast");
  const [frequency, setFrequency] = useState<ScheduleFrequency>(
    task?.frequency ?? "daily",
  );
  const [time, setTime] = useState(task?.time_local ?? "09:00");
  const [runDate, setRunDate] = useState(
    task?.run_date ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [expiration, setExpiration] = useState(
    task?.expires_at ??
      (task ? "" : format(addDays(new Date(), 7), "yyyy-MM-dd")),
  );
  const [weekday, setWeekday] = useState(
    String(task?.day_of_week ?? new Date().getDay()),
  );
  const [monthDay, setMonthDay] = useState(
    String(task?.day_of_month ?? new Date().getDate()),
  );
  const [timezone, setTimezone] = useState(
    task?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [notification, setNotification] = useState(
    task?.notification_mode ?? "app_only",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let next: Date | null = null;
  let scheduleError: string | null = null;
  try {
    next = computeNextRunAt({
      frequency,
      timeLocal: time,
      timezone,
      runDate,
      dayOfWeek: Number(weekday),
      dayOfMonth: Number(monthDay),
      expiresAt: frequency === "once" ? null : expiration || null,
    });
    if (!next)
      scheduleError = "Choose a future run time before the expiration date.";
  } catch {
    scheduleError = "Enter a valid IANA timezone, such as Asia/Kolkata.";
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !next) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/scheduled-tasks${task ? `/${task.id}` : ""}`, {
        method: task ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          requirement: prompt,
          modelMode: model,
          frequency,
          timeLocal: time,
          timezone,
          runDate: frequency === "once" ? runDate : null,
          dayOfWeek: frequency === "weekly" ? Number(weekday) : null,
          dayOfMonth: frequency === "monthly" ? Number(monthDay) : null,
          expiresAt: frequency === "once" ? null : expiration || null,
          notificationMode: notification,
          ...(task?.status === "completed" ? { status: "active" } : {}),
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save task.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        className="max-h-[min(90dvh,800px)] !max-w-[520px] overflow-y-auto !rounded-2xl !p-5 sm:!p-6"
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <DialogTitle className="!text-[18px] !leading-6">
          {task ? "Edit scheduled task" : "New scheduled task"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Choose what Clauxen should do and when it should run.
        </DialogDescription>
        <form onSubmit={save} className="mt-1 space-y-4">
          <div>
            <label
              htmlFor="scheduled-name"
              className="mb-1.5 block text-[12px] font-medium text-[var(--ui-fg-muted)]"
            >
              Name
            </label>
            <div className="relative">
              <input
                id="scheduled-name"
                required
                maxLength={50}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Task name"
                className={`${fieldClass} pr-20`}
              />
              <span
                className="absolute right-3 top-3 text-[11px] text-[var(--ui-fg-muted)]"
                aria-live="polite"
              >
                {name.length}/50
              </span>
            </div>
          </div>
          <div>
            <label
              htmlFor="scheduled-prompt"
              className="mb-1.5 block text-[12px] font-medium text-[var(--ui-fg-muted)]"
            >
              Prompt
            </label>
            <textarea
              id="scheduled-prompt"
              required
              maxLength={8000}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe what you’d like Clauxen to do"
              className="min-h-24 w-full resize-y rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)] p-3 text-[13px] leading-5 text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)] focus-visible:border-[var(--ui-field-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-fg-muted)]">
              Execution model
            </label>
            <Select
              value={model}
              onValueChange={(value) => setModel(value as typeof model)}
            >
              <SelectTrigger
                aria-label="Execution model"
                className={fieldClass}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1 text-[13px] text-[hsl(var(--popover-foreground))]">
                <SelectItem value="fast">Instant</SelectItem>
                <SelectItem value="thinking">Thinking</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-fg-muted)]">
              Schedule
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                value={frequency}
                onValueChange={(value) =>
                  setFrequency(value as ScheduleFrequency)
                }
              >
                <SelectTrigger aria-label="Frequency" className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1 text-[13px] text-[hsl(var(--popover-foreground))]">
                  {["daily", "weekly", "monthly", "once"].map((value) => (
                    <SelectItem key={value} value={value}>
                      <span className="capitalize">{value}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <TimeField value={time} onChange={setTime} />
              {frequency === "once" ? (
                <DateField
                  timezone={timezone}
                  label="Run date"
                  value={runDate}
                  onChange={setRunDate}
                />
              ) : null}
              {frequency === "weekly" ? (
                <Select value={weekday} onValueChange={setWeekday}>
                  <SelectTrigger aria-label="Weekday" className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1 text-[13px] text-[hsl(var(--popover-foreground))]">
                    {[
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ].map((day, index) => (
                      <SelectItem key={day} value={String(index)}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {frequency === "monthly" ? (
                <Select value={monthDay} onValueChange={setMonthDay}>
                  <SelectTrigger
                    aria-label="Day of month"
                    className={fieldClass}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1 text-[13px] text-[hsl(var(--popover-foreground))]">
                    {Array.from({ length: 31 }, (_, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        Day {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
            {frequency === "monthly" && Number(monthDay) > 28 ? (
              <p className="mt-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                In shorter months, this task runs on the last day.
              </p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="scheduled-timezone"
              className="mb-1.5 block text-[12px] font-medium text-[var(--ui-fg-muted)]"
            >
              Timezone
            </label>
            <input
              id="scheduled-timezone"
              required
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className={fieldClass}
            />
          </div>
          {frequency !== "once" ? (
            <div>
              <label className="mb-2 block text-sm text-[hsl(var(--muted-foreground))]">
                Expiration
              </label>
              <DateField
                timezone={timezone}
                label="Expiration date"
                optional
                value={expiration}
                onChange={setExpiration}
              />
              <p className="mt-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                Runs through the selected date in your timezone.
              </p>
            </div>
          ) : null}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-fg-muted)]">
              Results notification
            </label>
            <Select
              value={notification}
              onValueChange={(value) =>
                setNotification(value as typeof notification)
              }
            >
              <SelectTrigger
                aria-label="Results notification"
                className={fieldClass}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1 text-[13px] text-[hsl(var(--popover-foreground))]">
                <SelectItem value="app_only">In app</SelectItem>
                <SelectItem value="email_app">Email and in app</SelectItem>
                <SelectItem value="email_only">Email</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {next ? (
            <p className="rounded-lg bg-[var(--ui-hover-wash)] px-3 py-2 text-[11px] text-[var(--ui-fg-muted)]">
              Next run:{" "}
              {next.toLocaleString(undefined, {
                timeZone: timezone,
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
          {error || scheduleError ? (
            <p role="alert" className="text-sm text-red-500">
              {error || scheduleError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className={appBtn.secondary}
            >
              Cancel
            </button>
            <button
              disabled={saving || !name.trim() || !prompt.trim() || !next}
              className={`${appBtn.primary} disabled:opacity-40`}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
