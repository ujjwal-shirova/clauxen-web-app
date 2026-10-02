"use client";

import * as React from "react";

import { KbdCombo } from "@/components/ui/kbd";
import { comboFromEvent, describeShortcut } from "@/lib/keyboard-shortcuts-defaults";
import { cn } from "@/lib/utils";

/**
 * "Press keys" recorder used in Settings → Shortcuts. Click (or focus and press
 * Enter/Space), then press the desired key combination. Esc cancels.
 */
export function ShortcutRecorder({
  keys,
  onChange,
  label,
  className,
}: {
  keys: string[];
  onChange: (keys: string[]) => void;
  label: string;
  className?: string;
}) {
  const [recording, setRecording] = React.useState(false);

  React.useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording(false);
        return;
      }
      const combo = comboFromEvent(event);
      if (!combo) return;
      onChange(combo);
      setRecording(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onChange]);

  return (
    <button
      type="button"
      className={cn("cx-shortcut-recorder", className)}
      data-recording={recording || undefined}
      aria-label={
        recording
          ? `Press keys for ${label}, Escape to cancel`
          : `Change shortcut for ${label}, currently ${describeShortcut(keys)}`
      }
      onClick={() => setRecording((value) => !value)}
    >
      {recording ? (
        <span className="text-[11.5px] font-medium text-[var(--ui-fg-muted)]">
          Press keys…
        </span>
      ) : (
        <KbdCombo keys={keys} size="sm" ariaLabel={describeShortcut(keys)} />
      )}
    </button>
  );
}
