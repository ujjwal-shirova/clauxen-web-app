"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import * as cookiesApi from "@/lib/api/cookies";
import {
  DEFAULT_OPTIONAL_COOKIES,
  OPEN_COOKIE_SETTINGS_EVENT,
  applyOptionalBrowserCookies,
  createConsentValue,
  parseUtmAttribution,
  readBrowserConsent,
  readBrowserUtm,
  writeBrowserConsent,
  type CookieConsentSource,
  type CookieConsentValue,
} from "@/lib/cookie-consent";

const secondaryButton =
  "inline-flex min-h-8 items-center justify-center rounded-full border border-[var(--ui-border)] bg-transparent px-3 text-[13px] font-medium text-[var(--ui-fg)] transition-colors hover:bg-[var(--ui-hover-wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]";
const primaryButton =
  "inline-flex min-h-8 items-center justify-center rounded-full bg-[var(--ui-fg)] px-3.5 text-[13px] font-medium text-[var(--app-panel-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] focus-visible:ring-offset-2";

function PreferenceRow({
  title,
  description,
  checked,
  onCheckedChange,
  locked = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-5 border-t border-[var(--ui-border-subtle)] py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[14px] font-medium leading-5 text-[var(--ui-fg)]">
          {title}
        </p>
        <p className="mt-1 max-w-[390px] text-[12.5px] leading-5 text-[var(--ui-fg-muted)]">
          {description}
        </p>
      </div>
      {locked ? (
        <span className="mt-0.5 shrink-0 rounded-full bg-[var(--ui-hover-wash)] px-2 py-1 text-[11px] font-medium text-[var(--ui-fg-subtle)]">
          Always on
        </span>
      ) : (
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label={`Allow ${title.toLowerCase()}`}
          className="mt-0.5"
        />
      )}
    </div>
  );
}

function persistLocally(value: CookieConsentValue) {
  writeBrowserConsent(value);
  applyOptionalBrowserCookies(value);
}

async function persistConsent(
  performance: boolean,
  advertising: boolean,
  source: CookieConsentSource,
): Promise<CookieConsentValue> {
  const value = createConsentValue(performance, advertising);
  persistLocally(value);
  try {
    const utm = advertising
      ? (parseUtmAttribution(window.location.search) ?? readBrowserUtm())
      : null;
    const saved = await cookiesApi.saveCookieConsent({
      performance,
      advertising,
      source,
      utm,
    });
    if (saved.consent) {
      persistLocally(saved.consent);
      return saved.consent;
    }
  } catch {
    // Local cookies still gate collection for this browser.
  }
  return value;
}

