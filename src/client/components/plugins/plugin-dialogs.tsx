"use client";

import { useState } from "react";
import { appBtn } from "@/lib/app-buttons";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stripCursorText } from "./plugin-copy";
import { PluginAddButton } from "./plugin-card";
import { PluginMark } from "./plugin-mark";
import type { MarketplacePlugin } from "./types";

type PluginDetailDialogProps = {
  plugin: MarketplacePlugin | null;
  added: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (id: string) => void;
};

export function PluginDetailDialog({
  plugin,
  added,
  onOpenChange,
  onToggle,
}: PluginDetailDialogProps) {
  return (
    <Dialog open={plugin !== null} onOpenChange={onOpenChange}>
      <DialogContent className="plugin-marketplace max-w-[420px]">
        {plugin ? (
          <>
            <DialogHeader>
              <PluginMark
                name={stripCursorText(plugin.name) || plugin.name}
                iconUrl={plugin.iconUrl}
                size={48}
              />
              <DialogTitle className="mt-3">
                {stripCursorText(plugin.name) || plugin.name}
              </DialogTitle>
              <DialogDescription>
                {stripCursorText(plugin.author)
                  ? `${stripCursorText(plugin.category)} · ${stripCursorText(plugin.author)}`
                  : stripCursorText(plugin.category)}
              </DialogDescription>
            </DialogHeader>
            <p className="text-[13px] leading-5 text-[var(--ui-fg-body)]">
              {stripCursorText(plugin.description) || "No description for this plugin yet."}
            </p>
            <DialogFooter>
              <PluginAddButton
                added={added}
                name={stripCursorText(plugin.name) || plugin.name}
                onToggle={() => onToggle(plugin.id)}
              />
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type AddMarketplaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: { name: string; url: string }) => void;
};

export function AddMarketplaceDialog({
  open,
  onOpenChange,
  onAdd,
}: AddMarketplaceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="plugin-marketplace max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add marketplace</DialogTitle>
          <DialogDescription>
            Connect another plugin source. It shows up as its own tab next to Marketplace.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AddMarketplaceForm
            onCancel={() => onOpenChange(false)}
            onAdd={(input) => {
              onAdd(input);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddMarketplaceForm({
  onCancel,
  onAdd,
}: {
  onCancel: () => void;
  onAdd: (input: { name: string; url: string }) => void;
}) {
  const [error, setError] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name") || "").trim();
        const url = String(data.get("url") || "").trim();
        if (!name) {
          setError("Enter a marketplace name.");
          return;
        }
        if (url) {
          try {
            const parsed = new URL(url);
            if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
              setError("Enter an http or https URL.");
              return;
            }
          } catch {
            setError("Enter an http or https URL.");
            return;
          }
        }
        setError("");
        onAdd({ name, url });
      }}
    >
      <label className="block">
        <span className="cx-label">Name</span>
        <input
          name="name"
          required
          maxLength={48}
          autoFocus
          placeholder="Team marketplace"
          className="cx-field"
        />
      </label>
      <label className="block">
        <span className="cx-label">URL</span>
        <input
          name="url"
          type="url"
          inputMode="url"
          placeholder="https://"
          className="cx-field"
        />
      </label>
      {error ? (
        <p className="text-[12.5px] leading-[18px] text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={cn(appBtn.secondarySm, "px-2.5")}>
          Cancel
        </button>
        <button type="submit" className={cn(appBtn.primarySm, "px-2.5")}>
          Add
        </button>
      </div>
    </form>
  );
}
