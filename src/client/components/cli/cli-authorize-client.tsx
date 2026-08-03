"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authPageStyles } from "@/components/auth/auth-shared";
import { CLAUXEN_CODE_CLIENT_ID } from "@/lib/oauth-cli";

export function CliAuthorizeClient() {
  const params = useSearchParams();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useMemo(() => {
    return {
      clientId: params.get("client_id") || CLAUXEN_CODE_CLIENT_ID,
      redirectUri: params.get("redirect_uri") || "",
      responseType: params.get("response_type") || "code",
      state: params.get("state"),
      codeChallenge: params.get("code_challenge") || "",
      codeChallengeMethod: params.get("code_challenge_method") || "S256",
      scope: params.get("scope") || "",
    };
  }, [params]);

  async function submit(action: "approve" | "deny") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action,
          client_id: request.clientId,
          redirect_uri: request.redirectUri,
          state: request.state,
          code_challenge: request.codeChallenge,
          code_challenge_method: request.codeChallengeMethod,
          scope: request.scope || undefined,
        }),
      });
      const data = (await res.json()) as {
        redirect_to?: string;
        error_description?: string;
        error?: string;
      };
      if (!res.ok || !data.redirect_to) {
        setError(data.error_description || data.error || "Authorization failed.");
        setBusy(null);
        return;
      }
      window.location.href = data.redirect_to;
    } catch {
      setError("Network error. Try again.");
      setBusy(null);
    }
  }

  const missing =
    !request.redirectUri ||
    !request.codeChallenge ||
    request.responseType !== "code";

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: authPageStyles.shellBg }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 p-8 shadow-sm"
        style={{ background: authPageStyles.panelBg }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          Clauxen Code
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
          Authorize Clauxen Code
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Allow the Clauxen Code CLI on this computer to access your Clauxen
          account for inference, profile, and session management. You can revoke
          access anytime from Settings.
        </p>

        <ul className="mt-5 space-y-2 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <li>Run coding sessions billed to your Clauxen balance</li>
          <li>Read your account name and email for the CLI status line</li>
          <li>Refresh your session without signing in again</li>
        </ul>

        {missing ? (
          <p className="mt-6 text-sm text-red-600">
            This authorization link is incomplete. Start sign-in from the
            Clauxen Code CLI again.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            className={authPageStyles.primaryBtn}
            disabled={Boolean(busy) || missing}
            onClick={() => void submit("approve")}
          >
            {busy === "approve" ? "Authorizing…" : "Authorize"}
          </button>
          <button
            type="button"
            className={authPageStyles.outlinedBtn}
            disabled={Boolean(busy) || missing}
            onClick={() => void submit("deny")}
          >
            {busy === "deny" ? "Canceling…" : "Deny"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          After you authorize, this tab redirects back to the CLI on your
          machine.
        </p>
      </div>
    </div>
  );
}
