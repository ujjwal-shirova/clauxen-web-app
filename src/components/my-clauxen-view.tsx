"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BookLock, Loader2 } from "lucide-react";
import { appPage } from "@/lib/app-page-chrome";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAppLayout } from "@/components/app-layout-context";
import { MobileMenuButton } from "@/components/mobile-menu-button";
import { ActivityHeatmap } from "@/components/my-clauxen/activity-heatmap";
import { SelfGrowthGraphic } from "@/components/my-clauxen/self-growth-graphic";
import { useToast } from "@/hooks/use-toast";

type TabId = "closeness" | "growth";

type MyClauxenData = {
  displayName: string;
  daysWithClauxen: number;
  chatCount: number;
  messageCount: number;
  streakDays: number;
  selfGrowthEnabled: boolean;
  selfGrowthEnabledAt: string | null;
  heatmap: { date: string; count: number }[];
  growth: {
    activeDays: number;
    totalMessages: number;
    peakDay: { date: string; count: number } | null;
    weeksActive: number;
  };
};

function ClauxenMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("h-9 w-9", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="clauxen-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#27272a" />
          <stop offset="100%" stopColor="#18181b" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#clauxen-mark)" />
      <circle cx="14.5" cy="18" r="2.6" fill="white" />
      <circle cx="25.5" cy="18" r="2.6" fill="white" />
    </svg>
  );
}

