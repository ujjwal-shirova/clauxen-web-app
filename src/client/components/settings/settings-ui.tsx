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
import { chrome } from "@/lib/app-chrome";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SettingsSection({
  title,
  description,
  children,
  className,
  card = true,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Wrap children in a settings card. Default true. */
  card?: boolean;
}) {
  return (
    <section className={cn("mb-7 flex flex-col gap-2.5 last:mb-0", className)}>
      {title || description ? (
        <div className="px-0.5">
          {title ? <h3 className="settings-section-label">{title}</h3> : null}
          {description ? (
            <p className="settings-muted mt-1 max-w-[640px] text-pretty">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {card ? <div className="settings-card">{children}</div> : children}
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
    <div className="mb-5 grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_auto] sm:gap-4">
      <h2 className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-[var(--settings-fg)]">
        {title}
      </h2>
      <a
        href={helpHref}
        className="mt-0.5 inline-flex items-center gap-1 text-[var(--settings-fg-muted)] transition-colors hover:text-[var(--settings-fg)]"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="sr-only">{helpLabel}</span>
        <Info className="icon-md shrink-0" aria-hidden />
      </a>
    </div>
  );
}

const settingsRowBase =
  "relative flex flex-col items-stretch gap-3 px-[var(--settings-row-pad-x)] py-[var(--settings-row-pad-y)] sm:flex-row sm:items-center sm:gap-[var(--settings-row-gap)]";

const settingsRowHairline =
  "before:pointer-events-none before:absolute before:left-[var(--settings-row-pad-x)] before:right-[var(--settings-row-pad-x)] before:top-0 before:h-px before:bg-[var(--settings-hairline)] before:content-[''] first:before:hidden";

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
        settingsRowBase,
        "!flex-row !items-center",
        !borderless && settingsRowHairline,
      )}
    >
      <span className="min-w-0 flex-1 text-[14px] font-medium leading-5 text-[var(--settings-fg)]">
        {label}
      </span>
      <span className="settings-muted min-w-0 flex-1 truncate sm:text-right">
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
      className={cn("settings-btn no-hover-overlay", className)}
    >
      <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
    <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
      <h3 className="settings-section-label">{children}</h3>
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
        settingsRowBase,
        !borderless && settingsRowHairline,
        className,
      )}
      role="group"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium leading-5 text-[var(--settings-fg)]">
          {label}
        </div>
        {description ? (
          <div className="settings-muted mt-0.5 text-pretty">{description}</div>
        ) : null}
      </div>
      <div className="flex w-full min-w-0 justify-start sm:w-auto sm:shrink-0 sm:flex-1 sm:justify-end [&_button]:max-w-full sm:[&_button]:max-w-none">
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

const settingsOptionMenuContentClass = cn(
  chrome.overlay.panel,
  "settings-theme z-[220] min-w-[15rem] max-w-[22rem] rounded-xl border border-[var(--settings-modal-border)] bg-[var(--settings-elevated-bg)] p-1.5 text-[var(--settings-fg)] shadow-[var(--settings-modal-shadow)]",
);

const settingsOptionTriggerClass = cn(
  "no-hover-overlay settings-btn inline-flex h-[var(--settings-control-height)] min-h-[var(--settings-control-height)] w-full shrink-0 justify-between gap-2 px-3 text-[13px] font-medium leading-[18px] sm:w-auto sm:justify-start",
  "text-[var(--settings-fg)] data-[state=open]:bg-[var(--settings-elevated-bg)] data-[state=open]:shadow-[inset_0_0_0_1px_var(--settings-input-focus),0_0_0_3px_var(--settings-focus-ring)]",
  settingsFocusReset,
);

const settingsOptionMenuItemClass = cn(
  "flex cursor-pointer select-none items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium leading-[18px] text-[var(--settings-fg)] transition-colors hover:bg-[var(--settings-nav-hover-bg)] focus:bg-[var(--settings-nav-hover-bg)] focus:text-[var(--settings-fg)] data-[highlighted]:bg-[var(--settings-nav-hover-bg)] data-[highlighted]:text-[var(--settings-fg)]",
  settingsFocusReset,
);

