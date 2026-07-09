"use client";

import { cn } from "@/frontend/lib/utils";

/** Auth UI tokens — match app shell (`--app-shell-bg` / `--app-panel-bg`). */
export const authPageStyles = {
  shellBg: "var(--app-shell-bg)",
  panelBg: "var(--app-panel-bg)",
  ink: "#18181b",
  muted: "#71717a",
  outlinedBtn:
    "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60",
  iconBtn:
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60",
  primaryBtn:
    "flex h-11 w-full items-center justify-center rounded-[10px] bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-70",
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
  | "facebook"
  | "twitter"
  | "apple"
  | "gitlab"
  | "figma"
  | "notion"
  | "azure";

/** Brand marks Bootstrap Icons lacks (Figma / Notion). */
function FigmaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M8 24c2.2 0 4-1.8 4-4v-4H8c-2.2 0-4 1.8-4 4s1.8 4 4 4Zm4-12H8c-2.2 0-4 1.8-4 4s1.8 4 4 4h4v-8Zm0-8H8C5.8 4 4 5.8 4 8s1.8 4 4 4h4V4Zm8 4c0-2.2-1.8-4-4-4h-4v8h4c2.2 0 4-1.8 4-4Zm-4 4c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4Z"
      />
    </svg>
  );
}

function NotionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M4.5 3.5 19 2l.5 18.5L5.2 22 4.5 3.5Zm3.2 4.1c.3-.1.5-.1 1.1-.1l6.8-.3c.2 0 .3.1.3.3v.7c0 .1-.1.3-.3.3l-1.6.1v8.4c0 .2.1.3.3.3l1.3.1c.2 0 .3.1.3.3v.7c0 .2-.1.3-.3.3l-4.7.2c-.2 0-.3-.1-.3-.3v-.7c0-.2.1-.3.3-.3l1.4-.1c.2 0 .3-.1.3-.3V8.6c0-.2-.1-.3-.3-.3l-1.7.1c-.2 0-.3.1-.4.3l-.2.6c0 .1-.1.2-.3.2H7.8c-.2 0-.3-.1-.3-.3V7.9c0-.2.1-.3.2-.3Z"
      />
    </svg>
  );
}

const ICON_OAUTH: {
  provider: Exclude<OAuthProvider, "google" | "github">;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    provider: "facebook",
    label: "Continue with Facebook",
    icon: (
      <i
        className="bi bi-facebook text-[18px] leading-none text-[#1877F2]"
        aria-hidden
      />
    ),
  },
  {
    provider: "twitter",
    label: "Continue with X",
    icon: <i className="bi bi-twitter-x text-[16px] leading-none" aria-hidden />,
  },
  {
    provider: "apple",
    label: "Continue with Apple",
    icon: <i className="bi bi-apple text-[18px] leading-none" aria-hidden />,
  },
  {
    provider: "gitlab",
    label: "Continue with GitLab",
    icon: (
      <i
        className="bi bi-gitlab text-[17px] leading-none text-[#FC6D26]"
        aria-hidden
      />
    ),
  },
  {
    provider: "figma",
    label: "Continue with Figma",
    icon: <FigmaIcon className="text-zinc-800" />,
  },
  {
    provider: "notion",
    label: "Continue with Notion",
    icon: <NotionIcon className="text-zinc-900" />,
  },
  {
    provider: "azure",
    label: "Continue with Azure",
    icon: (
      <i
        className="bi bi-microsoft text-[16px] leading-none text-[#00A4EF]"
        aria-hidden
      />
    ),
  },
];

export function AuthOAuthButtons({
  onOAuth,
  onSso,
  disabled,
}: {
  onOAuth: (provider: OAuthProvider) => void;
  onSso?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOAuth("google")}
        className={authPageStyles.outlinedBtn}
      >
        <i className="bi bi-google text-[16px] leading-none" aria-hidden />
        Continue with Google
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOAuth("github")}
        className={authPageStyles.outlinedBtn}
      >
        <i className="bi bi-github text-[16px] leading-none" aria-hidden />
        Continue with GitHub
      </button>

      {/* Icon providers wrap so the row stays inside the login column */}
      <div className="flex flex-wrap items-center gap-2.5">
        {ICON_OAUTH.map(({ provider, label, icon }) => (
          <button
            key={provider}
            type="button"
            disabled={disabled}
            onClick={() => onOAuth(provider)}
            className={authPageStyles.iconBtn}
            aria-label={label}
          >
            {icon}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onSso}
        className={authPageStyles.outlinedBtn}
        aria-label="Continue with SSO"
      >
        <i
          className="bi bi-building text-[15px] leading-none text-zinc-600"
          aria-hidden
        />
        Continue with SSO
      </button>
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
  onForgotPassword,
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
  onForgotPassword?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
        className={cn(authPageStyles.primaryBtn, submitting && "opacity-70")}
      >
        {submitting ? "Please wait…" : submitLabel}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <button
          type="button"
          onClick={onToggleMagicLink}
          className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700"
        >
          {useMagicLink ? "Use password instead" : "Email me a magic link"}
        </button>
        {!useMagicLink && onForgotPassword ? (
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
  return message;
}

export function AuthLoadingShell() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-[var(--app-shell-bg)]">
      <div className="flex h-[min(92dvh,880px)] w-[min(96vw,1120px)] items-center justify-center rounded-[18px] border border-zinc-200/80 bg-[var(--app-panel-bg)]">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800"
          role="status"
          aria-label="Loading"
        />
      </div>
    </div>
  );
}
