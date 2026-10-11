"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useOptionalAuthGate } from "@/contexts/auth-gate-context";

/**
 * Google Identity Services One Tap prompts guests after the session check.
 * Supported browsers render their native FedCM account dialog; Google and
 * the browser decide its appearance, position and whether it can be shown.
 *
 * Uses NEXT_PUBLIC_GOOGLE_CLIENT_ID or Clauxen's existing web client. The
 * client must also be configured in Supabase Auth and allow the running origin.
 */

interface GoogleCredentialResponse {
  credential?: string;
  clientId?: string;
  select_by?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    nonce: string;
  }) => void;
  prompt: () => void;
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
  const existing =
    document.querySelector<HTMLScriptElement>(GSI_SCRIPT_SELECTOR);
  if (existing) {
    existing.addEventListener("load", onReady, { once: true });
    return () => existing.removeEventListener("load", onReady);
  }
  const script = document.createElement("script");
  script.src = GSI_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.setAttribute("data-clx-google-gsi", "1");
  script.addEventListener(
    "error",
    () => {
      // Allow a later mount to retry if a network error blocked the library.
      script.remove();
    },
    { once: true },
  );
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
  const promptedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (user?.id) return;
    // Never compete with the in-app sign-in dialog.
    if (gateOpen || promptedRef.current) return;

    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
      "103785677444-ctlfhurfg8864m59bclrqsvt6h9f7t8r.apps.googleusercontent.com";
    if (!clientId) return;

    let cancelled = false;
    let promptId: GoogleAccountsId | undefined;
    let exchanging = false;
    let nonce = "";

    const handleCredential = async (response: GoogleCredentialResponse) => {
      const token = response.credential;
      if (!token || cancelled || exchanging) return;
      exchanging = true;
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token,
          nonce,
        });
        if (error) {
          console.warn("[google-one-tap] sign-in failed:", error.message);
          return;
        }
        await refreshRef.current({ quiet: true });
        // AuthGateProvider closes any open gate when the session changes.
      } catch (err) {
        console.warn("[google-one-tap] sign-in failed:", err);
      }
    };

    const startPrompt = async () => {
      const id = window.google?.accounts?.id;
      if (!id || cancelled) return;
      // Google receives the SHA-256 digest; Supabase verifies the raw nonce.
      nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(nonce),
      );
      if (cancelled || promptedRef.current) return;
      const hashedNonce = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      id.initialize({
        client_id: clientId,
        callback: (response) => void handleCredential(response),
        auto_select: false,
        cancel_on_tap_outside: false,
        nonce: hashedNonce,
      });
      promptId = id;
      promptedRef.current = true;
      // GIS uses FedCM where supported. The browser owns its UI and cooldown.
      id.prompt();
    };

    const unload = loadGsiScript(() => {
      void startPrompt().catch((error) => {
        console.warn("[google-one-tap] initialization failed:", error);
      });
    });
    return () => {
      cancelled = true;
      unload();
      promptId?.cancel();
    };
  }, [loading, user?.id, gateOpen]);

  return null;
}