function StatStrong({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-zinc-900">{children}</span>;
}

export function MyClauxenView() {
  useDocumentTitle();
  const { openMobileNav, isSidebarCollapsed } = useAppLayout();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabId>("closeness");
  const [data, setData] = useState<MyClauxenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/v1/my-clauxen", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Couldn't load My Clauxen");
      }
      const json = (await res.json()) as {
        data?: { myClauxen?: MyClauxenData };
      };
      const next = json.data?.myClauxen;
      if (!next) throw new Error("Couldn't load My Clauxen");
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load My Clauxen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh after returning to the tab (messages may have landed).
  useEffect(() => {
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const setSelfGrowth = async (enabled: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/my-clauxen", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfGrowthEnabled: enabled }),
      });
      if (!res.ok) {
        throw new Error("Couldn't update self-growth");
      }
      const json = (await res.json()) as {
        data?: { myClauxen?: MyClauxenData };
      };
      if (json.data?.myClauxen) setData(json.data.myClauxen);
      toast({
        title: enabled ? "Self-growth enabled" : "Self-growth turned off",
        description: enabled
          ? "Clauxen will keep learning from how you work together."
          : "You can turn it back on anytime.",
      });
      if (enabled) setTab("growth");
    } catch (e) {
      toast({
        title: "Something went wrong",
        description:
          e instanceof Error ? e.message : "Couldn't update self-growth",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const titleName = data?.displayName?.trim() || "My";
  const pageTitle =
    titleName.toLowerCase() === "you" || titleName.toLowerCase() === "my"
      ? "My Clauxen"
      : `${titleName}'s Clauxen`;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white text-zinc-900">
      <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-3 sm:hidden">
        <MobileMenuButton onClick={openMobileNav} />
        <span className="text-[15px] font-semibold">My Clauxen</span>
      </div>

      <div
        className={cn(
          "mx-auto w-full max-w-[720px] flex-1 overflow-y-auto px-5 pb-16 pt-6 sm:px-8 sm:pt-10",
          isSidebarCollapsed ? "sm:pt-10" : "",
        )}
      >
        {loading && !data ? (
          <div className="flex h-64 items-center justify-center text-zinc-400">
            <Loader2 className="icon-2xl animate-spin" />
          </div>
        ) : error && !data ? (
          <div className="rounded-2xl bg-red-50 px-5 py-6 text-sm text-red-600">
            {error}
            <button
              type="button"
              className="ml-2 font-medium underline"
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3">
                  <ClauxenMark />
                </div>
                <h1 className={cn(appPage.title, "text-[28px] sm:text-[32px]")}>
                  {pageTitle}
                </h1>
                <p className="mt-2 max-w-[34rem] text-[14px] leading-relaxed text-zinc-500 sm:text-[15px]">
                  Clauxen has been with you for{" "}
                  <StatStrong>{data.daysWithClauxen}</StatStrong> days, chatted{" "}
                  <StatStrong>{data.messageCount}</StatStrong> times, and we&apos;ve
                  met <StatStrong>{data.streakDays}</StatStrong> days in a row
                  recently
                </p>
              </div>

              <button
                type="button"
                disabled={saving || data.selfGrowthEnabled}
                onClick={() => void setSelfGrowth(true)}
                className={cn(
                  "shrink-0 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors",
                  data.selfGrowthEnabled
                    ? "bg-zinc-100 text-zinc-500"
                    : appPage.primaryCta,
                  saving && "opacity-70",
                )}
              >
                {data.selfGrowthEnabled ? "Self-growth on" : "Enable self-growth"}
              </button>
            </header>

            {/* Tabs */}
            <div className="mt-8 flex items-center gap-1">
              {(
                [
                  { id: "closeness" as const, label: "Closeness" },
                  { id: "growth" as const, label: "Growth" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                    tab === item.id
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-800",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "closeness" ? (
              <section className="mt-5">
                <p className="mb-4 text-[13px] text-zinc-500">
                  The more you chat or assign tasks, the higher the intimacy
                </p>
                <ActivityHeatmap days={data.heatmap} />
              </section>
            ) : (
              <section className="mt-5">
                <p className="mb-4 text-[13px] text-zinc-500">
                  The higher your intimacy with Clauxen, the faster it grows
                </p>
                {data.selfGrowthEnabled ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <GrowthStat
                      label="Active days"
                      value={String(data.growth.activeDays)}
                    />
                    <GrowthStat
                      label="Messages this year"
                      value={String(data.growth.totalMessages)}
                    />
                    <GrowthStat
                      label="Weeks active"
                      value={String(data.growth.weeksActive)}
                    />
                    {data.growth.peakDay ? (
                      <div className="sm:col-span-3 rounded-2xl bg-zinc-50 px-5 py-4 text-[13px] text-zinc-600">
                        Peak day:{" "}
                        <span className="font-medium text-zinc-900">
                          {new Date(
                            `${data.growth.peakDay.date}T00:00:00.000Z`,
                          ).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </span>{" "}
                        with{" "}
                        <span className="font-medium text-zinc-900">
                          {data.growth.peakDay.count}
                        </span>{" "}
                        messages
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl bg-zinc-50 px-6 py-12 text-center">
                    <BookLock
                      className="mb-3 h-10 w-10 text-zinc-300"
                      strokeWidth={1.25}
                    />
                    <p className="text-[14px] text-zinc-500">
                      Self-growth isn&apos;t enabled yet.{" "}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void setSelfGrowth(true)}
                        className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                      >
                        Enable it
                      </button>
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Promo */}
            <section className="mt-14 flex flex-col items-start justify-between gap-8 border-t border-zinc-100 pt-10 sm:flex-row sm:items-center">
              <div className="max-w-md">
                <h2 className={cn(appPage.title, "text-[20px] sm:text-[22px]")}>
                  Clauxen can now learn and grow on its own
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
                  Once enabled, Clauxen keeps learning your preferences, habits,
                  and ways of working, making every collaboration the start of
                  the next one.
                </p>
                <button
                  type="button"
                  disabled={saving || data.selfGrowthEnabled}
                  onClick={() => void setSelfGrowth(true)}
                  className={cn(
                    "mt-5 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors",
                    data.selfGrowthEnabled
                      ? "bg-zinc-100 text-zinc-500"
                      : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200/80",
                  )}
                >
                  {data.selfGrowthEnabled
                    ? "Self-growth enabled"
                    : "Enable self-growth"}
                </button>
              </div>
              <SelfGrowthGraphic
                muted={!data.selfGrowthEnabled}
                className="mx-auto sm:mx-0"
              />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function GrowthStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-5 py-4">
      <div className="text-[22px] font-semibold tracking-tight text-zinc-900">
        {value}
      </div>
      <div className="mt-0.5 text-[12px] text-zinc-500">{label}</div>
    </div>
  );
}
