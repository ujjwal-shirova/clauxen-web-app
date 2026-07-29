"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SITE } from "@/marketing/lib/site";

type ModeId = "chat" | "work" | "codex";

const MODE_COLORS: Record<ModeId, { letters: string[]; underline: string }> = {
  chat: {
    letters: ["#10a0e8", "#fcd448", "#fc6c28", "#fcc0cc"],
    underline: "linear-gradient(90deg, #10a0e8, #fcd448, #fc6c28, #fcc0cc)",
  },
  work: {
    letters: ["#04b84c", "#10a0e8", "#fcd448", "#fc6c28"],
    underline: "linear-gradient(90deg, #04b84c, #10a0e8, #fcd448, #fc6c28)",
  },
  codex: {
    letters: ["#ceb0fb", "#10a0e8", "#04b84c", "#fcd448"],
    underline: "linear-gradient(90deg, #ceb0fb, #10a0e8, #04b84c, #fcd448)",
  },
};

const MODES: {
  id: ModeId;
  label: string;
  eyebrow: string;
  body: string;
  image: string;
  imageAlt: string;
}[] = [
  {
    id: "chat",
    label: "Chat",
    eyebrow: "Think out loud with a sharp partner.",
    body: "Ask questions, pressure-test ideas, draft notes, compare options, and keep a clear thread of how you got there — all in one conversation.",
    image: "/assets/marketing/overview-mode-chat.png",
    imageAlt: "Clauxen chat workspace",
  },
  {
    id: "work",
    label: "Work",
    eyebrow: "Finish the deliverable, not just the draft.",
    body: "Turn goals into docs, decks, sheets, and charts. Bring in the tools and context you already use, then ship something you can hand off.",
    image: "/assets/marketing/overview-mode-work.png",
    imageAlt: "Clauxen work deliverable workspace",
  },
  {
    id: "codex",
    label: "Codex",
    eyebrow: "Ship code beside the conversation.",
    body: "Plan, write, review, and fix software in the same place you think. Codex stays close to chat so technical work never leaves your flow.",
    image: "/assets/marketing/overview-mode-codex.png",
    imageAlt: "Clauxen Codex coding workspace",
  },
];

function RainbowWord({
  word,
  mode,
  active,
  onSelect,
}: {
  word: string;
  mode: ModeId;
  active: boolean;
  onSelect: () => void;
}) {
  const palette = MODE_COLORS[mode];
  const lit = active;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={word}
      onClick={onSelect}
      onMouseEnter={onSelect}
      className="group/word relative inline-block cursor-pointer rounded px-0.5 font-bold outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
    >
      <span aria-hidden className="inline-flex">
        {word.split("").map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            className={`transition-colors duration-200 ${
              lit ? "" : "text-inherit group-hover/word:text-[var(--rw)]"
            }`}
            style={
              {
                "--rw": palette.letters[i % palette.letters.length],
                ...(lit
                  ? {
                      color: palette.letters[i % palette.letters.length],
                    }
                  : null),
              } as CSSProperties
            }
          >
            {ch}
          </span>
        ))}
      </span>
      <span
        aria-hidden
        className={`pointer-events-none absolute left-[2%] right-[2%] -bottom-[0.08em] h-[0.035em] origin-left rounded-full transition-transform duration-300 ${
          lit ? "scale-x-100" : "scale-x-0 group-hover/word:scale-x-100"
        }`}
        style={{ backgroundImage: palette.underline }}
      />
    </button>
  );
}

