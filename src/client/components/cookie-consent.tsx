"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ShieldCheck, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const CONSENT_KEY = "clauxen.cookie-consent.v1";
const CONSENT_COOKIE = "clauxen_cookie_consent";

type CookieConsentValue = {
  essential: true;
  performance: boolean;
  advertising: boolean;
  updatedAt: string;
};

function isConsentValue(value: unknown): value is CookieConsentValue {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CookieConsentValue>;
  return (
    candidate.essential === true &&
    typeof candidate.performance === "boolean" &&
    typeof candidate.advertising === "boolean" &&
    typeof candidate.updatedAt === "string"
  );
}

function readStoredConsent(): CookieConsentValue | null {
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (isConsentValue(parsed)) return parsed;
    }

    const prefix = `${CONSENT_COOKIE}=`;
    const encoded = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length);
    if (!encoded) return null;
    const parsed: unknown = JSON.parse(decodeURIComponent(encoded));
    return isConsentValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistConsent(
  performance: boolean,
  advertising: boolean,
): CookieConsentValue {
  const value: CookieConsentValue = {
    essential: true,
    performance,
    advertising,
    updatedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(value);
  try {
    window.localStorage.setItem(CONSENT_KEY, serialized);
  } catch {
    // The first-party cookie remains the persistence fallback.
  }
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(serialized)}; Path=/; Max-Age=31536000; SameSite=Lax${
    window.location.protocol === "https:" ? "; Secure" : ""
  }`;
  window.dispatchEvent(
    new CustomEvent("clauxen:cookie-consent", { detail: value }),
  );
  return value;
}

const secondaryButton =
  "inline-flex min-h-8 items-center justify-center rounded-full border border-black/15 bg-transparent px-3 text-[13px] font-medium text-zinc-800 transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20";
const primaryButton =
  "inline-flex min-h-8 items-center justify-center rounded-full bg-zinc-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 focus-visible:ring-offset-2";

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
    <div className="flex items-start justify-between gap-5 border-t border-black/[0.07] py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[14px] font-medium leading-5 text-zinc-900">
          {title}
        </p>
        <p className="mt-1 max-w-[390px] text-[12.5px] leading-5 text-zinc-500">
          {description}
        </p>
      </div>
      {locked ? (
        <span className="mt-0.5 shrink-0 rounded-full bg-zinc-900/[0.06] px-2 py-1 text-[11px] font-medium text-zinc-500">
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

export function CookieConsent() {
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<CookieConsentValue | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [performance, setPerformance] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    const stored = readStoredConsent();
    if (stored) {
      setConsent(stored);
      setPerformance(stored.performance);
      setAdvertising(stored.advertising);
    }
    setReady(true);
  }, []);

  const save = (nextPerformance: boolean, nextAdvertising: boolean) => {
    setPerformance(nextPerformance);
    setAdvertising(nextAdvertising);
    setConsent(persistConsent(nextPerformance, nextAdvertising));
    setSettingsOpen(false);
  };

  const openSettings = () => {
    setPerformance(consent?.performance ?? false);
    setAdvertising(consent?.advertising ?? false);
    setSettingsOpen(true);
  };

  if (!ready) return null;

  return (
    <>
      {!consent && !settingsOpen ? (
        <section
          role="dialog"
          aria-label="Cookie notice"
          aria-describedby="cookie-banner-desc"
          className="fixed right-3 bottom-3 z-[2147483646] w-[calc(100vw-1.5rem)] max-w-[528px] rounded-2xl border border-black/[0.06] bg-[#faf7f6] p-3.5 font-sans shadow-[0_0_30px_-5px_rgba(0,0,0,0.10),0_0_6px_-4px_rgba(0,0,0,0.10)] sm:right-4 sm:bottom-4"
        >
          <button
            type="button"
            onClick={() => save(false, false)}
            aria-label="Dismiss cookie notice"
            className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded text-zinc-900/45 transition-colors hover:bg-black/[0.04] hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
          >
            <X className="size-3.5" strokeWidth={1.7} />
          </button>

          <p
            id="cookie-banner-desc"
            className="pr-6 text-[13px] leading-[21px] text-zinc-900/60"
          >
            Essential cookies keep the site working and stay on. Optional
            cookies help with performance and advertising — accept, reject, or
            manage them. Learn more in our{" "}
            <a
              href="/legal/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-800 underline underline-offset-2"
            >
              Cookie Policy
            </a>
            ,{" "}
            <a
              href="/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-800 underline underline-offset-2"
            >
              Privacy Policy
            </a>
            , and{" "}
            <a
              href="/legal/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-800 underline underline-offset-2"
            >
              Terms of Service
            </a>
            .
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
                onClick={() => save(false, false)}
                className={secondaryButton}
              >
                Reject All
              </button>
              <button
                type="button"
                onClick={() => save(true, true)}
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
          <Dialog.Content className="fixed top-1/2 left-1/2 z-[2147483647] w-[calc(100vw-1.5rem)] max-w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-black/[0.08] bg-[#faf7f6] p-5 font-sans text-zinc-900 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:p-6">
            <div className="flex items-start gap-3 pr-8">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white">
                <ShieldCheck className="size-4" strokeWidth={1.8} />
              </span>
              <div>
                <Dialog.Title className="text-[18px] font-semibold leading-6 tracking-[-0.015em]">
                  Cookie settings
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[13px] leading-5 text-zinc-500">
                  Choose which optional cookies Clauxen may use. Essential
                  cookies cannot be disabled.
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close cookie settings"
                className="absolute top-4 right-4 inline-flex size-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-black/[0.05] hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
              >
                <X className="size-4" strokeWidth={1.7} />
              </button>
            </Dialog.Close>

            <div className="mt-6 rounded-2xl border border-black/[0.08] bg-white/60 p-4">
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
                onClick={() => save(false, false)}
                className={secondaryButton}
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() => save(performance, advertising)}
                className={secondaryButton}
              >
                Save choices
              </button>
              <button
                type="button"
                onClick={() => save(true, true)}
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
