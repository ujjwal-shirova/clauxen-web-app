"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Mic,
  Search,
} from "@/components/icons/app-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { UseDictationReturn } from "@/features/dictation/use-dictation";
import { DICTATION_LANGUAGES } from "@/shared/lib/dictation-languages";
import { cn } from "@/lib/utils";

export function DictationControls({
  dictation,
  canOpen,
}: {
  dictation: UseDictationReturn;
  canOpen?: () => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listening = dictation.status === "listening";
  const processing = dictation.status === "processing";
  const connecting = dictation.status === "connecting";
  const selectedLanguage = DICTATION_LANGUAGES.find(
    (language) => language.code === dictation.languageCode,
  );
  const languages = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return DICTATION_LANGUAGES;
    return DICTATION_LANGUAGES.filter((language) =>
      language.label.toLocaleLowerCase().includes(query),
    );
  }, [search]);

  const setPopoverOpen = (next: boolean) => {
    setOpen(next);
    if (next) void dictation.refreshDevices();
    if (!next) {
      setLanguageOpen(false);
      setSearch("");
    }
  };

  return (
    <Popover open={open} onOpenChange={setPopoverOpen}>
      <div
        className="dictation-trigger-group"
        data-listening={listening || undefined}
      >
        <button
          type="button"
          disabled={connecting || processing}
          aria-label={
            connecting
              ? "Starting dictation"
              : processing
                ? "Transcribing dictation"
                : listening
                  ? "Finish dictation"
                  : "Dictate"
          }
          title={listening ? "Finish dictation" : "Dictate"}
          aria-pressed={listening}
          aria-busy={connecting || processing || undefined}
          onClick={() => {
            if (listening) {
              void dictation.submit();
              return;
            }
            if (canOpen && !canOpen()) return;
            void dictation.start();
          }}
          className="dictation-mic-button"
        >
          {connecting || processing ? (
            <LoaderCircle className="size-[18px] animate-spin" />
          ) : listening ? (
            <Check className="size-[18px]" strokeWidth={2.25} />
          ) : (
            <Mic className="size-[19px]" />
          )}
        </button>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={processing}
            aria-label="Dictation settings"
            aria-expanded={open}
            title="Dictation settings"
            className="dictation-settings-trigger"
          >
            <ChevronDown className="size-3" strokeWidth={2} />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        collisionPadding={16}
        className="dictation-popover z-[130] w-[min(360px,calc(100vw-24px))] overflow-visible rounded-[22px] border border-black/[0.08] bg-white p-3 text-zinc-900 shadow-[0_18px_55px_rgba(20,21,26,0.14),0_2px_8px_rgba(20,21,26,0.06)] dark:border-white/[0.1] dark:bg-zinc-900 dark:text-zinc-100"
      >
        <div className="flex items-center gap-3 px-2 pb-3 pt-1">
          <Mic className="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <div
            className="dictation-level-track"
            role="meter"
            aria-label="Microphone input level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(dictation.audioLevel * 100)}
          >
            <span
              style={{ width: `${Math.round(dictation.audioLevel * 100)}%` }}
            />
          </div>
        </div>

        <div className="max-h-[168px] overflow-y-auto">
          {dictation.devices.length ? (
            dictation.devices.map((device) => (
              <button
                key={device.deviceId}
                type="button"
                disabled={dictation.isActive}
                onClick={() => dictation.selectDevice(device.deviceId)}
                className="dictation-menu-row"
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {device.label}
                </span>
                {dictation.selectedDeviceId === device.deviceId ? (
                  <Check
                    className="size-[18px] shrink-0 text-[#3a83f7]"
                    strokeWidth={2}
                  />
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-[13px] text-zinc-500">
              Microphone devices appear after permission is granted.
            </p>
          )}
        </div>

        <div className="mx-1 my-2 h-px bg-black/[0.07] dark:bg-white/[0.08]" />
        <p className="px-3 pb-1 pt-1 text-[14px] leading-6 text-zinc-500 dark:text-zinc-400">
          Dictation settings
        </p>
        <button
          type="button"
          aria-expanded={languageOpen}
          onClick={() => setLanguageOpen((current) => !current)}
          className={cn(
            "dictation-menu-row",
            languageOpen && "bg-black/[0.045] dark:bg-white/[0.06]",
          )}
        >
          <span className="flex-1 text-left">Language</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {selectedLanguage?.label ?? "Auto"}
          </span>
          <ChevronRight className="size-4 text-zinc-400" />
        </button>

        {languageOpen ? (
          <div className="dictation-language-panel">
            <div className="dictation-language-search">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  setLanguageOpen(false);
                  setSearch("");
                }}
                placeholder="Search languages"
                aria-label="Search dictation languages"
                className="h-10 w-full bg-transparent pl-9 pr-3 text-[14px] outline-none placeholder:text-zinc-400"
              />
            </div>
            <div className="max-h-[min(480px,60vh)] overflow-y-auto p-1.5">
              <button
                type="button"
                onClick={() => {
                  dictation.selectLanguage("auto");
                  setLanguageOpen(false);
                  setSearch("");
                }}
                className="dictation-language-row"
              >
                <span>Auto</span>
                {dictation.languageCode === "auto" ? (
                  <Check
                    className="size-[18px] text-[#3a83f7]"
                    strokeWidth={2}
                  />
                ) : null}
              </button>
              {languages.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => {
                    dictation.selectLanguage(language.code);
                    setLanguageOpen(false);
                    setSearch("");
                  }}
                  className="dictation-language-row"
                >
                  <span>{language.label}</span>
                  {dictation.languageCode === language.code ? (
                    <Check
                      className="size-[18px] text-[#3a83f7]"
                      strokeWidth={2}
                    />
                  ) : null}
                </button>
              ))}
              {!languages.length ? (
                <p className="px-3 py-6 text-center text-[13px] text-zinc-500">
                  No languages found
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
