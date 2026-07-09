"use client";

import { cn } from "@/frontend/lib/utils";

export const authPageStyles = {
  pageBg: "#faf9f5",
  ink: "#141413",
  muted: "#3d3d3a",
  outlinedBtn:
    "inline-flex h-11 w-full items-center justify-center gap-2 rounded-[9.6px] border-[0.5px] border-[rgba(31,30,29,0.3)] bg-transparent px-5 text-sm font-medium text-[#141413] transition-colors hover:bg-black/[0.03] disabled:opacity-60",
  primaryBtn:
    "flex h-11 w-full items-center justify-center rounded-[9.6px] bg-[#141413] px-5 text-sm font-medium text-white transition-colors hover:bg-[#272625] disabled:opacity-70",
  input:
    "h-11 w-full rounded-[9.6px] border border-[rgba(31,30,29,0.15)] bg-white px-3 text-sm font-medium outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-[rgba(31,30,29,0.35)] focus-visible:ring-2 focus-visible:ring-[rgba(44,132,219,0.15)]",
};

export function getSafeRedirectTo(value: string | null): string {
  if (!value) return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M14.5 8.2c0-.5-.1-1-.2-1.4H8v2.7h3.7c-.2 1-1 2.3-2.1 3v1.8h3.4c2-1.8 3.1-4.5 3.1-7.1z" fill="#4285F4" />
      <path d="M8 15c2.7 0 5-0.9 6.6-2.4l-3.4-1.8c-.9.6-2.1 1-3.2 1-2.5 0-4.6-1.7-5.3-4H.5v1.9C2.1 13.1 4.9 15 8 15z" fill="#34A853" />
      <path d="M2.7 9.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V4.3H.5C-.2 5.7-.5 7.3-.5 9s.3 3.3 1 4.7l2.2-1.9z" fill="#FBBC05" />
      <path d="M8 3.6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C13 1.1 10.7 0 8 0 4.9 0 2.1 1.9.5 4.3l2.2 1.9C3.4 5.3 5.5 3.6 8 3.6z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.18.82.63-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.51-1.04 2.18-.82 2.18-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#1877F2" aria-hidden>
      <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M9.52 6.77 15.36 0h-1.38L8.9 5.88 4.97 0H0l6.11 8.9L0 16h1.38l5.25-6.12L10.53 16H15.5L9.52 6.77ZM7.58 8.88 7.2 8.3 2.03 1.04h2.26l4.18 6.1.38.55 4.54 6.57H12.9L7.58 8.88Z" />
    </svg>
  );
}

type OAuthProvider = "google" | "github" | "facebook" | "twitter";

const OAUTH_BUTTONS: Array<{
  provider: OAuthProvider;
  label: string;
  icon: React.ReactNode;
}> = [
  { provider: "google", label: "Continue with Google", icon: <GoogleIcon /> },
  { provider: "github", label: "Continue with GitHub", icon: <GitHubIcon /> },
  { provider: "facebook", label: "Continue with Facebook", icon: <FacebookIcon /> },
  { provider: "twitter", label: "Continue with X", icon: <XIcon /> },
];

export function AuthOAuthButtons({
  onOAuth,
  disabled,
}: {
  onOAuth: (provider: OAuthProvider) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {OAUTH_BUTTONS.map(({ provider, label, icon }) => (
        <button
          key={provider}
          type="button"
          disabled={disabled}
          onClick={() => onOAuth(provider)}
          className={authPageStyles.outlinedBtn}
        >
          {icon}
          {label}
        </button>
      ))}
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
  extraFields,
  error,
  info,
  submitting,
  submitLabel,
  onSubmit,
  forgotPasswordHref,
}: {
  email: string;
  password: string;
  showPassword: boolean;
  useMagicLink: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onToggleMagicLink: () => void;
  extraFields?: React.ReactNode;
  error: string | null;
  info: string | null;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (e: React.FormEvent) => void;
  forgotPasswordHref?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="sr-only" htmlFor="auth-email">
        Email
      </label>
      <input
        id="auth-email"
        type="email"
        placeholder="Enter your email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        className={authPageStyles.input}
        style={{ color: authPageStyles.ink }}
      />

      {extraFields}

      {showPassword && !useMagicLink ? (
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
            style={{ color: authPageStyles.ink }}
          />
        </>
      ) : null}

      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
      {info ? <p className="text-sm text-emerald-700" role="status">{info}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className={cn(authPageStyles.primaryBtn, submitting && "opacity-70")}
      >
        {submitting ? "Please wait…" : submitLabel}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <button
          type="button"
          onClick={onToggleMagicLink}
          className="underline decoration-zinc-400"
        >
          {useMagicLink ? "Use password instead" : "Email me a magic link"}
        </button>
        {forgotPasswordHref && !useMagicLink ? (
          <a href={forgotPasswordHref} className="underline decoration-zinc-400">
            Forgot password?
          </a>
        ) : null}
      </div>
    </form>
  );
}

export function mapSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please verify your email before signing in.";
  }
  if (lower.includes("rate limit")) {
    return "Too many attempts. Please wait and try again.";
  }
  return message;
}
