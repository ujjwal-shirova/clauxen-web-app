"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "bootstrap-icons/font/bootstrap-icons.css";
import { cn } from "@/lib/utils";
import {
  PHONE_COUNTRIES,
  flagEmoji,
  findCountryByIso,
  looksLikeEmail,
  looksLikePhone,
  toE164,
  type PhoneCountry,
} from "@/lib/phone-countries";

/** Auth UI tokens — match app shell (`--app-shell-bg` / `--app-panel-bg`). */
export const authPageStyles = {
  shellBg: "var(--app-shell-bg)",
  panelBg: "var(--app-panel-bg)",
  ink: "#18181b",
  muted: "#71717a",
  outlinedBtn:
    "auth-oauth-btn relative inline-flex h-[46px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-4 text-[14px] font-medium tracking-[-0.01em] text-[var(--ui-fg)] shadow-sm transition-all duration-150 ease-out hover:bg-[var(--ui-hover-wash)] hover:border-[var(--ui-border-strong)] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60 cursor-pointer select-none",
  iconBtn:
    "relative inline-flex h-[46px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-3 text-[14px] font-medium tracking-[-0.01em] text-[var(--ui-fg)] shadow-sm transition-all duration-150 ease-out hover:bg-[var(--ui-hover-wash)] hover:border-[var(--ui-border-strong)] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60 cursor-pointer select-none",
  primaryBtn:
    "relative flex h-[46px] w-full items-center justify-center rounded-xl bg-[#18181b] px-5 text-[14px] font-medium tracking-[-0.01em] text-white shadow-sm transition-all duration-150 ease-out hover:bg-[#27272a] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-70 dark:bg-[#f4f4f5] dark:text-[#18181b] dark:hover:bg-[#e4e4e7] cursor-pointer select-none",
  input:
    "h-[46px] w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-3.5 text-[14px] font-medium text-[var(--ui-fg)] shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-[var(--ui-fg-placeholder)] focus-visible:border-[var(--ui-field-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]",
  /** Clickable label — no button hover wash; see `.auth-text-link` in globals.css */
  textLink: "auth-text-link text-[13px]",
};

export {
  getSafeRedirectTo,
  redirectTargetWithHash,
} from "@/lib/auth-redirect";

export type OAuthProvider =
  | "google"
  | "github"
  | "x"
  | "apple"
  | "gitlab";

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0 fill-current", className)}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

export function GitlabIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M23.6 9.89l-.92-2.84a1.08 1.08 0 00-2.06-.01l-1.92 5.89H5.3l-1.92-5.89a1.08 1.08 0 00-2.06.01L.4 9.89a1.08 1.08 0 00.39 1.21l11.21 8.15 11.21-8.15c.39-.28.54-.78.39-1.21z"
        fill="#E24329"
      />
      <path
        d="M12 19.25l-4.7-14.47a1.08 1.08 0 00-2.06.01L.4 9.89a1.08 1.08 0 00.39 1.21L12 19.25z"
        fill="#FC6D26"
      />
      <path
        d="M12 19.25l4.7-14.47a1.08 1.08 0 012.06.01l4.84 5.1a1.08 1.08 0 01-.39 1.21L12 19.25z"
        fill="#FC6D26"
      />
      <path
        d="M12 19.25L7.3 4.78a1.08 1.08 0 012.06-.01L12 8.78l2.64-4.01a1.08 1.08 0 012.06.01L12 19.25z"
        fill="#FCA326"
      />
    </svg>
  );
}

export function ProviderMark({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[18px] leading-none"
      aria-hidden="true"
    >
      <i
        className={cn(
          "bi inline-flex items-center justify-center leading-none",
          icon,
          className,
        )}
      />
    </span>
  );
}

export function AuthSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 animate-spin shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

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
  const pending = (id: OAuthProvider | "sso") => pendingProvider === id;

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        disabled={disabled}
        aria-busy={pending("google") || undefined}
        onClick={() => onOAuth("google")}
        className={cn(
          authPageStyles.outlinedBtn,
          pending("google") && "opacity-80 cursor-wait",
        )}
      >
        {pending("google") ? (
          <AuthSpinner className="text-[var(--ui-fg)]" />
        ) : (
          <GoogleIcon />
        )}
        <span>{pending("google") ? "Connecting to Google…" : "Continue with Google"}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        aria-busy={pending("github") || undefined}
        onClick={() => onOAuth("github")}
        className={cn(
          authPageStyles.outlinedBtn,
          pending("github") && "opacity-80 cursor-wait",
        )}
      >
        {pending("github") ? (
          <AuthSpinner className="text-[var(--ui-fg)]" />
        ) : (
          <GithubIcon />
        )}
        <span>{pending("github") ? "Connecting to GitHub…" : "Continue with GitHub"}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        aria-busy={pending("gitlab") || undefined}
        onClick={() => onOAuth("gitlab")}
        className={cn(
          authPageStyles.outlinedBtn,
          pending("gitlab") && "opacity-80 cursor-wait",
        )}
      >
        {pending("gitlab") ? (
          <AuthSpinner className="text-[#FC6D26]" />
        ) : (
          <GitlabIcon />
        )}
        <span>{pending("gitlab") ? "Connecting to GitLab…" : "Continue with GitLab"}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        aria-busy={pending("sso") || undefined}
        onClick={onSso}
        className={cn(
          authPageStyles.outlinedBtn,
          pending("sso") && "opacity-80 cursor-wait",
        )}
      >
        {pending("sso") ? (
          <AuthSpinner className="text-[var(--ui-fg-muted)]" />
        ) : (
          <ProviderMark
            icon="bi-building"
            className="text-[16px] text-[var(--ui-fg-muted)]"
          />
        )}
        <span>{pending("sso") ? "Checking SSO…" : "Continue with SSO"}</span>
      </button>
    </div>
  );
}

export function CountryCodePicker({
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
          "flex h-[46px] w-full items-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] px-2.5 transition-colors focus-within:border-[var(--ui-field-focus-border)] focus-within:ring-2 focus-within:ring-[var(--brand-ring)]",
          phoneMode && "pl-2",
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
          className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-[14px] font-medium text-[var(--ui-fg)] outline-none placeholder:text-[var(--ui-fg-placeholder)]"
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
        <div
          role="alert"
          className={cn(
            "rounded-[10px] border px-3.5 py-3 text-left text-sm font-medium leading-snug",
            error.toLowerCase().includes("temporary accounts are not allowed")
              ? "border-red-300 bg-red-50 text-red-700 shadow-[0_0_0_1px_rgba(220,38,38,0.08)]"
              : "border-red-200 bg-red-50/80 text-red-600",
          )}
        >
          {error}
        </div>
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
          <span className="inline-flex items-center gap-2">
            <AuthSpinner className="text-white dark:text-zinc-900" />
            <span>Please wait…</span>
          </span>
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
  if (
    lower.includes("temporary accounts are not allowed") ||
    lower.includes("disposable") ||
    lower.includes("temporrary accounts")
  ) {
    return "Temporary accounts are not allowed. Use a legitimate email address — disposable or temporary inboxes cannot create or sign in to Clauxen.";
  }
  if (
    lower.includes("provider is not enabled") ||
    lower.includes("unsupported provider") ||
    (lower.includes("validation_failed") && lower.includes("provider"))
  ) {
    return "That sign-in provider is not enabled yet. Try Google or GitHub, or contact support.";
  }
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
          <div className="h-11 w-full rounded-[10px] shimmer-bg" />
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
