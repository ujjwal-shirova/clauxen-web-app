"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Check, ShieldCheck, Wrench, ArrowRight, Loader2 } from "lucide-react";
import { pluginById } from "@/client/components/plugins/catalog";
import { PluginMark } from "@/client/components/plugins/plugin-mark";
import { stripCursorText } from "@/client/components/plugins/plugin-copy";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";

export default function PlatformAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--app-panel-bg,#fafafa)]">
          <Loader2 className="size-6 animate-spin text-[var(--ui-fg-muted,#666)]" />
        </div>
      }
    >
      <AuthorizeContent />
    </Suspense>
  );
}

function AuthorizeContent() {
  const searchParams = useSearchParams();
  const pluginId = searchParams.get("pluginId") || "";
  const state = searchParams.get("state") || "";

  const plugin = pluginId ? pluginById(pluginId) : null;
  const name = plugin ? stripCursorText(plugin.name) || plugin.name : pluginId || "Plugin";
  const iconUrl = plugin?.iconUrl ?? null;
  const description = plugin?.description ?? "Connect your platform account to enable AI tool calling.";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthorize = async () => {
    if (!state) {
      setError("Missing authorization state. Please try reconnecting from the plugins page.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      window.location.href = `/api/v1/plugins/callback?state=${encodeURIComponent(state)}&code=auth_ok`;
    } catch {
      setError("Failed to complete authorization. Please try again.");
      setLoading(false);
    }
  };

  const handleCancel = () => {
    window.close();
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#f7f7f8] p-4 font-sans text-[#18181b] antialiased dark:bg-[#09090b] dark:text-[#f4f4f5]">
      <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-7 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] dark:bg-[#121214] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        {/* Connection brand header */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <div className="grid size-12 place-items-center rounded-xl bg-black font-semibold text-white shadow-sm dark:bg-white dark:text-black">
            <span className="text-[17px] font-bold tracking-tight">C</span>
          </div>
          <ArrowRight className="size-4 text-[#a1a1aa]" strokeWidth={2} />
          <PluginMark name={name} iconUrl={iconUrl ?? undefined} size={48} className="rounded-xl shadow-sm" />
        </div>

        {/* Title & subtitle */}
        <div className="mt-5 text-center">
          <h1 className="text-[19px] font-semibold tracking-[-0.01em]">
            Authorize {name}
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-[#71717a] dark:text-[#a1a1aa]">
            Clauxen would like permission to connect to your {name} workspace and tools.
          </p>
        </div>

        {description ? (
          <div className="mt-4 rounded-xl bg-[#f4f4f5]/60 p-3 text-[12.5px] leading-relaxed text-[#52525b] dark:bg-[#18181b] dark:text-[#a1a1aa]">
            {description}
          </div>
        ) : null}

        {/* Permissions list */}
        <div className="mt-5 space-y-3 border-t border-[rgba(0,0,0,0.06)] pt-5 dark:border-[rgba(255,255,255,0.06)]">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Check className="size-3.5" strokeWidth={2.5} />
            </span>
            <div className="text-[12.5px] leading-[18px]">
              <span className="font-medium text-[#27272a] dark:text-[#e4e4e7]">
                Tool Discovery & Invocation
              </span>
              <p className="text-[#71717a] dark:text-[#a1a1aa]">
                Allow the assistant to call {name} actions during your chats.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Wrench className="size-3.5" strokeWidth={2} />
            </span>
            <div className="text-[12.5px] leading-[18px]">
              <span className="font-medium text-[#27272a] dark:text-[#e4e4e7]">
                Contextual Execution
              </span>
              <p className="text-[#71717a] dark:text-[#a1a1aa]">
                Actions run only when prompted in your active conversations.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <ShieldCheck className="size-3.5" strokeWidth={2} />
            </span>
            <div className="text-[12.5px] leading-[18px]">
              <span className="font-medium text-[#27272a] dark:text-[#e4e4e7]">
                Encrypted Storage
              </span>
              <p className="text-[#71717a] dark:text-[#a1a1aa]">
                Credentials are sealed with AES-256-GCM encryption at rest.
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] leading-5 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
          >
            {error}
          </p>
        ) : null}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={handleAuthorize}
            disabled={loading}
            className={cn(
              appBtn.primary,
              "h-10 w-full justify-center gap-2 text-[13.5px] font-medium shadow-sm",
              loading && "opacity-80",
            )}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : null}
            {loading ? "Authorizing…" : `Authorize ${name}`}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className={cn(
              appBtn.secondary,
              "h-9 w-full justify-center text-[13px] text-[#71717a] hover:text-[#18181b] dark:text-[#a1a1aa] dark:hover:text-[#f4f4f5]",
            )}
          >
            Cancel
          </button>
        </div>
      </div>
    </main>
  );
}
