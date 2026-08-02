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

import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SettingsSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-6 last:mb-0 sm:mb-8", className)}>
      {title ? (
        <div className="mb-3">
          <h3 className="app-page-section-title">{title}</h3>
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SettingsPanelTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return <h2 className="sr-only">{children}</h2>;
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
    <div className="mb-3 grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_auto] sm:gap-4">
      <h2 className="app-page-section-title">{title}</h2>
      <a
        href={helpHref}
        className="mt-0.5 inline-flex items-center gap-1 text-zinc-400 transition-colors hover:text-zinc-900"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="sr-only">{helpLabel}</span>
        <Info className="icon-md shrink-0" aria-hidden />
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
        "flex flex-col items-stretch gap-2.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        !borderless && "border-b border-[var(--ui-border-subtle)]",
      )}
    >
      <span className="app-page-body font-medium">{label}</span>
      <span className="app-page-muted sm:max-w-[65%] sm:truncate sm:text-right">
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
        "app-btn app-btn-secondary app-btn-sm no-hover-overlay inline-flex gap-1.5",
        className,
      )}
    >
      <UserPlus className="icon-md shrink-0" aria-hidden />
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
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="app-page-section-title">{children}</h3>
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
        "flex flex-col items-stretch gap-2.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        !borderless && "border-b border-[var(--ui-border-subtle)]",
        className,
      )}
      role="group"
    >
      <div className="min-w-0 flex-1">
        <div className="app-page-body">{label}</div>
        {description ? (
          <div className="app-page-muted mt-1 text-pretty">{description}</div>
        ) : null}
      </div>
      <div className="w-full min-w-0 sm:w-auto sm:shrink-0 [&_button]:max-w-full sm:[&_button]:max-w-none">
        {children}
      </div>
    </div>
  );
}

