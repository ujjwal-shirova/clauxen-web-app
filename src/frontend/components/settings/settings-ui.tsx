"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  MoreHorizontal,
  Play,
  UserPlus,
} from "lucide-react";

import { cn } from "@/frontend/lib/utils";
import { Switch } from "@/frontend/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";

export function SettingsPanelTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h2 className="border-b border-zinc-200 pb-3 text-[18px] font-medium leading-7 text-zinc-900">
      {children}
    </h2>
  );
}

export function SettingsPanelHeaderWithHelp({
  title,
  helpHref = "#",
  helpLabel = "Learn more",
}: {
  title: string;
  helpHref?: string;
  helpLabel?: string;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-2 border-b border-zinc-200 pb-3 sm:grid-cols-[1fr_auto] sm:gap-4">
      <h2 className="text-[18px] font-medium leading-7 text-zinc-900">
        {title}
      </h2>
      <a
        href={helpHref}
        className="mt-0.5 inline-flex items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-900"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="sr-only">{helpLabel}</span>
        <Info className="h-4 w-4 shrink-0" aria-hidden />
      </a>
    </div>
  );
}

export function SettingsValueRow({
  label,
  value,
  borderless,
}: {
  label: string;
  value: string;
  borderless?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[60px] items-center justify-between gap-4 py-3",
        !borderless && "border-b border-zinc-100",
      )}
    >
      <span className="text-[14px] font-[430] text-zinc-900">{label}</span>
      <span className="max-w-[65%] truncate text-right text-[14px] text-zinc-600">
        {value}
      </span>
    </div>
  );
}

export function SettingsAddFamilyButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-zinc-100",
        className,
      )}
    >
      <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
      {children}
    </button>
  );
}

export function SettingsSectionHeading({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3 pt-1">
      <h3 className="text-[18px] font-medium leading-7 text-zinc-900">
        {children}
      </h3>
      {action}
    </div>
  );
}

export function SettingsRow({
  label,
  description,
  children,
  borderless,
  className,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  borderless?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-[60px] grid-cols-1 items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[1fr_auto]",
        !borderless && "border-b border-zinc-100",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-[430] text-zinc-900">{label}</div>
        {description ? (
          <div className="mt-1 text-[12px] leading-4 text-zinc-400 text-pretty">
            {description}
          </div>
        ) : null}
      </div>
      <div className="justify-self-start sm:justify-self-end">{children}</div>
    </div>
  );
}

export type SettingsOptionItem = {
  value: string;
  label?: string;
  leading?: React.ReactNode;
};

function normalizeSettingsOptions(
  options: readonly string[] | readonly SettingsOptionItem[],
): SettingsOptionItem[] {
  return options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
}

const settingsFocusReset =
  "outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

const settingsOptionMenuContentClass =
  "z-[120] min-w-[11rem] rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-[0_8px_24px_rgba(24,24,27,0.08)]";

const settingsOptionTriggerClass = cn(
  "no-hover-overlay inline-flex h-9 min-h-9 shrink-0 items-center gap-2 rounded-lg border border-transparent bg-white px-3 text-[14px] text-zinc-900 transition-colors hover:bg-zinc-100 data-[state=open]:border-zinc-200 data-[state=open]:bg-zinc-100",
  settingsFocusReset,
);

const settingsOptionMenuItemClass = cn(
  "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-[14px] font-[430] text-zinc-900 transition-colors hover:bg-zinc-100 focus:bg-zinc-100 focus:text-zinc-900 data-[highlighted]:bg-zinc-100 data-[highlighted]:text-zinc-900",
  settingsFocusReset,
);

/** Radio circles in settings panels — no blue focus ring. */
export const settingsRadioItemClass = cn("mt-0.5", settingsFocusReset);

