"use client";

import React from "react";
import { ArrowUpRight, Loader2, Microscope } from "lucide-react"; // Lucide icons — suggestion arrow, loading spinner, hero microscope icon
import { PromptInput } from "./prompt-input"; // shared chat-style prompt input component — research question submit
import { useResearch } from "@/hooks/use-research"; // custom hook — research runs fetch/create API state
import { useAuth } from "@/hooks/use-auth"; // auth hook — isAuthenticated gate for API calls
import { cn } from "@/lib/utils"; // className merge utility — status badge conditional colors

interface DeepResearchViewProps {
  // TypeScript interface — component external API
  onSendMessage?: (prompt: string) => void;
  onStopGeneration: () => void; // required — PromptInput stop button handler (streaming cancel)
  isGenerating: boolean; // parent-level generating flag — PromptInput disabled/spinner state
}

const suggestions = [
  // readonly suggestion objects array
  {
    title: "Evaluate Healthcare Systems",
    description:
      "Compare access, outcomes, and costs across different countries and healthcare models. Identify which systems deliver the best results for patients and which are under strain.",
  },
  {
    title: "Compare Music Trends", // music industry research example
    description:
      "Analyze streaming data, live shows, and genre popularity to understand how music tastes are shifting around the world.",
  },
  {
    title: "Compare Credit Options", // finance/credit research example
    description:
      "Analyze interest rates, fees, and borrower outcomes across credit cards, personal loans, and mortgages. Identify which types of credit are becoming more expensive and which remain affordable.",
  },
  {
    title: "Track Food Culture", // food/restaurant trends example
    description:
      "Analyze restaurant trends, grocery data, and cuisine popularity to see how eating habits are changing across regions.",
  },
]; // suggestions array end

// research run status → semantic pill classes (theme-aware)
const statusColors: Record<string, string> = {
  // string keys match API run.status values
  queued: "app-status-pill--neutral", // queued — neutral badge
  running: "app-status-pill--info", // in progress — brand tint
  completed: "app-status-pill--success", // success — green tint
  failed: "app-status-pill--danger", // error — red tint
}; // statusColors map end

