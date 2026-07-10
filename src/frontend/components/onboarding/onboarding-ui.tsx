"use client";

import { Check } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { appBtn } from "@/frontend/lib/app-buttons";
import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function OnboardingHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mx-auto max-w-md text-center">
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-zinc-900 md:text-[32px]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm leading-snug text-zinc-500 md:text-[15px]">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

export function OnboardingCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(24,24,27,0.04)] md:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function OnboardingPrimaryButton({
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(appBtn.primaryLg, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function OnboardingGhostButton({
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex h-11 w-full items-center justify-center rounded-lg px-5 text-sm font-medium text-zinc-600 transition-colors",
        "hover:bg-zinc-100 hover:text-zinc-900",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-zinc-600",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function OnboardingCheckboxRow({
  checked,
  onCheckedChange,
  children,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 text-left text-sm leading-snug text-zinc-700",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <span
          className={cn(
            "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2 border-zinc-300 bg-white transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900/20",
            checked && "border-[#0d0d0d] bg-[#0d0d0d]",
          )}
          aria-hidden
        >
          {checked ? (
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          ) : null}
        </span>
      </span>
      <span className="font-medium leading-[1.4] [&_a]:underline [&_a]:decoration-zinc-400/40 [&_a]:underline-offset-[3px]">
        {children}
      </span>
    </label>
  );
}

export function OnboardingTextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-auto w-full rounded-2xl border border-zinc-200 bg-white px-3 py-4 text-center text-sm font-medium text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.04)] outline-none",
        "placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/15",
        className,
      )}
      {...props}
    />
  );
}

export function OnboardingLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "underline decoration-zinc-400/40 underline-offset-[3px] hover:text-zinc-900",
        className,
      )}
    >
      {children}
    </a>
  );
}