/** Dropdown picker — opens a list of choices instead of cycling on each click. */
export function SettingsOptionPicker({
  value,
  options,
  onValueChange,
  leading,
  className,
  align = "end",
  "aria-label": ariaLabel,
}: {
  value: string;
  options: readonly string[] | readonly SettingsOptionItem[];
  onValueChange: (value: string) => void;
  leading?: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  "aria-label"?: string;
}) {
  const items = normalizeSettingsOptions(options);
  const selected = items.find((item) => item.value === value) ??
    items[0] ?? { value, label: value };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            ariaLabel ?? `Selected: ${selected.label ?? selected.value}`
          }
          className={cn(settingsOptionTriggerClass, className)}
        >
          {leading ?? selected.leading}
          <span className="max-w-[10rem] truncate">
            {selected.label ?? selected.value}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={settingsOptionMenuContentClass}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {items.map((item) => {
          const isSelected = item.value === value;
          return (
            <DropdownMenuItem
              key={item.value}
              className={settingsOptionMenuItemClass}
              onSelect={() => onValueChange(item.value)}
            >
              {item.leading}
              <span className="flex-1">{item.label ?? item.value}</span>
              {isSelected ? (
                <Check
                  className="h-4 w-4 shrink-0 text-[#1b67b2]"
                  aria-hidden
                />
              ) : (
                <span className="h-4 w-4 shrink-0" aria-hidden />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** @deprecated Use SettingsOptionPicker — kept for rare custom triggers. */
export function SettingsSelectButton({
  value,
  onClick,
  leading,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onClick: () => void;
  leading?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? value}
      className={cn(
        "no-hover-overlay inline-flex h-9 min-h-9 shrink-0 items-center gap-2 rounded-lg bg-white px-3 text-[14px] text-zinc-900 transition-colors hover:bg-zinc-50",
        settingsFocusReset,
        className,
      )}
    >
      {leading}
      <span>{value}</span>
      <ChevronDown className="h-4 w-4 text-zinc-500" aria-hidden />
    </button>
  );
}

export function SettingsCharacteristicSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <SettingsRow label={label}>
      <SettingsOptionPicker
        value={value}
        options={options}
        onValueChange={onChange}
        aria-label={`${label}, ${value}`}
        className="h-9 min-h-9"
      />
    </SettingsRow>
  );
}

export function SettingsToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  borderless,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  borderless?: boolean;
}) {
  return (
    <SettingsRow
      label={label}
      description={description}
      borderless={borderless}
    >
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </SettingsRow>
  );
}

export function SettingsTextarea({
  value,
  onChange,
  placeholder,
  rows = 2,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      className={cn(
        "w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[14px] leading-5 text-zinc-900 transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400",
        settingsFocusReset,
      )}
    />
  );
}

export function SettingsVoiceControl({
  voice,
  voices,
  onVoiceChange,
  onPlay,
}: {
  voice: string;
  voices: readonly string[];
  onVoiceChange: (voice: string) => void;
  onPlay?: () => void;
}) {
  return (
    <div className="flex items-center gap-0">
      <button
        type="button"
        onClick={onPlay}
        className={cn(
          "no-hover-overlay inline-flex h-9 items-center gap-1.5 rounded-l-lg border border-r-0 border-zinc-200 bg-white px-3 text-[14px] text-zinc-900 transition-colors hover:bg-zinc-100",
          settingsFocusReset,
        )}
      >
        <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
        Play
      </button>
      <SettingsOptionPicker
        value={voice}
        options={voices}
        onValueChange={onVoiceChange}
        aria-label={`Voice, ${voice}`}
        className="h-9 min-h-9 rounded-l-none rounded-r-lg border border-zinc-200"
        align="end"
      />
    </div>
  );
}

export function cycleOption<T extends string>(
  current: T,
  options: readonly T[],
): T {
  const index = options.indexOf(current);
  return index === -1 ? options[0]! : options[(index + 1) % options.length]!;
}

export function SettingsPillButton({
  children,
  onClick,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger" | "ghost";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "no-hover-overlay inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-5 text-[14px] font-medium transition-colors",
        variant === "default" &&
          "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100",
        variant === "danger" &&
          "border-[#e02e2a] bg-transparent text-[#e02e2a] hover:bg-[#e02e2a]/5",
        variant === "ghost" &&
          "border-transparent bg-transparent px-3 text-zinc-600 hover:bg-zinc-100",
        settingsFocusReset,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SettingsChevronRow({
  label,
  value,
  onClick,
  options,
  onValueChange,
  borderless,
}: {
  label: React.ReactNode;
  value?: string;
  onClick?: () => void;
  options?: readonly string[];
  onValueChange?: (value: string) => void;
  borderless?: boolean;
}) {
  if (options?.length && value !== undefined && onValueChange) {
    return (
      <SettingsRow label={label} borderless={borderless}>
        <SettingsOptionPicker
          value={value}
          options={options}
          onValueChange={onValueChange}
          align="end"
        />
      </SettingsRow>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "no-hover-overlay flex w-full min-h-[60px] items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-zinc-100/60",
        settingsFocusReset,
        !borderless && "border-b border-zinc-100",
      )}
    >
      <span className="text-[14px] font-[430] text-zinc-900">{label}</span>
      <span className="flex shrink-0 items-center gap-1 text-[14px] text-zinc-500">
        {value ? <span>{value}</span> : null}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </button>
  );
}

export function SettingsManageRow({
  label,
  onManage,
  borderless,
}: {
  label: string;
  onManage?: () => void;
  borderless?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[60px] items-center justify-between gap-4 py-3",
        !borderless && "border-b border-zinc-100",
      )}
    >
      <span className="text-[14px] font-[430] text-zinc-900">{label}</span>
      <SettingsPillButton
        onClick={onManage}
        className="h-9 min-h-9 px-4 text-[14px]"
      >
        Manage
      </SettingsPillButton>
    </div>
  );
}

export function SettingsStatusBadge({
  children,
  tone = "success",
}: {
  children: React.ReactNode;
  tone?: "success" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[14px] font-medium",
        tone === "success" && "bg-emerald-50 text-emerald-700",
        tone === "info" && "bg-blue-50 text-blue-700",
      )}
    >
      {children}
    </span>
  );
}

export function SettingsProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] font-semibold text-zinc-900">{label}</p>
      <div
        className="relative h-3 overflow-hidden rounded-full border border-zinc-100 bg-zinc-200"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-zinc-900"
          style={{ width: `${Math.max(pct, 0.5)}%` }}
        />
      </div>
    </div>
  );
}

export function SettingsFieldBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-zinc-200 py-3 last:border-b-0">
      <p className="text-[14px] text-zinc-900">{label}</p>
      <p className="mt-1 whitespace-pre-line text-[14px] text-zinc-400">
        {value || "—"}
      </p>
    </div>
  );
}

export function SettingsIconMenuButton({
  "aria-label": ariaLabel,
}: {
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
    >
      <MoreHorizontal className="h-5 w-5" />
    </button>
  );
}
