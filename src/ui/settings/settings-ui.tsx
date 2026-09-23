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

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { chrome } from "@/lib/app-chrome";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ------------------------------------------------------------------ */
/* Page + section shell                                                 */
/* ------------------------------------------------------------------ */

export function SettingsPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 text-[var(--settings-fg)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  children,
  className,
  card = true,
  action,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Wrap children in a settings card. Default true. */
  card?: boolean;
  /** Trailing control beside the title (e.g. Manage, Add). */
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      {title || description || action ? (
        <div className="flex items-end justify-between gap-4 px-1">
          <div className="min-w-0">
            {title ? (
              <h3 className="settings-section-label">{title}</h3>
            ) : null}
            {description ? (
              <p className="mt-0.5 max-w-[600px] text-pretty text-[12.5px] leading-[18px] text-[var(--settings-fg-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
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
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-[var(--settings-fg)]">
        {title}
      </h2>
      <a
        href={helpHref}
        className="inline-flex items-center gap-1 text-[var(--settings-fg-muted)] transition-colors hover:text-[var(--settings-fg)]"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="sr-only">{helpLabel}</span>
        <Info className="icon-md shrink-0" aria-hidden />
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rows                                                                 */
/* ------------------------------------------------------------------ */

const settingsRowBase =
  "relative flex min-h-[52px] flex-col items-stretch gap-2.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-5 sm:px-4";

const settingsRowHairline =
  "before:pointer-events-none before:absolute before:left-3.5 before:right-3.5 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,var(--settings-hairline)_var(--edge-line-fade,14%),var(--settings-hairline)_calc(100%-var(--edge-line-fade,14%)),transparent)] before:content-[''] first:before:hidden sm:before:left-4 sm:before:right-4";

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
        <div className="text-[13.5px] font-medium leading-5 text-[var(--settings-fg)]">
          {label}
        </div>
        {description ? (
          <div className="mt-0.5 max-w-[440px] text-pretty text-[12.5px] leading-[18px] text-[var(--settings-fg-muted)]">
            {description}
          </div>
        ) : null}
      </div>
      <div className="flex w-full min-w-0 shrink-0 justify-start sm:w-auto sm:max-w-[19rem] sm:flex-1 sm:justify-end">
        {children}
      </div>
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
        settingsRowBase,
        "!flex-row !items-center",
        !borderless && settingsRowHairline,
      )}
    >
      <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-5 text-[var(--settings-fg)]">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--settings-fg-muted)] sm:text-right">
        {value}
      </span>
    </div>
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
      className="!flex-row !items-center !gap-4 [&>div:last-child]:!w-auto [&>div:last-child]:!flex-none [&>div:last-child]:!justify-end"
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

export function SettingsChevronRow({
  label,
  description,
  leading,
  value,
  onClick,
  options,
  onValueChange,
  borderless,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  leading?: React.ReactNode;
  value?: string;
  onClick?: () => void;
  options?: readonly string[];
  onValueChange?: (value: string) => void;
  borderless?: boolean;
}) {
  if (options?.length && value !== undefined && onValueChange) {
    return (
      <SettingsRow
        label={label}
        description={description}
        borderless={borderless}
      >
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
        "!flex-row w-full text-left transition-colors hover:bg-[var(--settings-nav-hover-bg)]",
        description ? "!items-start" : "!items-center",
        "outline-none focus-visible:outline-none",
        !borderless && settingsRowHairline,
      )}
    >
      {leading ? (
        <span className={cn("shrink-0", description && "mt-0.5")}>
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium leading-5 text-[var(--settings-fg)]">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block max-w-[440px] text-pretty text-[12.5px] leading-[18px] text-[var(--settings-fg-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[12.5px] text-[var(--settings-fg-muted)]">
        {value ? (
          <span className="max-w-[11rem] truncate text-right">{value}</span>
        ) : null}
        <ChevronRight className="size-3.5" aria-hidden />
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
      <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-5 text-[var(--settings-fg)]">
        {label}
      </span>
      <SettingsButton onClick={onManage}>Manage</SettingsButton>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */

type SettingsButtonVariant =
  | "default"
  | "primary"
  | "danger"
  | "dangerSolid"
  | "ghost";

const settingsFocusReset =
  "outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

export function SettingsButton({
  children,
  onClick,
  variant = "default",
  className,
  disabled,
  size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: SettingsButtonVariant;
  className?: string;
  disabled?: boolean;
  size?: "md" | "sm" | "lg";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "no-hover-overlay settings-btn shrink-0",
        size === "sm" && "!h-7 !min-h-[1.75rem] !gap-1.5 !px-2.5 !text-[12.5px]",
        size === "lg" && "!h-9 !min-h-[2.25rem] !px-4 !text-[13.5px]",
        variant === "primary" && "settings-btn--primary",
        variant === "danger" &&
          "text-[var(--settings-danger)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--settings-danger)_35%,transparent)] hover:bg-[var(--settings-danger-soft)]",
        variant === "dangerSolid" && "settings-btn--danger",
        variant === "ghost" && "settings-btn--muted shadow-none",
        settingsFocusReset,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** @deprecated Use SettingsButton. */
export const SettingsPillButton = SettingsButton;

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
    <SettingsButton onClick={onClick} className={className}>
      <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {children}
    </SettingsButton>
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
    <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
      <h3 className="settings-section-label">{children}</h3>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Option picker                                                        */
/* ------------------------------------------------------------------ */

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

const settingsOptionMenuContentClass = cn(
  chrome.overlay.panel,
  "settings-theme z-[220] min-w-[13.5rem] max-w-[20rem] rounded-[var(--popup-radius,12px)] border border-[var(--popup-border,var(--settings-modal-border))] bg-[var(--popup-bg,var(--settings-elevated-bg))] p-[var(--menu-pad,4px)] text-[var(--settings-fg)] shadow-[var(--popup-shadow,var(--settings-modal-shadow))]",
);

const settingsOptionTriggerClass = cn(
  "no-hover-overlay settings-btn inline-flex h-[var(--settings-control-height)] min-h-[var(--settings-control-height)] w-full shrink-0 justify-between gap-2 px-2.5 text-[13px] font-medium leading-[18px] sm:w-auto sm:min-w-[9rem] sm:justify-start",
  "text-[var(--settings-fg)] data-[state=open]:bg-[var(--settings-elevated-bg)] data-[state=open]:shadow-[inset_0_0_0_1px_var(--settings-input-focus),0_0_0_3px_var(--settings-focus-ring)]",
  settingsFocusReset,
);

const settingsOptionMenuItemClass = cn(
  "flex min-h-[var(--menu-row-height,30px)] cursor-pointer select-none items-start gap-2 rounded-[var(--menu-item-radius,7px)] px-2 py-[5px] text-[13px] font-medium leading-[18px] text-[var(--settings-fg)] transition-colors hover:bg-[var(--settings-nav-hover-bg)] focus:bg-[var(--settings-nav-hover-bg)] focus:text-[var(--settings-fg)] data-[highlighted]:bg-[var(--settings-nav-hover-bg)] data-[highlighted]:text-[var(--settings-fg)]",
  settingsFocusReset,
);

/** Radio circles in settings panels — brand accent when checked. */
export const settingsRadioItemClass = cn(
  "no-hover-overlay mt-0.5 h-[18px] w-[18px] border-2 border-[var(--settings-input-border)] text-[hsl(var(--brand))]",
  "hover:border-[var(--settings-input-focus)] data-[state=checked]:hover:border-[hsl(var(--brand))]",
  "data-[state=checked]:border-[hsl(var(--brand))]",
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
              "max-w-full flex-1 truncate text-left sm:max-w-[10rem]",
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
                  <span className="mt-px block text-[11.5px] leading-4 text-[var(--settings-fg-muted)]">
                    {item.description}
                  </span>
                ) : null}
              </span>
              {isSelected ? (
                <Check
                  className="mt-px size-3.5 shrink-0 text-[var(--settings-fg)]"
                  aria-hidden
                />
              ) : (
                <span className="mt-px size-3.5 shrink-0" aria-hidden />
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
        "no-hover-overlay settings-btn inline-flex h-[var(--settings-control-height)] min-h-[var(--settings-control-height)] shrink-0 gap-2 px-2 text-[14px] leading-[20px]",
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

/* ------------------------------------------------------------------ */
/* Fields, badges, tables                                               */
/* ------------------------------------------------------------------ */

export function SettingsField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 flex-1 flex-col gap-1.5", className)}>
      <span className="cx-label px-0.5">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="px-0.5 text-[12px] leading-4 text-[var(--settings-fg-subtle)]">
          {hint}
        </span>
      ) : null}
    </label>
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

export function SettingsStatusBadge({
  children,
  tone = "success",
}: {
  children: React.ReactNode;
  tone?: "success" | "info" | "warning" | "danger" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold leading-4",
        tone === "success" && "app-status-pill--success",
        tone === "info" && "app-status-pill--info",
        tone === "warning" && "app-status-pill--warning",
        tone === "danger" && "app-status-pill--danger",
        tone === "neutral" && "app-status-pill--neutral",
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
      <p className="text-[13.5px] font-medium leading-5 text-[var(--settings-fg)]">
        {label}
      </p>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-[var(--settings-switch-track)]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--brand))]"
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
      <p className="text-[13.5px] font-medium leading-5 text-[var(--settings-fg)]">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-line text-[13px] leading-5 text-[var(--settings-fg-muted)]">
        {value || "—"}
      </p>
    </div>
  );
}

export function SettingsTable({
  head,
  children,
  className,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("settings-card overflow-x-auto", className)}>
      <table className="w-full text-left text-[13px]">
        <thead className="bg-[var(--settings-sidebar-bg)] text-[var(--settings-fg-muted)]">
          {head}
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function SettingsEmpty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="settings-card flex flex-col items-center gap-1 px-6 py-9 text-center">
      <p className="text-[13.5px] font-medium text-[var(--settings-fg)]">
        {title}
      </p>
      {body ? (
        <p className="max-w-[380px] text-[12.5px] leading-[18px] text-[var(--settings-fg-muted)]">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
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

export function SettingsInlineNote({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "danger" | "success";
}) {
  return (
    <p
      className={cn(
        "px-3.5 py-2.5 text-[12.5px] leading-[18px] sm:px-4",
        tone === "muted" && "text-[var(--settings-fg-muted)]",
        tone === "danger" && "text-[var(--settings-danger)]",
        tone === "success" && "text-[hsl(var(--success))]",
      )}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Icon tile, list items, confirm dialog                                */
/* ------------------------------------------------------------------ */

export function SettingsIconTile({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "cx-set-tile",
        tone === "danger" && "cx-set-tile--danger",
        className,
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function SettingsListItem({
  icon,
  title,
  meta,
  badge,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("cx-set-item", className)}>
      {icon ? <SettingsIconTile>{icon}</SettingsIconTile> : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13.5px] font-medium leading-5 text-[var(--settings-fg)]">
            {title}
          </span>
          {badge}
        </div>
        {meta ? (
          <div className="truncate text-[12px] leading-4 text-[var(--settings-fg-muted)]">
            {meta}
          </div>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 items-center gap-1.5">{action}</div>
      ) : null}
    </div>
  );
}

export function SettingsConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  hideCancel = false,
  tone = "default",
  busy = false,
  confirmPhrase,
  children,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  tone?: "default" | "danger";
  busy?: boolean;
  /** Require typing this phrase before the confirm button enables. */
  confirmPhrase?: string;
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
}) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);
  const phraseOk = !confirmPhrase || typed.trim() === confirmPhrase;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-nested-settings-dialog=""
          className="cx-dialog-overlay fixed inset-0 z-[220]"
        />
        <DialogPrimitive.Content
          className="settings-theme cx-dialog fixed left-1/2 top-1/2 z-[221] grid w-[calc(100%-1.5rem)] max-w-[400px] gap-3 p-4 font-sans text-[13px] leading-[18px] text-[var(--settings-fg)] outline-none"
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col gap-1 pr-8">
            <DialogPrimitive.Title className="text-[15px] font-semibold leading-5 tracking-[-0.01em]">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-[12.5px] leading-[18px] text-[var(--settings-fg-muted)]">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {children}
          {confirmPhrase ? (
            <label className="flex flex-col gap-1.5">
              <span className="cx-label">
                Type <span className="font-mono text-[var(--settings-fg)]">{confirmPhrase}</span> to confirm
              </span>
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                className="cx-field"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </label>
          ) : null}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            {hideCancel ? null : (
              <SettingsButton size="sm" onClick={() => onOpenChange(false)}>
                {cancelLabel}
              </SettingsButton>
            )}
            <SettingsButton
              size="sm"
              variant={tone === "danger" ? "dangerSolid" : "primary"}
              disabled={busy || !phraseOk}
              onClick={() => void onConfirm()}
            >
              {busy ? "Working…" : confirmLabel}
            </SettingsButton>
          </div>
          <DialogPrimitive.Close
            className="ui-icon-button no-hover-overlay absolute right-2.5 top-2.5 !size-7"
            aria-label="Close"
          >
            <X className="size-4" strokeWidth={1.75} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
