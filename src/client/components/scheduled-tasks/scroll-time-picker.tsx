"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

const ITEM_H = 36;
const VISIBLE = 5;

type ScrollTimePickerProps = {
  value: string; // HH:MM
  onChange: (value: string) => void;
  className?: string;
};

function snapIndex(scrollTop: number): number {
  return Math.max(0, Math.round(scrollTop / ITEM_H));
}

function WheelColumn({
  items,
  selected,
  onSelect,
  ariaLabel,
}: {
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ignoreScroll = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, items.indexOf(selected));
    ignoreScroll.current = true;
    el.scrollTop = idx * ITEM_H;
    requestAnimationFrame(() => {
      ignoreScroll.current = false;
    });
  }, [selected, items]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || ignoreScroll.current) return;
    const idx = Math.min(items.length - 1, snapIndex(el.scrollTop));
    const next = items[idx];
    if (next && next !== selected) onSelect(next);
  };

  const onScrollEnd = () => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.min(items.length - 1, snapIndex(el.scrollTop));
    ignoreScroll.current = true;
    el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
    const next = items[idx];
    if (next) onSelect(next);
    setTimeout(() => {
      ignoreScroll.current = false;
    }, 180);
  };

  return (
    <div
      className="relative h-[180px] w-[72px] overflow-hidden"
      aria-label={ariaLabel}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-1 top-1/2 z-[1] h-9 -translate-y-1/2 rounded-lg bg-black/[0.05]"
      />
      <div
        ref={ref}
        onScroll={onScroll}
        onMouseUp={onScrollEnd}
        onTouchEnd={onScrollEnd}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          paddingTop: ITEM_H * Math.floor(VISIBLE / 2),
          paddingBottom: ITEM_H * Math.floor(VISIBLE / 2),
        }}
      >
        {items.map((item) => {
          const active = item === selected;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "flex h-9 w-full snap-center items-center justify-center text-[16px] tabular-nums transition-colors",
                active ? "font-medium text-zinc-900" : "text-zinc-400",
              )}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScrollTimePicker({
  value,
  onChange,
  className,
}: ScrollTimePickerProps) {
  const [hh, mmRaw] = (value || "09:00").split(":");
  const hour = HOURS.includes(hh) ? hh : "09";
  // Snap minutes to nearest 5
  const minuteNum = Math.round(Number(mmRaw || "0") / 5) * 5;
  const minute = String(Math.min(55, minuteNum)).padStart(2, "0");

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl border border-black/[0.06] bg-white px-3 py-2 shadow-sm",
        className,
      )}
    >
      <WheelColumn
        items={HOURS}
        selected={hour}
        ariaLabel="Hour"
        onSelect={(h) => onChange(`${h}:${minute}`)}
      />
      <span className="pb-0.5 text-[16px] font-medium text-zinc-400">:</span>
      <WheelColumn
        items={MINUTES}
        selected={MINUTES.includes(minute) ? minute : "00"}
        ariaLabel="Minute"
        onSelect={(m) => onChange(`${hour}:${m}`)}
      />
    </div>
  );
}
