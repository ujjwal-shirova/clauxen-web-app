"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthGateForm } from "@/components/auth/auth-gate-form";
import { ClauxenWordmark } from "@/components/auth/clauxen-wordmark";
import { Clock, FolderKanban, Sparkles } from "@/components/icons/app-icons";
import { getSafeRedirectTo } from "@/lib/auth-redirect";

interface AuthGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preserved deep-link destination (from `?redirectTo=` or `openAuthGate`). */
  redirectTo?: string | null;
  /** OAuth failure carried over from a legacy `/login?error=` link. */
  initialError?: string | null;
}

const BENEFITS = [
  {
    icon: Clock,
    title: "Keep every conversation",
    body: "Chats, files and answers stay in your history — reopen or search them anytime.",
  },
  {
    icon: FolderKanban,
    title: "Projects that remember",
    body: "Group chats with their own instructions, context files and memory.",
  },
  {
    icon: Sparkles,
    title: "Work across devices",
    body: "Sign in once and pick up on web, desktop and mobile.",
  },
] as const;

/**
 * Guest sign-in surface.
 *
 * A docked card rather than a full-screen modal: a guest who has not decided
 * to sign in should still see and use the app behind it. Desktop anchors the
 * card to the bottom-right corner; small screens get a bottom sheet.
 */
export function AuthGateDialog({
  open,
  onOpenChange,
  redirectTo,
  initialError,
}: AuthGateDialogProps) {
  const router = useRouter();
  const pathname = usePathname();

  const target = useMemo(
    () => getSafeRedirectTo(redirectTo ?? null),
    [redirectTo],
  );

  const handleAuthenticated = useCallback(
    (nextTarget: string) => {
      onOpenChange(false);
      const targetPath = nextTarget.split(/[?#]/)[0] || "/new";
      // Same page → keep the preview in place; deep link → honor it.
      if (targetPath !== (pathname || "/new")) {
        router.replace(nextTarget);
      }
    },
    [onOpenChange, pathname, router],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        hideClose
        data-auth-gate-dialog
        className="cx-auth-panel gap-0 overflow-y-auto p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">Sign in to Clauxen</DialogTitle>
        <DialogDescription className="sr-only">
          Sign in to keep chats, projects and files. You can keep using the app
          preview without an account.
        </DialogDescription>

        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-border-subtle)] px-4 py-3">
            <ClauxenWordmark height={20} className="text-[var(--ui-fg)]" />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-7 items-center rounded-full px-2.5 text-[12px] font-medium text-[var(--ui-fg-muted)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:outline-none"
            >
              Not now
            </button>
          </div>

          <div className="px-4 pt-4">
            <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.02em] text-[var(--ui-fg)]">
              Unlock more with Clauxen
            </h2>
            <p className="mt-1 text-[12.5px] leading-5 text-[var(--ui-fg-muted)]">
              You are browsing as a guest. Sign in to keep what you make.
            </p>

            <ul className="mt-3 flex flex-col gap-2">
              {BENEFITS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-2.5">
                  <span className="mt-px flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--ui-hover-wash)] text-[14px] text-[var(--ui-fg)]">
                    <Icon />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-medium leading-5 text-[var(--ui-fg)]">
                      {title}
                    </span>
                    <span className="block text-[12px] leading-[18px] text-[var(--ui-fg-muted)]">
                      {body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3.5 border-t border-[var(--ui-border-subtle)] px-4 pb-3.5 pt-3">
            <AuthGateForm
              redirectTo={target}
              initialError={initialError}
              onAuthenticated={handleAuthenticated}
              variant="panel"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
