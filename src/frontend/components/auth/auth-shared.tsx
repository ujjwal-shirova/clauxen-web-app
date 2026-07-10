"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/frontend/lib/utils";
import {
  PHONE_COUNTRIES,
  flagEmoji,
  findCountryByIso,
  looksLikeEmail,
  looksLikePhone,
  toE164,
  type PhoneCountry,
} from "@/frontend/lib/phone-countries";

/** Auth UI tokens — match app shell (`--app-shell-bg` / `--app-panel-bg`). */
export const authPageStyles = {
  shellBg: "var(--app-shell-bg)",
  panelBg: "var(--app-panel-bg)",
  ink: "#18181b",
  muted: "#71717a",
  outlinedBtn:
    "relative inline-flex h-11 w-full items-center justify-center gap-2.5 overflow-hidden rounded-[10px] border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60",
  iconBtn:
    "relative inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-[10px] border border-zinc-200 bg-white px-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60",
  primaryBtn:
    "relative flex h-11 w-full items-center justify-center overflow-hidden rounded-[10px] bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-70",
  input:
    "h-11 w-full rounded-[10px] border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-900/10",
};

export function getSafeRedirectTo(value: string | null): string {
  if (!value) return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export type OAuthProvider =
  | "google"
  | "github"
  | "x"
  | "apple"
  | "gitlab";

function AuthSplash({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/75"
      aria-hidden
    >
      <span className="auth-splash-ring absolute h-8 w-8 rounded-full bg-zinc-900/15" />
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
    </span>
  );
}

const ICON_OAUTH: {
  provider: Exclude<OAuthProvider, "google" | "github">;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}[] = [
  {
    provider: "x",
    label: "Continue with X",
    shortLabel: "X",
    icon: <i className="bi bi-twitter-x text-[16px] leading-none" aria-hidden />,
  },
  {
    provider: "apple",
    label: "Continue with Apple",
    shortLabel: "Apple",
    icon: <i className="bi bi-apple text-[18px] leading-none" aria-hidden />,
  },
  {
    provider: "gitlab",
    label: "Continue with GitLab",
    shortLabel: "GitLab",
    icon: (
      <i
        className="bi bi-gitlab text-[17px] leading-none text-[#FC6D26]"
        aria-hidden
      />
    ),
  },
];

export function AuthOAuthButtons({
  onOAuth,
  onSso,
  disabled,
  pendingProvider,
}: {
  onOAuth: (provider: OAuthProvider) => void;
  onSso?: () => void;
  disabled?: boolean;
  pendingProvider?: OAuthProvider | "sso" | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOAuth("google")}
        className={authPageStyles.outlinedBtn}
      >
        <AuthSplash active={pendingProvider === "google"} />
        <i className="bi bi-google text-[16px] leading-none" aria-hidden />
        Continue with Google
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOAuth("github")}
        className={authPageStyles.outlinedBtn}
      >
        <AuthSplash active={pendingProvider === "github"} />
        <i className="bi bi-github text-[16px] leading-none" aria-hidden />
        Continue with GitHub
      </button>

      {/* @container: show labels when the row is wide enough */}
      <div className="@container w-full">
        <div className="flex w-full items-stretch gap-2.5">
          {ICON_OAUTH.map(({ provider, label, shortLabel, icon }) => (
            <button
              key={provider}
              type="button"
              disabled={disabled}
              onClick={() => onOAuth(provider)}
              className={authPageStyles.iconBtn}
              aria-label={label}
              title={label}
            >
              <AuthSplash active={pendingProvider === provider} />
              {icon}
              <span className="hidden truncate @[280px]:inline">{shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onSso}
        className={authPageStyles.outlinedBtn}
        aria-label="Continue with SSO"
      >
        <AuthSplash active={pendingProvider === "sso"} />
        <i
          className="bi bi-building text-[15px] leading-none text-zinc-600"
          aria-hidden
        />
        Continue with SSO
      </button>
    </div>
  );
}

function CountryCodePicker({
  country,
  onSelect,
}: {
  country: PhoneCountry;
  onSelect: (c: PhoneCountry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        `+${c.dial}`.includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-100"
        aria-label={`Country code +${country.dial}`}
        aria-expanded={open}
      >
        <span className="text-base leading-none" aria-hidden>
          {flagEmoji(country.iso)}
        </span>
        <span>+{country.dial}</span>
        <i className="bi bi-chevron-down text-[10px] text-zinc-500" aria-hidden />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[min(calc(100vw-3rem),280px)] overflow-hidden rounded-[12px] border border-zinc-200 bg-white shadow-[0_12px_40px_-12px_rgba(24,24,27,0.28)]">
          <div className="border-b border-zinc-100 p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm outline-none placeholder:text-zinc-400 focus-visible:border-zinc-300 focus-visible:ring-2 focus-visible:ring-zinc-900/10"
            />
          </div>
          <ul
            className="max-h-56 overflow-y-auto py-1"
            role="listbox"
            aria-label="Country codes"
          >
            {filtered.map((c) => (
              <li key={`${c.iso}-${c.dial}-${c.name}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.iso === country.iso && c.dial === country.dial}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-zinc-50",
                    c.iso === country.iso &&
                      c.dial === country.dial &&
                      "bg-zinc-50",
                  )}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {flagEmoji(c.iso)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-800">
                    {c.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    +{c.dial}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-zinc-500">
                No countries match
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AuthEmailForm({
  email,
  password,
  showPassword,
  useMagicLink,
  onEmailChange,
  onPasswordChange,
  onToggleMagicLink,
  countryIso,
  onCountryChange,
  otpCode,
  onOtpChange,
  awaitingPhoneOtp,
  extraFields,
  error,
  info,
  submitting,
  submitLabel,
  onSubmit,
  onForgotPassword,
}: {
  email: string;
  password: string;
  showPassword: boolean;
  useMagicLink: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onToggleMagicLink: () => void;
  countryIso: string;
  onCountryChange: (iso: string) => void;
  otpCode?: string;
  onOtpChange?: (v: string) => void;
  awaitingPhoneOtp?: boolean;
  extraFields?: React.ReactNode;
  error: string | null;
  info: string | null;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword?: () => void;
}) {
  const phoneMode = looksLikePhone(email);
  const country = findCountryByIso(countryIso);
  const showPasswordField =
    showPassword && !useMagicLink && !phoneMode && !awaitingPhoneOtp;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="auth-email">
        Email or phone
      </label>
      <div
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-[10px] border border-zinc-200 bg-white px-2 transition-colors focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900/10",
          phoneMode && "pl-1.5",
        )}
      >
        {phoneMode ? (
          <CountryCodePicker
            country={country}
            onSelect={(c) => onCountryChange(c.iso)}
          />
        ) : null}
        <input
          id="auth-email"
          type="text"
          inputMode={phoneMode ? "tel" : "email"}
          autoComplete={phoneMode ? "tel-national" : "email"}
          placeholder="Enter your email & phone"
          required={!awaitingPhoneOtp}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400"
        />
      </div>

      {awaitingPhoneOtp ? (
        <>
          <label className="sr-only" htmlFor="auth-otp">
            Verification code
          </label>
          <input
            id="auth-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter verification code"
            required
            value={otpCode ?? ""}
            onChange={(e) => onOtpChange?.(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className={authPageStyles.input}
          />
        </>
      ) : null}

      {extraFields && !phoneMode && !awaitingPhoneOtp ? extraFields : null}

      {showPasswordField ? (
        <>
          <label className="sr-only" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            placeholder="Password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className={authPageStyles.input}
          />
        </>
      ) : null}

      {error ? (
        <p className="text-left text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="text-left text-sm text-emerald-700" role="status">
          {info}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={cn(authPageStyles.primaryBtn, submitting && "opacity-90")}
      >
        {submitting ? (
          <>
            <span
              className="auth-splash-ring absolute h-10 w-10 rounded-full bg-white/20"
              aria-hidden
            />
            <span className="relative z-10">Please wait…</span>
          </>
        ) : (
          submitLabel
        )}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        {!phoneMode && !awaitingPhoneOtp ? (
          <button
            type="button"
            onClick={onToggleMagicLink}
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700"
          >
            {useMagicLink ? "Use password instead" : "Email me a magic link"}
          </button>
        ) : (
          <span />
        )}
        {!useMagicLink && !phoneMode && !awaitingPhoneOtp && onForgotPassword ? (
          <button
            type="button"
            onClick={onForgotPassword}
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700"
          >
            Forgot password?
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function resolveAuthIdentifier(
  value: string,
  countryIso: string,
): { kind: "email" | "phone"; value: string } | { kind: "invalid"; message: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { kind: "invalid", message: "Enter your email or phone number." };
  }
  if (looksLikeEmail(trimmed)) {
    return { kind: "email", value: trimmed };
  }
  if (looksLikePhone(trimmed)) {
    const country = findCountryByIso(countryIso);
    const e164 = toE164(country.dial, trimmed);
    if (e164.replace(/\D/g, "").length < 8) {
      return { kind: "invalid", message: "Enter a valid phone number." };
    }
    return { kind: "phone", value: e164 };
  }
  return {
    kind: "invalid",
    message: "Enter a valid email address or phone number.",
  };
}

export function mapSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please verify your email before signing in.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (lower.includes("phone") && lower.includes("not")) {
    return "Phone sign-in is not available yet. Try email, or contact support.";
  }
  if (lower.includes("otp") || lower.includes("token")) {
    return "Invalid or expired verification code. Try again.";
  }
  return message;
}

/** Full-bleed panel shimmer — no floating empty shell. */
export function AuthLoadingShell() {
  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[var(--app-shell-bg)] p-1.5 font-sans sm:p-2">
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[16px] border border-zinc-200/80 bg-[var(--app-panel-bg)] sm:rounded-[18px]">
        <div className="flex shrink-0 items-center gap-4 px-5 py-4 sm:px-6">
          <div className="h-6 w-6 rounded-md shimmer-bg" />
          <div className="h-3 w-16 rounded-full shimmer-bg" />
          <div className="h-3 w-14 rounded-full shimmer-bg" />
          <div className="h-3 w-20 rounded-full shimmer-bg" />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-3 px-5 pb-10 sm:px-8">
          <div className="mb-4 h-8 w-56 rounded-lg shimmer-bg" />
          <div className="h-11 w-full rounded-[10px] shimmer-bg" />
          <div className="h-11 w-full rounded-[10px] shimmer-bg" />
          <div className="flex gap-2.5">
            <div className="h-11 flex-1 rounded-[10px] shimmer-bg" />
            <div className="h-11 flex-1 rounded-[10px] shimmer-bg" />
            <div className="h-11 flex-1 rounded-[10px] shimmer-bg" />
          </div>
          <div className="h-11 w-full rounded-[10px] shimmer-bg" />
          <div className="my-2 h-px w-full bg-zinc-100" />
          <div className="h-11 w-full rounded-[10px] shimmer-bg" />
          <div className="h-11 w-full rounded-[10px] shimmer-bg" />
          <div className="h-11 w-full rounded-[10px] shimmer-bg" />
        </div>
      </div>
    </div>
  );
}
