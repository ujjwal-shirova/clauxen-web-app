"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type HeatmapDay = {
  date: string;
  count: number;
};

const LEVEL_COLORS = [
  "bg-[#ebedf0]",
  "bg-[#9ecbff]",
  "bg-[#5aadff]",
  "bg-[#2f8fff]",
  "bg-[#0b6efd]",
] as const;

function levelForCount(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 1) return 3;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function parseUtc(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
}

function formatMonthLabel(dateStr: string): string {
  return parseUtc(dateStr).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

function formatTooltip(dateStr: string, count: number): string {
  const label = parseUtc(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  if (count <= 0) return `${label} — no messages`;
  if (count === 1) return `${label} sent 1 message`;
  return `${label} sent ${count} messages`;
}

type Props = {
  days: HeatmapDay[];
  className?: string;
};

export function ActivityHeatmap({ days, className }: Props) {
  const [hover, setHover] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const { weeks, monthLabels, maxCount } = useMemo(() => {
    const max = days.reduce((m, d) => Math.max(m, d.count), 0);
    const weekCols: HeatmapDay[][] = [];
    let current: HeatmapDay[] = [];

    for (const day of days) {
      const dow = parseUtc(day.date).getUTCDay();
      if (current.length === 0 && dow !== 0) {
        // Pad leading empty cells so the first week aligns to Sunday.
        for (let i = 0; i < dow; i += 1) {
          current.push({ date: "", count: -1 });
        }
      }
      current.push(day);
      if (current.length === 7) {
        weekCols.push(current);
        current = [];
      }
    }
    if (current.length > 0) {
      while (current.length < 7) {
        current.push({ date: "", count: -1 });
      }
      weekCols.push(current);
    }

    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = "";
    weekCols.forEach((week, weekIndex) => {
      const firstReal = week.find((d) => d.date);
      if (!firstReal?.date) return;
      const month = formatMonthLabel(firstReal.date);
      if (month !== lastMonth) {
        labels.push({ weekIndex, label: month });
        lastMonth = month;
      }
    });

    return { weeks: weekCols, monthLabels: labels, maxCount: max };
  }, [days]);

  return (
    <div className={cn("relative w-full overflow-x-auto", className)}>
      <div className="inline-block min-w-full">
        <div
          className="mb-1.5 grid gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
        >
          {weeks.map((_, weekIndex) => {
            const month = monthLabels.find((m) => m.weekIndex === weekIndex);
            return (
              <div
                key={`m-${weekIndex}`}
                className="h-4 text-[11px] leading-none text-zinc-400"
              >
                {month?.label ?? ""}
              </div>
            );
          })}
        </div>

        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
          }}
          onMouseLeave={() => setHover(null)}
        >
          {weeks.map((week, weekIndex) => (
            <div key={`w-${weekIndex}`} className="grid grid-rows-7 gap-[3px]">
              {week.map((day, dayIndex) => {
                if (!day.date || day.count < 0) {
                  return (
                    <div
                      key={`e-${weekIndex}-${dayIndex}`}
                      className="aspect-square rounded-[3px] bg-transparent"
                    />
                  );
                }
                const level = levelForCount(day.count, maxCount);
                return (
                  <button
                    key={day.date}
                    type="button"
                    aria-label={formatTooltip(day.date, day.count)}
                    className={cn(
                      "aspect-square rounded-[3px] transition-transform duration-150",
                      LEVEL_COLORS[level],
                      "hover:scale-110 hover:ring-1 hover:ring-zinc-300/80",
                    )}
                    onMouseEnter={(e) => {
                      const rect = (
                        e.currentTarget as HTMLButtonElement
                      ).getBoundingClientRect();
                      const parent = (
                        e.currentTarget.closest(
                          ".relative",
                        ) as HTMLElement | null
                      )?.getBoundingClientRect();
                      setHover({
                        date: day.date,
                        count: day.count,
                        x: rect.left - (parent?.left ?? 0) + rect.width / 2,
                        y: rect.top - (parent?.top ?? 0) - 8,
                      });
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {hover ? (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md bg-zinc-700 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-md"
          style={{ left: hover.x, top: hover.y }}
        >
          {formatTooltip(hover.date, hover.count)}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-700" />
        </div>
      ) : null}
    </div>
  );
}
