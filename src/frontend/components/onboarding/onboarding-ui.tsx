"use client";

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
      <h1 className="font-serif text-[28px] font-medium leading-[1.3] tracking-tight md:text-[38px] md:leading-[1.2]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm font-medium leading-snug text-zinc-700 md:text-base">
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
        "w-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(24,24,27,0.04)] md:p-6",
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
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 w-full items-center justify-center rounded-lg px-5 text-sm font-medium text-zinc-700 transition-colors",
        "hover:bg-zinc-100",
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
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer gap-3 text-left text-sm leading-snug text-zinc-700">
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border border-zinc-300 bg-white transition-colors",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-[#2977d6]/40",
            checked && "border-zinc-900 bg-zinc-900",
          )}
        >
          {checked ? (
            <svg
              width="10"
              height="10"
              viewBox="0 0 256 256"
              fill="currentColor"
              className="text-white"
              aria-hidden
            >
              <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
            </svg>
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
        "h-auto w-full rounded-2xl border border-zinc-300 bg-white px-3 py-4 text-center text-sm font-medium text-zinc-900 shadow-[0_4px_20px_rgba(0,0,0,0.04)] outline-none",
        "placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-[#2977d6]/30",
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
