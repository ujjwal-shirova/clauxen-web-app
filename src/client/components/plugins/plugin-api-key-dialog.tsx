"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { chrome } from "@/lib/app-chrome";
import { cn } from "@/lib/utils";

export function PluginApiKeyDialog({
  open,
  pluginName,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  pluginName: string;
  pending: boolean;
  error: string | null;
  onSubmit: (apiKey: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open ]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(chrome.overlay.panel, "sm:max-w-[420px]")}>
        <DialogHeader>
          <DialogTitle>API key</DialogTitle>
          <DialogDescription>
            {pluginName} needs a key to connect.
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim() && !pending) {
              onSubmit(value.trim());
            }
          }}
          placeholder="Paste key"
          aria-label="API key"
          className="app-page-search !pl-3 outline-none"
        />
        {error ? (
          <p className="text-[13px] leading-5 text-[var(--settings-danger)]">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={chrome.btn.ghost}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !value.trim()}
            onClick={() => onSubmit(value.trim())}
            className={cn(chrome.btn.primary, "gap-1.5")}
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            Connect
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
