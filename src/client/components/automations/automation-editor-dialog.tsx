"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileClock,
  Folder,
  Gauge,
  Plus,
  Settings2,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { AutomationIcon } from "./automation-icon";
import {
  AUTOMATION_PRESETS,
  type AutomationIcon as AutomationIconName,
  type AutomationPreset,
} from "./automation-presets";
import type {
  ApiAutomation,
  AutomationFrequency,
  AutomationInput,
} from "@/lib/api/automations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { APP_ROUTES, buildOverlayLocation } from "@/lib/app-routes";
import { useAppPathname } from "@/hooks/use-app-pathname";
import { cn } from "@/lib/utils";

type Draft = AutomationInput & {
  id?: string;
  status?: string;
  icon?: AutomationIconName;
};
type AuxiliaryDialog = "connectors" | "skills" | null;

const FREQUENCIES: { value: AutomationFrequency; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const NOTIFICATION_OPTIONS = ["Email + App", "Email only", "App only", "Off"];
const NOTIFICATION_VALUES = {
  "Email + App": "email_app",
  "Email only": "email_only",
  "App only": "app_only",
  Off: "off",
} as const;
const NOTIFICATION_LABELS = {
  email_app: "Email + App",
  email_only: "Email only",
  app_only: "App only",
  off: "Off",
} as const;

function timezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function tomorrow() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

function makeDraft(value: AutomationPreset | ApiAutomation | null): Draft {
  if (!value)
    return {
      name: "My Automation",
      requirement: "",
      frequency: "daily",
      timeLocal: "09:00",
      timezone: timezone(),
      icon: "sun",
    };
  if ("instructions" in value) {
    return {
      name: value.name,
      requirement: value.instructions,
      frequency: value.frequency,
      timeLocal: value.timeLocal,
      timezone: timezone(),
      dayOfWeek: value.dayOfWeek ?? null,
      dayOfMonth: 1,
      icon: value.icon,
    };
  }
  return {
    id: value.id,
    name: value.name,
    requirement: value.requirement,
    frequency: value.frequency,
    timeLocal: value.time_local,
    timezone: value.timezone,
    runDate: value.run_date,
    dayOfWeek: value.day_of_week,
    dayOfMonth: value.day_of_month,
    status: value.status,
    notificationMode: value.notification_mode,
    modelMode: value.model_mode,
    connectorIds: value.connector_ids,
    skillIds: value.skill_ids,
    attachmentRefs: value.attachment_refs,
    projectId: value.project_id,
    icon: AUTOMATION_PRESETS.find((preset) => preset.name === value.name)?.icon,
  };
}

function toTwelveHour(time: string) {
  const [h, m] = time.split(":").map(Number);
  return {
    hour: h % 12 || 12,
    minute: m || 0,
    period: h >= 12 ? "PM" : ("AM" as "AM" | "PM"),
  };
}

function fromTwelveHour(hour: number, minute: number, period: "AM" | "PM") {
  const h = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function AutomationEditorDialog({
  open,
  value,
  saving,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  value: AutomationPreset | ApiAutomation | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: Draft) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const pathname = useAppPathname() || APP_ROUTES.automations;
  const [draft, setDraft] = useState<Draft>(() => makeDraft(value));
  const [auxiliary, setAuxiliary] = useState<AuxiliaryDialog>(null);
  const [notification, setNotification] = useState(NOTIFICATION_OPTIONS[0]);
  const [model, setModel] = useState<"Fast" | "Thinking">("Fast");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(makeDraft(value));
      setNotification(
        value && !("instructions" in value)
          ? NOTIFICATION_LABELS[value.notification_mode]
          : NOTIFICATION_OPTIONS[0],
      );
      setModel(
        value && !("instructions" in value) && value.model_mode === "thinking"
          ? "Thinking"
          : "Fast",
      );
    }
  }, [open, value]);

  const time = useMemo(() => toTwelveHour(draft.timeLocal), [draft.timeLocal]);
  const canSave =
    draft.name.trim().length > 0 &&
    draft.requirement.trim().length > 0 &&
    !saving;
  const patch = (next: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...next }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(860px,calc(100dvh-1.25rem))] w-[calc(100%-1rem)] max-w-[880px] gap-0 overflow-hidden rounded-[28px] border-0 bg-[#fcfcfc] p-0 shadow-[0_26px_90px_rgba(0,0,0,.18)] [&>button]:hidden">
          <DialogHeader className="flex-row items-center justify-between border-b border-black/[0.04] px-7 py-6 text-left sm:px-8">
            <DialogTitle className="text-[20px] font-semibold tracking-[-0.02em]">
              {draft.id ? "Edit Automation" : "New Automation"}
            </DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="ui-icon-button text-zinc-500"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <DialogDescription className="sr-only">
              Configure an automated task.
            </DialogDescription>
          </DialogHeader>

          <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-7 py-5 sm:px-8">
            <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3">
              <div className="flex h-12 items-center justify-center rounded-2xl border border-black/[0.08] text-zinc-500">
                <AutomationIcon name={draft.icon} />
              </div>
              <input
                value={draft.name}
                onChange={(event) => patch({ name: event.target.value })}
                aria-label="Automation name"
                className="h-12 min-w-0 rounded-2xl border border-black/[0.08] bg-transparent px-4 text-[17px] outline-none transition focus:border-black/20"
              />
            </div>

            <section className="mt-6">
              <h3 className="mb-2 text-[14px] font-semibold text-zinc-600">
                Triggers
              </h3>
              <div className="flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border border-black/[0.08] px-3 py-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-zinc-500 text-white">
                  <Clock3 className="size-[18px]" />
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-black/[0.04] px-3 text-[15px] font-medium capitalize"
                    >
                      {draft.frequency}
                      <ChevronDown className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="min-w-44 rounded-2xl p-2"
                  >
                    {FREQUENCIES.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onSelect={() =>
                          patch({
                            frequency: option.value,
                            runDate:
                              option.value === "once"
                                ? draft.runDate || tomorrow()
                                : null,
                            dayOfWeek:
                              option.value === "weekly"
                                ? (draft.dayOfWeek ?? new Date().getDay())
                                : null,
                            dayOfMonth:
                              option.value === "monthly"
                                ? (draft.dayOfMonth ?? 1)
                                : null,
                          })
                        }
                        className="rounded-xl px-3 py-2.5 text-[15px]"
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled
                      className="rounded-xl px-3 py-2 text-[14px]"
                    >
                      Hourly <span className="ml-auto text-zinc-400">Soon</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled
                      className="rounded-xl px-3 py-2 text-[14px]"
                    >
                      Yearly <span className="ml-auto text-zinc-400">Soon</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {draft.frequency === "weekly" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="h-9 rounded-xl bg-black/[0.04] px-3 text-[15px]"
                      >
                        {WEEKDAYS[draft.dayOfWeek ?? 1]}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {WEEKDAYS.map((day, index) => (
                        <DropdownMenuItem
                          key={day}
                          onSelect={() => patch({ dayOfWeek: index })}
                        >
                          {day}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                {draft.frequency === "monthly" ? (
                  <label className="flex items-center gap-2 text-[14px] text-zinc-500">
                    on day{" "}
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={draft.dayOfMonth ?? 1}
                      onChange={(event) =>
                        patch({
                          dayOfMonth: Math.max(
                            1,
                            Math.min(31, Number(event.target.value)),
                          ),
                        })
                      }
                      className="h-9 w-16 rounded-xl bg-black/[0.04] px-2 text-center text-zinc-900 outline-none"
                    />
                  </label>
                ) : null}
                {draft.frequency === "once" ? (
                  <input
                    type="date"
                    value={draft.runDate ?? tomorrow()}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => patch({ runDate: event.target.value })}
                    className="h-9 rounded-xl bg-black/[0.04] px-3 text-[14px] outline-none"
                  />
                ) : null}
                <span className="text-[15px] text-zinc-500">at</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-9 rounded-xl bg-black/[0.04] px-3 text-[15px] font-medium"
                    >
                      {time.hour}:{String(time.minute).padStart(2, "0")}{" "}
                      {time.period}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="flex w-auto items-center gap-2 rounded-2xl p-3"
                  >
                    <input
                      aria-label="Hour"
                      type="number"
                      min={1}
                      max={12}
                      value={time.hour}
                      onChange={(event) =>
                        patch({
                          timeLocal: fromTwelveHour(
                            Math.max(
                              1,
                              Math.min(12, Number(event.target.value)),
                            ),
                            time.minute,
                            time.period,
                          ),
                        })
                      }
                      className="h-12 w-14 rounded-xl bg-black/[0.05] text-center text-[17px] outline-none"
                    />
                    <span>:</span>
                    <input
                      aria-label="Minute"
                      type="number"
                      min={0}
                      max={59}
                      value={time.minute}
                      onChange={(event) =>
                        patch({
                          timeLocal: fromTwelveHour(
                            time.hour,
                            Math.max(
                              0,
                              Math.min(59, Number(event.target.value)),
                            ),
                            time.period,
                          ),
                        })
                      }
                      className="h-12 w-14 rounded-xl bg-black/[0.05] text-center text-[17px] outline-none"
                    />
                    {(["AM", "PM"] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() =>
                          patch({
                            timeLocal: fromTwelveHour(
                              time.hour,
                              time.minute,
                              period,
                            ),
                          })
                        }
                        className={cn(
                          "h-12 rounded-xl px-3 font-medium",
                          time.period === period
                            ? "bg-white shadow-sm"
                            : "text-zinc-500",
                        )}
                      >
                        {period}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  className="ui-icon-button ml-auto text-zinc-500"
                  aria-label="Remove trigger"
                >
                  <Trash2 className="size-[18px]" />
                </button>
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-2 text-[14px] font-semibold text-zinc-600">
                Instructions
              </h3>
              <div className="rounded-2xl border border-black/[0.08] p-4 pb-2">
                <textarea
                  value={draft.requirement}
                  onChange={(event) =>
                    patch({ requirement: event.target.value })
                  }
                  placeholder="Ask Clauxen anything"
                  rows={6}
                  className="w-full resize-none bg-transparent text-[16px] leading-7 outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <input ref={fileRef} type="file" className="hidden" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="ui-icon-button text-zinc-500"
                        aria-label="Attach"
                      >
                        <Plus className="size-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="min-w-52 rounded-2xl p-2"
                    >
                      <DropdownMenuItem
                        onSelect={() => fileRef.current?.click()}
                        className="rounded-xl py-2"
                      >
                        <Upload className="mr-2 size-4" />
                        Upload a file
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="rounded-xl py-2">
                          <FileClock className="mr-2 size-4" />
                          Recent
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="rounded-xl p-2">
                          <DropdownMenuItem disabled>
                            No recent files
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="rounded-xl py-2">
                          <Folder className="mr-2 size-4" />
                          Add to project
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="rounded-xl p-2">
                          <DropdownMenuItem disabled>
                            No projects available
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    type="button"
                    onClick={() => setAuxiliary("connectors")}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[14px] font-medium hover:bg-black/[0.04]"
                  >
                    <Wrench className="size-4" />
                    Connectors{" "}
                    <span className="text-zinc-500">
                      {draft.connectorIds?.length ?? 0}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuxiliary("skills")}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[14px] font-medium hover:bg-black/[0.04]"
                  >
                    <Gauge className="size-4" />
                    Skills{" "}
                    <span className="text-zinc-500">
                      {draft.skillIds?.length ?? 0}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="ml-auto flex h-8 items-center gap-1 px-2 text-[14px] font-semibold"
                      >
                        {model}
                        <ChevronDown className="size-4 text-zinc-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setModel("Fast")}>
                        Fast
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setModel("Thinking")}>
                        Thinking
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-2 text-[14px] font-semibold text-zinc-600">
                Notification
              </h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-14 w-full items-center rounded-2xl border border-black/[0.08] px-4 text-[15px]"
                  >
                    <Bell className="mr-3 size-5" />
                    {notification}
                    <ChevronDown className="ml-auto size-4 text-zinc-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-2xl p-2"
                >
                  {NOTIFICATION_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option}
                      onSelect={() => setNotification(option)}
                      className="rounded-xl px-3 py-2.5"
                    >
                      {option}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </section>
          </div>

          <div className="flex items-center justify-between border-t border-black/[0.05] px-7 py-4 sm:px-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-xl border border-black/[0.1] px-4 text-[14px] font-medium"
              >
                Cancel
              </button>
              {draft.id && onDelete ? (
                <button
                  type="button"
                  onClick={() => void onDelete(draft.id!)}
                  disabled={saving}
                  className="ui-icon-button text-red-600"
                  aria-label="Delete automation"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              disabled={!canSave}
              onClick={() =>
                void onSave({
                  ...draft,
                  notificationMode:
                    NOTIFICATION_VALUES[
                      notification as keyof typeof NOTIFICATION_VALUES
                    ],
                  modelMode: model === "Thinking" ? "thinking" : "fast",
                })
              }
              className="h-10 rounded-xl bg-zinc-950 px-5 text-[14px] font-medium text-white disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={auxiliary !== null}
        onOpenChange={(next) => {
          if (!next) setAuxiliary(null);
        }}
      >
        <DialogContent className="max-w-[520px] gap-0 overflow-hidden rounded-[24px] border-0 bg-[#fcfcfc] p-0 [&>button]:hidden">
          <DialogHeader className="px-6 pb-4 pt-6 text-left">
            <DialogTitle className="text-[20px]">
              {auxiliary === "skills" ? "Skills" : "Connectors"}
            </DialogTitle>
            <DialogDescription className="mt-3 text-[16px] text-zinc-500">
              No {auxiliary} available
            </DialogDescription>
          </DialogHeader>
          <a
            href={buildOverlayLocation(
              {
                type: "settings",
                tab: auxiliary === "skills" ? "Skills" : "Connectors",
              },
              pathname,
            )}
            className="flex items-center border-t border-black/[0.06] px-6 py-4 text-[16px] font-medium"
          >
            <Settings2 className="mr-3 size-5" />
            Manage {auxiliary === "skills" ? "Skills" : "Connectors"}
            <ExternalLink className="ml-auto size-4 text-zinc-500" />
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