export type SettingsOptionItem = {
  value: string;
  label?: string;
  description?: string;
  leading?: React.ReactNode;
  /** Optional style for the option label (e.g. chat font preview). */
  labelStyle?: React.CSSProperties;
  labelClassName?: string;
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
  "app-overlay-panel z-[120] min-w-[14rem] max-w-[20rem] rounded-[var(--radius-md)] p-1 text-zinc-900 dark:text-zinc-100";

const settingsOptionTriggerClass = cn(
  "no-hover-overlay inline-flex h-8 min-h-8 w-full shrink-0 items-center justify-between gap-1.5 rounded-[var(--radius-sm)] bg-white/80 px-2.5 text-[13px] leading-[18px] text-zinc-900 shadow-[inset_0_0_0_1px_var(--ui-border)] transition-[box-shadow,background-color] duration-75 hover:bg-white sm:w-auto sm:justify-start sm:px-2 data-[state=open]:bg-white data-[state=open]:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)] dark:bg-zinc-900/80 dark:text-zinc-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:hover:bg-zinc-900 dark:data-[state=open]:bg-zinc-900",
  settingsFocusReset,
);

const settingsOptionMenuItemClass = cn(
  "flex cursor-pointer select-none items-start gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-[13px] font-medium leading-[18px] text-zinc-900 transition-colors hover:bg-[var(--ui-hover-wash)] focus:bg-[var(--ui-hover-wash)] focus:text-zinc-900 data-[highlighted]:bg-[var(--ui-hover-wash)] data-[highlighted]:text-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800 dark:data-[highlighted]:bg-zinc-800",
  settingsFocusReset,
);

/** Radio circles in settings panels — Clauxen charcoal, no blue focus ring. */
export const settingsRadioItemClass = cn(
  "no-hover-overlay mt-0.5 border-2 border-zinc-300 text-[#0d0d0d]",
  "hover:border-zinc-400 data-[state=checked]:hover:border-[#0d0d0d]",
  "data-[state=checked]:border-[#0d0d0d]",
  "focus-visible:ring-2 focus-visible:ring-[#0d0d0d]/20",
  settingsFocusReset,
);

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
  const hasDescriptions = items.some((item) => Boolean(item.description));

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
          <span
            className={cn(
              "max-w-full truncate text-left sm:max-w-[10rem]",
              selected.labelClassName,
            )}
            style={selected.labelStyle}
          >
            {selected.label ?? selected.value}
          </span>
          <ChevronDown className="icon-md shrink-0 text-zinc-500" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          settingsOptionMenuContentClass,
          hasDescriptions && "min-w-[16.5rem]",
        )}
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
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block font-medium leading-5",
                    item.labelClassName,
                  )}
                  style={item.labelStyle}
                >
                  {item.label ?? item.value}
                </span>
                {item.description ? (
                  <span className="mt-0.5 block text-[12px] leading-4 text-zinc-500">
                    {item.description}
                  </span>
                ) : null}
              </span>
              {isSelected ? (
                <Check
                  className="icon-md mt-0.5 shrink-0 text-zinc-900"
                  aria-hidden
                />
              ) : (
                <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
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
        "no-hover-overlay inline-flex h-8 min-h-8 shrink-0 items-center gap-2 rounded-[var(--radius-sm)] bg-white px-2.5 text-[13px] leading-[18px] text-zinc-900 transition-colors hover:bg-zinc-50",
        settingsFocusReset,
        className,
      )}
    >
      {leading}
      <span>{value}</span>
      <ChevronDown className="icon-md text-zinc-500" aria-hidden />
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
        className="h-8 min-h-8"
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
  disabled,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  borderless?: boolean;
  disabled?: boolean;
}) {
  return (
    <SettingsRow
      label={label}
      description={description}
      borderless={borderless}
    >
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
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
        "w-full resize-none rounded-[var(--radius-sm)] bg-white/80 px-3 py-2 text-[13px] leading-[18px] text-zinc-900 shadow-[inset_0_0_0_1px_var(--ui-border)] transition-[box-shadow,background-color] duration-75 placeholder:text-zinc-400 focus:bg-white focus:shadow-[inset_0_0_0_1px_rgba(11,11,11,0.18)]",
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
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-0">
      <button
        type="button"
        onClick={onPlay}
        className={cn(
          "no-hover-overlay inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--ui-border)] bg-white px-3 text-[13px] leading-[18px] text-zinc-900 transition-colors hover:bg-zinc-100 sm:w-auto sm:rounded-l-md sm:rounded-r-none sm:border-r-0",
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
        className="h-8 min-h-8 rounded-[var(--radius-sm)] border border-[var(--ui-border)] sm:rounded-l-none sm:rounded-r-md"
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
        "no-hover-overlay inline-flex h-8 shrink-0 items-center justify-center rounded-full border px-4 text-[13px] font-medium leading-[18px] transition-colors",
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
        "no-hover-overlay flex w-full items-center justify-between gap-7 py-3 text-left transition-colors hover:bg-[rgba(11,11,11,0.03)]",
        settingsFocusReset,
        !borderless && "border-b border-[rgba(11,11,11,0.05)]",
      )}
    >
      <span className="app-page-body font-medium">{label}</span>
      <span className="app-page-muted flex shrink-0 items-center gap-1">
        {value ? <span>{value}</span> : null}
        <ChevronRight className="icon-md" aria-hidden />
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
        "flex flex-col items-stretch gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-7",
        !borderless && "border-b border-[rgba(11,11,11,0.05)]",
      )}
    >
      <span className="app-page-body font-medium">{label}</span>
      <SettingsPillButton
        onClick={onManage}
        className="h-8 min-h-8 px-3 text-[13px]"
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
        "inline-flex rounded-md px-2 py-0.5 text-[13px] font-medium leading-[18px]",
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
      <p className="app-page-body font-semibold">{label}</p>
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
      <p className="app-page-body">{label}</p>
      <p className="app-page-muted mt-1 whitespace-pre-line">
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
      <MoreHorizontal className="icon-lg" />
    </button>
  );
}