export function CookieConsent() {
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [consent, setConsent] = useState<CookieConsentValue | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [performance, setPerformance] = useState(DEFAULT_OPTIONAL_COOKIES);
  const [advertising, setAdvertising] = useState(DEFAULT_OPTIONAL_COOKIES);

  useEffect(() => {
    const stored = readBrowserConsent();
    if (stored) {
      setConsent(stored);
      setPerformance(stored.performance);
      setAdvertising(stored.advertising);
      applyOptionalBrowserCookies(stored);
    }
    setReady(true);

    let cancelled = false;
    void cookiesApi
      .getCookieConsent()
      .then(async (data) => {
        if (cancelled) return;
        if (data.consent) {
          const localIsNewer =
            stored &&
            Date.parse(stored.updatedAt) > Date.parse(data.consent.updatedAt);
          const resolved = localIsNewer
            ? await persistConsent(
                stored.performance,
                stored.advertising,
                "settings",
              )
            : data.consent;
          if (cancelled) return;
          persistLocally(resolved);
          setConsent(resolved);
          setPerformance(resolved.performance);
          setAdvertising(resolved.advertising);
          return;
        }
        if (stored) {
          await persistConsent(
            stored.performance,
            stored.advertising,
            "settings",
          );
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const open = () => {
      setPerformance(consent?.performance ?? DEFAULT_OPTIONAL_COOKIES);
      setAdvertising(consent?.advertising ?? DEFAULT_OPTIONAL_COOKIES);
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, [consent]);

  useEffect(() => {
    if (!ready || consent) {
      setEntered(false);
      return;
    }
    const id = window.setTimeout(() => setEntered(true), 520);
    return () => window.clearTimeout(id);
  }, [ready, consent]);

  const save = (
    nextPerformance: boolean,
    nextAdvertising: boolean,
    source: CookieConsentSource,
  ) => {
    setPerformance(nextPerformance);
    setAdvertising(nextAdvertising);
    setSettingsOpen(false);
    const value = createConsentValue(nextPerformance, nextAdvertising);
    persistLocally(value);
    setConsent(value);
    void persistConsent(nextPerformance, nextAdvertising, source).then(
      (saved) => {
        setConsent(saved);
        setPerformance(saved.performance);
        setAdvertising(saved.advertising);
      },
    );
  };

  const openSettings = () => {
    setPerformance(consent?.performance ?? DEFAULT_OPTIONAL_COOKIES);
    setAdvertising(consent?.advertising ?? DEFAULT_OPTIONAL_COOKIES);
    setSettingsOpen(true);
  };

  if (!ready) return null;

  return (
    <>
      {!consent && !settingsOpen && entered ? (
        <section
          role="dialog"
          aria-label="Cookie notice"
          aria-describedby="cookie-banner-desc"
          className="cookie-notice fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-[2147483646] w-[min(400px,calc(100vw-1.5rem))] rounded-2xl border border-[var(--ui-border)] bg-[var(--app-panel-bg)] p-3.5 font-sans text-[var(--ui-fg)] shadow-[0_16px_40px_-18px_rgba(20,21,26,0.28),0_0_0_1px_rgba(20,21,26,0.04)] sm:bottom-4 sm:left-4"
        >
          <button
            type="button"
            onClick={() => save(false, false, "dismiss")}
            aria-label="Dismiss cookie notice"
            className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded text-[var(--ui-fg-subtle)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
          >
            <X className="size-3.5" strokeWidth={1.7} />
          </button>

          <p
            id="cookie-banner-desc"
            className="pr-6 text-[13px] leading-[21px] text-[var(--ui-fg-muted)]"
          >
            Essential cookies stay on so Clauxen can sign you in. Optional
            cookies measure performance and advertising.{" "}
            <a
              href="/legal/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--ui-fg)] underline underline-offset-2"
            >
              Cookie Policy
            </a>
          </p>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={openSettings}
              className={secondaryButton}
            >
              Cookie Settings
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => save(false, false, "reject_all")}
                className={secondaryButton}
              >
                Reject All
              </button>
              <button
                type="button"
                onClick={() => save(true, true, "accept_all")}
                className={primaryButton}
              >
                Accept All Cookies
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[2147483646] bg-black/35 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-[2147483647] w-[calc(100vw-1.5rem)] max-w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[var(--ui-border)] bg-[var(--app-panel-bg)] p-5 font-sans text-[var(--ui-fg)] shadow-[var(--settings-modal-shadow)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:p-6">
            <div className="pr-8">
              <Dialog.Title className="text-[18px] font-semibold leading-6 tracking-[-0.015em]">
                Cookie settings
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[13px] leading-5 text-[var(--ui-fg-muted)]">
                Choose which optional cookies Clauxen may use. Essential cookies
                stay on.
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close cookie settings"
                className="absolute top-4 right-4 inline-flex size-7 items-center justify-center rounded-lg text-[var(--ui-fg-subtle)] transition-colors hover:bg-[var(--ui-hover-wash)] hover:text-[var(--ui-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)]"
              >
                <X className="size-4" strokeWidth={1.7} />
              </button>
            </Dialog.Close>

            <div className="mt-6 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-field-bg)] p-4">
              <PreferenceRow
                title="Essential cookies"
                description="Required for authentication, security, saved preferences, and core app functionality."
                checked
                locked
              />
              <PreferenceRow
                title="Performance cookies"
                description="Help us understand reliability and improve how quickly Clauxen responds."
                checked={performance}
                onCheckedChange={setPerformance}
              />
              <PreferenceRow
                title="Advertising cookies"
                description="Allow measurement and personalization of Clauxen marketing outside the app."
                checked={advertising}
                onCheckedChange={setAdvertising}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => save(false, false, "reject_all")}
                className={secondaryButton}
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() => save(performance, advertising, "settings")}
                className={secondaryButton}
              >
                Save choices
              </button>
              <button
                type="button"
                onClick={() => save(true, true, "accept_all")}
                className={primaryButton}
              >
                Accept all
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
