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
import { getSafeRedirectTo } from "@/lib/auth-redirect";

interface AuthGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preserved deep-link destination (from `?redirectTo=` or `openAuthGate`). */
  redirectTo?: string | null;
  /** OAuth failure carried over from a legacy `/login?error=` link. */
  initialError?: string | null;
}

/**
 * In-app sign-in container — the exact same form as `/login`, rendered as a
 * large modal over the live app preview so guests never leave the page.
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Large sign-in container — the login form scaled up as a popup.
        className="cx-auth-gate-dialog max-h-[min(720px,calc(100dvh-2rem))] w-[min(560px,calc(100%-1.5rem))] max-w-[560px] overflow-y-auto rounded-[18px] border border-[var(--ui-border-subtle)] bg-[var(--app-panel-bg)] p-6 shadow-[0_24px_80px_-16px_rgba(24,24,27,0.35)] sm:p-8"
        data-auth-gate-dialog
      >
        <DialogTitle className="sr-only">Sign in to Clauxen</DialogTitle>
        <DialogDescription className="sr-only">
          Sign in to continue. Choose a provider or use your email — the app
          stays open behind this dialog.
        </DialogDescription>
        <AuthGateForm
          redirectTo={target}
          initialError={initialError}
          onAuthenticated={handleAuthenticated}
          variant="dialog"
        />
      </DialogContent>
    </Dialog>
  );
}