function ProductWindow({
  src,
  alt,
  visible,
  chrome = true,
  className = "",
}: {
  src: string;
  alt: string;
  visible: boolean;
  chrome?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl bg-white shadow-[0_16px_48px_rgba(0,0,0,0.14)] ring-1 ring-black/5 transition-all duration-700 ease-out ${
        visible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-10 scale-[0.97] opacity-0"
      } ${className}`}
    >
      {chrome ? (
        <div className="flex h-10 items-center gap-2 border-b border-zinc-100 bg-zinc-50/90 px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-[11px] text-zinc-400 ring-1 ring-zinc-200/80">
            clauxen.com
          </span>
        </div>
      ) : null}
      {}
      <img
        src={src}
        alt={alt}
        className="block h-auto w-full"
        loading={chrome ? "lazy" : "eager"}
      />
    </div>
  );
}

export function OverviewExperience() {
  const [mode, setMode] = useState<ModeId>("chat");
  const [modesInView, setModesInView] = useState(false);
  const modesRef = useRef<HTMLElement | null>(null);
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  useEffect(() => {
    const el = modesRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setModesInView(true);
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="bg-[#f7f7f7] text-zinc-900">
      {/* Hero — large dock on matching page grey */}
      <section className="relative bg-[#f7f7f7] px-3 pb-2 pt-8 sm:px-4 sm:pt-10 lg:px-5">
        <div className="mx-auto max-w-[1320px] bg-[#f7f7f7] px-1 pb-4 pt-10 sm:px-2 sm:pb-6 sm:pt-14 lg:pt-16">
          <p className="mb-5 text-center text-sm font-medium tracking-wide text-zinc-500">
            Clauxen by {SITE.company}
          </p>
          <h1
            className="mx-auto max-w-[20ch] text-center text-[clamp(2.4rem,6.5vw,4.5rem)] font-bold leading-[1.05] tracking-[-0.045em] text-balance"
            aria-label="One workspace to chat, work, and code."
          >
            <span>One workspace to </span>
            <RainbowWord
              word="chat"
              mode="chat"
              active={mode === "chat"}
              onSelect={() => setMode("chat")}
            />
            <span>, </span>
            <RainbowWord
              word="work"
              mode="work"
              active={mode === "work"}
              onSelect={() => setMode("work")}
            />
            <span> &amp; </span>
            <RainbowWord
              word="code"
              mode="codex"
              active={mode === "codex"}
              onSelect={() => setMode("codex")}
            />
            <span>.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-center text-[17px] leading-relaxed text-zinc-600">
            Clauxen keeps conversation, deliverables, and coding agents in the
            same place — so you move from idea to finished work without
            switching tools.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href={SITE.login}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Start free
            </a>
            <a
              href="/download"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
            >
              Download the app
              <i className="bi bi-box-arrow-up-right text-[12px]" aria-hidden />
            </a>
          </div>

          {/* Large app window under CTAs */}
          <div className="mx-auto mt-10 w-full sm:mt-12">
            <ProductWindow
              src="/assets/marketing/overview-hero-app-window.png"
              alt="Clauxen workspace app window"
              visible
              chrome={false}
              className="shadow-[0_24px_64px_rgba(0,0,0,0.16)]"
            />
          </div>
        </div>
      </section>

      {/* Modes: accordion + pop-out product window */}
      <section
        ref={modesRef}
        className="relative px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] lg:items-start lg:gap-14">
          <div className="lg:sticky lg:top-24">
            {MODES.map((m) => {
              const isActive = m.id === mode;
              return (
                <div
                  key={m.id}
                  className="border-t border-zinc-300/70 first:border-t-0"
                >
                  <button
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`flex w-full items-center py-5 text-left transition-all duration-300 ${
                      isActive
                        ? "text-[1.35rem] font-semibold tracking-tight text-zinc-950"
                        : "text-[1.15rem] font-medium tracking-tight text-zinc-500 hover:text-zinc-800"
                    }`}
                    style={
                      isActive
                        ? undefined
                        : { transform: "scale(0.92)", transformOrigin: "left" }
                    }
                    aria-expanded={isActive}
                  >
                    {m.label}
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      isActive ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-3 pb-6 pr-2">
                        <p className="text-[15px] font-semibold leading-snug text-zinc-700">
                          {m.eyebrow}
                        </p>
                        <p className="text-[15px] leading-relaxed text-zinc-500">
                          {m.body}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative min-h-[280px]">
            {MODES.map((m) => (
              <div
                key={m.id}
                className={
                  m.id === mode ? "relative z-10" : "absolute inset-0 z-0"
                }
                aria-hidden={m.id !== mode}
              >
                <ProductWindow
                  src={m.image}
                  alt={m.imageAlt}
                  visible={modesInView && m.id === mode}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capability strip */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-medium tracking-tight text-balance">
            Built for the work that sits between thinking and shipping.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-zinc-600">
            Write, research, build, and automate — without leaving Clauxen.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Writing",
              body: "Shape rough notes into clear messaging, docs, and stories you can iterate on.",
            },
            {
              title: "Images",
              body: "Generate visuals, explore directions, and polish graphics for real use.",
            },
            {
              title: "Work",
              body: "Connect files and apps so finished decks, sheets, and briefs stay in context.",
            },
            {
              title: "Coding",
              body: "Debug, explain, and improve code with Codex sitting next to chat.",
            },
            {
              title: "Voice",
              body: "Talk through ideas when typing slows you down — brainstorm on the move.",
            },
            {
              title: "Planning",
              body: "Break big goals into steps, track decisions, and keep a shared trail of work.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="flex min-h-[160px] flex-col rounded-xl bg-white p-7 shadow-sm ring-1 ring-black/[0.04]"
            >
              <h3 className="text-[1.15rem] font-medium tracking-tight">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans band */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 rounded-2xl bg-white/70 px-8 py-10 ring-1 ring-black/[0.04] sm:flex-row sm:items-center sm:px-12">
          <div className="max-w-md">
            <h2 className="text-2xl font-medium tracking-tight">
              Plans for people and teams
            </h2>
            <p className="mt-2 text-zinc-600">
              Free to start. Upgrade when you need more depth, seats, and admin
              controls.
            </p>
          </div>
          <a
            href={SITE.plans}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-zinc-950 px-5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            See plans
            <i className="bi bi-arrow-right text-[14px]" aria-hidden />
          </a>
        </div>
      </section>

      {/* Safety */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-medium tracking-tight">
            Designed with your data in mind
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-zinc-600">
            Clauxen is built so you stay in control of privacy, retention, and
            how your workspace is shared.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-lg font-medium">Your controls</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Choose what is remembered, what is shared, and how long history
              stays available in your account.
            </p>
            <a
              href="/legal/privacy"
              className="mt-5 inline-flex min-h-9 items-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Privacy overview
            </a>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-lg font-medium">Safer by default</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Workspace safeguards and clear policies help teams and families
              use Clauxen with confidence.
            </p>
            <a
              href="/solutions/education"
              className="mt-5 inline-flex min-h-9 items-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Learn more
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 rounded-2xl bg-white px-8 py-12 shadow-sm ring-1 ring-black/[0.04] sm:flex-row sm:items-center sm:px-12">
          <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
            Try Clauxen today
          </h2>
          <a
            href="/download"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-zinc-950 px-5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Download app
            <i className="bi bi-arrow-right text-[14px]" aria-hidden />
          </a>
        </div>
      </section>
    </div>
  );
}