export function DeepResearchView({
  onSendMessage, // optional parent callback after submit
  onStopGeneration, // stop handler passthrough to PromptInput
  isGenerating, // parent generating state passthrough
}: DeepResearchViewProps) {
  // destructured props
  const auth = useAuth(); // auth context/state — isAuthenticated for API gating
  const { runs, loading, creating, startRun } = useResearch(
    auth.isAuthenticated,
  ); // research hook — runs list, loading flags, startRun mutation

  // prompt submit handler — trim, API call, optional parent notify
  const handleSubmit = async (prompt: string) => {
    // async — startRun returns Promise
    if (!auth.isAuthenticated) return;
    if (!prompt.trim()) return; // empty/whitespace-only — reject silently
    await startRun(prompt.trim()); // backend research run create — trimmed prompt
    onSendMessage?.(prompt); // optional chaining — parent callback if provided (uses original prompt, not trimmed — preserved behavior)
  };

  return (
    // main page layout JSX
    <div className="flex flex-1 w-full bg-[var(--app-panel-bg)] text-[var(--ui-fg)] font-sans overflow-y-auto">
      {" "}
      {/* full-area scrollable page — warm off-white background */}
      <div className="w-full px-4 sm:px-6 lg:px-16 pb-12">
        {" "}
        {/* responsive horizontal padding — more padding on large screens */}
        <div className="w-full max-w-[768px] mx-auto flex flex-col gap-4">
          {" "}
          {/* centered content column — max width 768px */}
          <div className="text-center pt-10 sm:pt-14">
            {" "}
            {/* hero section — centered text; extra top padding on sm+ */}
            <span className="mx-auto mb-3 flex items-center justify-center w-16 h-16 rounded-full bg-[var(--brand-soft)] text-[var(--link)]">
              {" "}
              {/* circular icon badge — microscope hero */}
              <Microscope className="w-[30px] h-[30px]" />{" "}
              {/* research/microscope icon — brand blue */}
            </span>
            <h1 className="font-headline text-[28px] leading-[34px] tracking-[0.38px] font-semibold text-[var(--ui-fg)]">
              {" "}
              {/* primary headline typography */}
              What can I help with?
            </h1>
            <p className="mt-2 text-[16px] leading-6 text-[var(--ui-fg-muted)]">
              {" "}
              {/* subtitle — value proposition copy */}
              Ask a complex question. Get a full report, with sources.
            </p>
          </div>
          <div className="w-full pt-10">
            {" "}
            {/* prompt input section — spacing below hero */}
            <PromptInput
              onSendMessage={(p) => void handleSubmit(p)} // wrap async handler — void operator suppresses floating promise lint
              onStopGeneration={onStopGeneration} // stop passthrough — parent owns cancel logic
              isConversationStarted={false} // landing mode — not mid-conversation UI
              isGenerating={isGenerating || creating} // disabled/spinner — parent generating OR research run creating
            />
          </div>
          <section className="w-full pt-3" aria-label="Suggested prompts">
            {" "}
            {/* suggestion list section — accessible label */}
            <ul className="flex flex-col w-full">
              {" "}
              {/* vertical list of suggestion buttons */}
              {suggestions.map(
                (
                  item, // map each static suggestion
                ) => (
                  <li key={item.title}>
                    {" "}
                    {/* list key — title unique per suggestion */}
                    <button
                      type="button" // suggestion row button
                      disabled={!auth.isAuthenticated}
                      onClick={() => void handleSubmit(item.title)} // click → submit suggestion title as prompt
                      className="w-full flex items-center gap-3 rounded-xl px-[18px] py-3 text-left transition-colors hover:bg-[var(--ui-hover-wash)]" // full-width row hover
                    >
                      <ArrowUpRight className="w-5 h-5 shrink-0 text-[var(--ui-fg-placeholder)]" />{" "}
                      {/* decorative arrow — indicates action/launch */}
                      <span className="flex items-center gap-2 w-full overflow-hidden">
                        {" "}
                        {/* title + description row — overflow hidden for truncate */}
                        <span className="shrink-0 text-[14px] leading-5 text-[var(--ui-fg)] font-medium">
                          {" "}
                          {/* suggestion title — no shrink */}
                          {item.title}
                        </span>
                        <span className="text-[14px] leading-[22px] tracking-[-0.14px] text-[var(--ui-fg-muted)] truncate">
                          {" "}
                          {/* description — truncate overflow */}
                          {item.description}
                        </span>
                      </span>
                    </button>
                  </li>
                ),
              )}{" "}
              {/* suggestions map end */}
            </ul>
          </section>
          <section className="w-full pt-6" aria-label="Research runs">
            {" "}
            {/* recent runs section — user's past research jobs */}
            <h2 className="text-[15px] font-semibold text-[var(--ui-fg)] mb-3">
              {" "}
              {/* section heading */}
              Recent research
            </h2>
            {loading ? ( // API fetch in progress — spinner state
              <div className="flex justify-center py-8 text-[var(--ui-fg-muted)]">
                {" "}
                {/* centered loading container */}
                <Loader2 className="w-5 h-5 animate-spin" />{" "}
                {/* spinning loader icon */}
              </div>
            ) : runs.length === 0 ? ( // empty state — no runs yet
              <p className="text-[14px] text-[var(--ui-fg-muted)] py-4">
                {" "}
                {/* muted helper text */}
                No research runs yet. Submit a question above to start.
              </p>
            ) : (
              // runs exist — render list
              <ul className="flex flex-col gap-2">
                {" "}
                {/* vertical run cards list */}
                {runs.map(
                  (
                    run, // each research run from API
                  ) => (
                    <li
                      key={run.id} // React key — run UUID/id
                      className="rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-field-bg)] px-4 py-3 shadow-[var(--panel-shadow)]" // card styling — token surface
                    >
                      <div className="flex items-start justify-between gap-3">
                        {" "}
                        {/* objective + status badge row */}
                        <p className="text-[14px] font-medium text-[var(--ui-fg)] line-clamp-2">
                          {" "}
                          {/* run objective/prompt — max 2 lines */}
                          {run.objective}
                        </p>
                        <span
                          className={cn(
                            // status badge — dynamic color from statusColors map
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", // pill badge base classes
                            statusColors[run.status] ?? statusColors.queued, // known status color or fallback queued
                          )}
                        >
                          {run.status}{" "}
                          {/* raw status string display — capitalize via CSS */}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[var(--ui-fg-muted)]">
                        {" "}
                        {/* created timestamp — localized format */}
                        {new Date(run.created_at).toLocaleString()}
                      </p>
                    </li>
                  ),
                )}{" "}
                {/* runs map end */}
              </ul>
            )}{" "}
            {/* loading/empty/list ternary end */}
          </section>
        </div>
      </div>
    </div>
  ); // return end
} // DeepResearchView function end
