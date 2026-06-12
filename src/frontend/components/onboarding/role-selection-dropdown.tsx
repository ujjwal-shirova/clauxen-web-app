"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/frontend/lib/utils";

export const ONBOARDING_ROLES = [
  "Product management",
  "Software engineer",
  "Engineering",
  "Human resources",
  "Finance",
  "Marketing",
  "Sales",
  "Operations",
  "Data science",
  "Design",
  "Scientist",
  "Legal",
  "Student",
  "Founder",
] as const;

type RoleSelectionDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRect: DOMRect | null;
  value: string;
  onSelect: (role: string) => void;
};

export function RoleSelectionDropdown({
  open,
  onOpenChange,
  anchorRect,
  value,
  onSelect,
}: RoleSelectionDropdownProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...ONBOARDING_ROLES];
    return ONBOARDING_ROLES.filter((r) => r.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || !anchorRect || typeof document === "undefined") {
    return null;
  }

  const width = Math.min(450, Math.max(anchorRect.width, 280));
  const left = Math.min(
    Math.max(8, anchorRect.left + anchorRect.width / 2 - width / 2),
    window.innerWidth - width - 8,
  );
  const top = anchorRect.bottom + 8;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-transparent"
        aria-label="Close role menu"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        className="fixed z-50 flex max-h-[min(325px,70vh)] min-w-[192px] flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-3xl"
        style={{ left, top, width }}
      >
        <div className="p-1.5">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles…"
            className="h-8 w-full rounded-md bg-zinc-100 px-2 text-sm text-zinc-700 outline-none placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-[#2977d6]/30"
            autoComplete="off"
          />
        </div>
        <div
          className="max-h-[260px] overflow-y-auto px-1.5 pb-1.5"
          role="listbox"
        >
          {filtered.map((role) => (
            <button
              key={role}
              type="button"
              role="option"
              aria-selected={value === role}
              onClick={() => {
                onSelect(role);
                onOpenChange(false);
              }}
              className={cn(
                "flex min-h-8 w-full cursor-pointer items-center rounded-lg px-2 py-1.5 text-left text-sm font-medium text-zinc-700 transition-colors",
                "hover:bg-zinc-100",
                value === role && "bg-zinc-100",
              )}
            >
              {role}
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-zinc-500">
              No roles found
            </p>
          ) : null}
        </div>
      </div>
    </>,
    document.body,
  );
}