/** Radio circles in settings panels — Clauxen charcoal, no blue focus ring. */
export const settingsRadioItemClass = cn(
  "no-hover-overlay mt-0.5 h-[18px] w-[18px] border-2 border-[var(--settings-input-border)] text-[var(--settings-fg)]",
  "hover:border-[var(--settings-input-focus)] data-[state=checked]:hover:border-[var(--settings-fg)]",
  "data-[state=checked]:border-[var(--settings-fg)]",
  "focus-visible:ring-4 focus-visible:ring-[var(--settings-focus-ring)]",
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
          <ChevronDown
            className="icon-md shrink-0 text-[var(--settings-fg-muted)]"
            aria-hidden
          />
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
                  <span className="mt-0.5 block text-[12px] leading-4 text-[var(--settings-fg-muted)]">
                    {item.description}
                  </span>
                ) : null}
              </span>
              {isSelected ? (
                <Check
                  className="icon-md mt-0.5 shrink-0 text-[var(--settings-fg)]"
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
        "no-hover-overlay settings-btn inline-flex h-[var(--settings-control-height)] min-h-[var(--settings-control-height)] shrink-0 gap-2 px-2 text-[13px] leading-[18px]",
        settingsFocusReset,
        className,
      )}
    >
      {leading}
      <span>{value}</span>
      <ChevronDown
        className="icon-md text-[var(--settings-fg-muted)]"
        aria-hidden
      />
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
        className="h-[var(--settings-control-height)] min-h-[var(--settings-control-height)]"
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
      className="!flex-row !items-center [&>div:last-child]:!w-auto [&>div:last-child]:!flex-none [&>div:last-child]:!justify-end"
    >
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="settings-switch"
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
        "settings-field min-h-[88px] resize-none py-2.5",
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
          "no-hover-overlay settings-btn inline-flex h-[var(--settings-control-height)] w-full justify-center gap-1.5 sm:w-auto sm:rounded-r-none",
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
        className="h-[var(--settings-control-height)] min-h-[var(--settings-control-height)] sm:rounded-l-none"
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
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "no-hover-overlay settings-btn shrink-0",
        variant === "primary" && "settings-btn--primary",
        variant === "danger" &&
          "text-[var(--settings-danger)] shadow-[inset_0_0_0_1px_rgba(217,45,32,0.35)] hover:bg-[var(--settings-danger-soft)]",
        variant === "ghost" && "settings-btn--muted shadow-none",
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
        "no-hover-overlay",
        settingsRowBase,
        "!flex-row !items-center w-full text-left transition-colors hover:bg-[var(--settings-nav-hover-bg)]",
        settingsFocusReset,
        !borderless && settingsRowHairline,
      )}
    >
      <span className="min-w-0 flex-1 text-[14px] font-medium leading-5 text-[var(--settings-fg)]">
        {label}
      </span>
      <span className="settings-muted flex shrink-0 items-center gap-1">
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
        settingsRowBase,
        "!flex-row !items-center",
        !borderless && settingsRowHairline,
      )}
    >
      <span className="min-w-0 flex-1 text-[14px] font-medium leading-5 text-[var(--settings-fg)]">
        {label}
      </span>
      <SettingsPillButton onClick={onManage}>Manage</SettingsPillButton>
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
        "inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold leading-4",
        tone === "success" &&
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "info" && "bg-blue-500/10 text-blue-700 dark:text-blue-300",
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
        className="relative h-2 overflow-hidden rounded-full bg-[var(--settings-switch-track)]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--settings-fg)]"
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
    <div className="border-b border-[var(--settings-hairline)] py-3 last:border-b-0">
      <p className="app-page-body">{label}</p>
      <p className="app-page-muted mt-1 whitespace-pre-line">{value || "—"}</p>
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
      className="rounded-lg p-1.5 text-[var(--settings-fg-subtle)] transition-colors hover:bg-[var(--settings-nav-hover-bg)] hover:text-[var(--settings-fg)]"
    >
      <MoreHorizontal className="icon-lg" />
    </button>
  );
}
