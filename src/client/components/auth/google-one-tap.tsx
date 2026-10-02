"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useOptionalAuthGate } from "@/contexts/auth-gate-context";

/**
 * Google Identity Services (GIS) One Tap — surfaces the browser's NATIVE
 * sign-in popup (Chrome FedCM "Signing you in…" dialog anchored to the top
 * right of the browser window), so a guest can sign in in one click without
 * leaving the app preview. Nothing here is a custom popup — the UI is drawn
 * by the browser via `google.accounts.id.prompt()`.
 *
 * Requires `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (the Google OAuth client also
 * configured for "Sign in with Google → ID token" in Supabase Auth) and the
 * running origin allow-listed on that client.
 */

interface GoogleCredentialResponse {
  credential?: string;
  clientId?: string;
  select_by?: string;
}

interface GooglePromptNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
    prompt_parent_id?: string;
  }) => void;
  prompt: (
    callback?: (notification: GooglePromptNotification) => void,
  ) => void;
  cancel: () => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const GSI_SCRIPT_SELECTOR = "script[data-clx-google-gsi]";
const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGsiScript(onReady: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  if (window.google?.accounts?.id) {
    onReady();
    return () => {};
  }
  const existing = document.querySelector<HTMLScriptElement>(
    GSI_SCRIPT_SELECTOR,
  );
  if (existing) {
    existing.addEventListener("load", onReady, { once: true });
    return () => existing.removeEventListener("load", onReady);
  }
  const script = document.createElement("script");
  script.src = GSI_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.setAttribute("data-clx-google-gsi", "1");
  script.addEventListener("load", onReady, { once: true });
  document.head.appendChild(script);
  return () => script.removeEventListener("load", onReady);
}

export function GoogleOneTap() {
  const { user, loading, refresh } = useAuth();
  const authGate = useOptionalAuthGate();
  const gateOpen = authGate?.isOpen ?? false;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (loading) return;
    if (user?.id) return;
    // Never compete with the in-app sign-in dialog.
    if (gateOpen) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
    if (!clientId) return;

    let cancelled = false;

    const handleCredential = async (response: GoogleCredentialResponse) => {
      const token = response.credential;
      if (!token || cancelled) return;
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token,
        });
        if (error) {
          console.warn("[google-one-tap] sign-in failed:", error.message);
          return;
        }
        await refreshRef.current({ quiet: true });
        authGate?.closeAuthGate();
      } catch (err) {
        console.warn("[google-one-tap] sign-in failed:", err);
      }
    };

    const startPrompt = () => {
      const id = window.google?.accounts?.id;
      if (!id || cancelled) return;
      id.initialize({
        client_id: clientId,
        callback: (response) => void handleCredential(response),
        auto_select: false,
        cancel_on_tap_outside: false,
        // Let Chrome render the native FedCM account dialog (browser UI).
        use_fedcm_for_prompt: true,
      });
      id.prompt((notification) => {
        // Suppressed (cooldown, policy, FedCM unavailable) → stay silent;
        // the in-app sign-in dialog remains the fallback.
        if (
          notification.isNotDisplayed?.() ||
          notification.isSkippedMoment?.()
        ) {
          console.debug(
            "[google-one-tap] prompt not shown:",
            notification.getNotDisplayedReason?.() ??
              notification.getSkippedReason?.() ??
              "unknown",
          );
        }
      });
    };

    return loadGsiScript(startPrompt);
  }, [loading, user?.id, gateOpen, authGate]);

  return null;
}
