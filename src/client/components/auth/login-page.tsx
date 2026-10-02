"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthLoadingShell } from "@/components/auth/auth-shared";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  AuthGateForm,
  useAuthGateRedirectEffect,
} from "@/components/auth/auth-gate-form";
import { getSafeRedirectTo } from "@/lib/auth-redirect";

/**
 * Standalone `/login` page — the exact same form also lives inside the app
 * as the auth gate dialog (`AuthGateDialog`), so guests can sign in without
 * ever leaving the app preview.
 */
export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectTo(searchParams.get("redirectTo"));
  const urlError = searchParams.get("error");

  const { isAuthenticated, loading } = useAuth();

  const replace = useCallback(
    (target: string) => {
      router.replace(target);
    },
    [router],
  );

  useAuthGateRedirectEffect({
    loading,
    isAuthenticated,
    redirectTo,
    replace,
  });

  if (loading) {
    return <AuthLoadingShell />;
  }

  return (
    <AuthShell>
      <AuthGateForm
        redirectTo={redirectTo}
        initialError={urlError}
        onAuthenticated={replace}
        variant="page"
      />
    </AuthShell>
  );
}
