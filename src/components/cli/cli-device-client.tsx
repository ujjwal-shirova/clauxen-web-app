"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authPageStyles } from "@/components/auth/auth-shared";

export function CliDeviceClient() {
  const params = useSearchParams();
  const [userCode, setUserCode] = useState(
    () => params.get("user_code")?.toUpperCase() ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/oauth/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_code: userCode.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.message || data.error || "Could not approve device.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

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
          Enter device code
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          Confirm the code shown in your terminal to sign the Clauxen Code CLI
          into your account.
        </p>

        {done ? (
          <p className="mt-8 text-sm font-medium text-emerald-700">
            Device approved. You can return to the terminal.
          </p>
        ) : (
          <>
            <label className="mt-6 block text-sm font-medium text-zinc-800">
              User code
              <input
                className={`${authPageStyles.input} mt-2 font-mono uppercase tracking-widest`}
                value={userCode}
                onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                autoComplete="one-time-code"
              />
            </label>
            {error ? (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}
            <button
              type="button"
              className={`${authPageStyles.primaryBtn} mt-6`}
              disabled={busy || userCode.trim().length < 8}
              onClick={() => void approve()}
            >
              {busy ? "Approving…" : "Approve device"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
