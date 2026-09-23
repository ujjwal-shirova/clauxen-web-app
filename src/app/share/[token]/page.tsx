"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import type { SharedChatSnapshot } from "@/lib/share-public";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type GateConfig = {
  siteKey: string | null;
  workerUrl: string | null;
};

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: { message?: string } }).error;
  return error?.message || fallback;
}

export default function PublicSharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const widgetHost = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [gate, setGate] = useState<GateConfig | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const [snapshot, setSnapshot] = useState<SharedChatSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/share/gate")
      .then(async (response) => {
        const body = (await response.json()) as { data?: GateConfig };
        if (!response.ok || !body.data) throw new Error("Could not load the share check.");
        return body.data;
      })
      .then((data) => {
        if (!cancelled) setGate(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the share check.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (window.turnstile) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-share-turnstile]",
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.shareTurnstile = "1";
    script.onload = () => setScriptReady(true);
    script.onerror = () => setError("Could not load the human check.");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!scriptReady || !gate?.siteKey || !widgetHost.current || !window.turnstile) return;
    if (widgetId.current) return;
    widgetId.current = window.turnstile.render(widgetHost.current, {
      sitekey: gate.siteKey,
      action: "share_open",
      callback: (turnstileToken) => {
        void openChat(turnstileToken);
      },
      "error-callback": () => {
        setError("Could not confirm you are a person. Refresh and try again.");
      },
      "expired-callback": () => {
        setError("That check expired. Confirm again.");
      },
    });
    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // openChat closes over the latest token and worker URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, gate?.siteKey]);

  async function openChat(turnstileToken: string) {
    if (!token || opening) return;
    setOpening(true);
    setError(null);
    const payload = { token, turnstileToken };
    try {
      const workerUrl = gate?.workerUrl?.replace(/\/$/, "");
      const endpoint = workerUrl
        ? `${workerUrl}/v1/open`
        : `/api/v1/share/${encodeURIComponent(token)}/open`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(workerUrl ? payload : { turnstileToken }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(errorMessage(body, "Could not open this chat."));
      }
      const data = (body as { data?: SharedChatSnapshot } | null)?.data;
      if (!data?.messages) throw new Error("Could not open this chat.");
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this chat.");
      setOpening(false);
    }
  }

  if (snapshot) {
    return (
      <div className="min-h-[100dvh] bg-[var(--app-panel-bg,#fafaf9)] text-[var(--ui-fg)]">
        <header className="border-b border-[var(--ui-border-subtle)] px-5 py-4">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ui-fg-muted)]">
            Shared chat
          </p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">
            {snapshot.title}
          </h1>
        </header>
        <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
          {snapshot.messages.length === 0 ? (
            <p className="text-[14px] text-[var(--ui-fg-muted)]">
              This shared chat has no messages.
            </p>
          ) : (
            snapshot.messages.map((message) => (
              <article
                key={message.id}
                className="rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)] px-4 py-3"
              >
                <p className="mb-1.5 text-[12px] font-medium text-[var(--ui-fg-muted)]">
                  {message.role === "user" ? "You" : "Assistant"}
                </p>
                <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">
                  {message.content}
                </p>
              </article>
            ))
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-panel-bg,#fafaf9)] px-4">
      <div className="app-dialog-panel w-[min(420px,calc(100vw-32px))] rounded-[20px] px-5 py-6">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--ui-fg)]">
          Open shared chat
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ui-fg-muted)]">
          Anyone with this link can read a saved copy. Confirm you are a person
          to view it. Search engines are not given the messages.
        </p>
        <div className="mt-5 min-h-16">
          {gate?.siteKey ? <div ref={widgetHost} /> : null}
          {opening || (!gate && !error) ? (
            <div className="flex items-center gap-2 text-[13.5px] text-[var(--ui-fg-muted)]">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {opening ? "Opening chat…" : "Loading…"}
            </div>
          ) : null}
          {gate && !gate.siteKey ? (
            <p className="text-[13.5px] text-[var(--settings-danger)]">
              Sharing is not available right now.
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="mt-3 text-[13px] text-[var(--settings-danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
