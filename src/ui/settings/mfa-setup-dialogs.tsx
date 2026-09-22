"use client";

import * as React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronDown } from "lucide-react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import {
  PHONE_COUNTRIES,
  type PhoneCountry,
  flagEmoji,
} from "@/lib/phone-countries";

/* -------------------------------------------------------------------------
 * Authenticator App Dialog (Image 2)
 * ------------------------------------------------------------------------- */

interface AuthenticatorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  userEmail?: string;
}

export function AuthenticatorSetupDialog({
  open,
  onOpenChange,
  onSuccess,
  userEmail = "user@clauxen.com",
}: AuthenticatorSetupDialogProps) {
  const [code, setCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showSecret, setShowSecret] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a mock base32 TOTP secret and QR code on open
  const secret = useMemo(() => "JBSWY3DPEHPK3PXP", []);

  useEffect(() => {
    if (!open) {
      setCode("");
      setError(null);
      setShowSecret(false);
      return;
    }

    const otpauthUrl = `otpauth://totp/Clauxen:${encodeURIComponent(
      userEmail,
    )}?secret=${secret}&issuer=Clauxen`;

    QRCode.toDataURL(otpauthUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => {
        console.error("QR Code generation error:", err);
      });
  }, [open, userEmail, secret]);

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = code.trim().replace(/\D/g, "");
    if (clean.length !== 6) {
      setError("Please enter a valid 6-digit verification code");
      return;
    }
    setVerifying(true);
    setError(null);

    // Simulate verification
    setTimeout(() => {
      setVerifying(false);
      onSuccess?.();
      onOpenChange(false);
    }, 600);
  };

  const isComplete = code.trim().replace(/\D/g, "").length === 6;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-nested-settings-dialog=""
          className="fixed inset-0 z-[220] bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[221] w-[min(calc(100vw-2rem),430px)] translate-x-[-50%] translate-y-[-50%]",
            "rounded-[22px] border border-black/[0.08] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.18)] outline-none duration-150",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "dark:border-white/10 dark:bg-[#1a1a1a] text-zinc-900 dark:text-zinc-100",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-100">
              Connect your authenticator app
            </h2>
            <DialogPrimitive.Close className="ui-icon-button -mr-1.5 -mt-1.5 h-8 w-8 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            {/* Step 1 */}
            <div>
              <p className="text-[13px] leading-5 text-zinc-700 dark:text-zinc-300">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Step 1:
                </span>{" "}
                Scan the QR code using your authenticator app, then enter the
                6-digit code from the app.
              </p>

              {/* QR Container */}
              <div className="mt-4 flex flex-col items-center justify-center rounded-[18px] border border-zinc-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] dark:border-zinc-800 dark:bg-zinc-900">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="Authenticator QR Code"
                    className="h-48 w-48 rounded-lg object-contain"
                  />
                ) : (
                  <div className="h-48 w-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                )}

                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="clickable-label cursor-pointer mt-3.5 text-[13px] font-medium text-[#2563eb] hover:underline dark:text-blue-400"
                >
                  {showSecret ? "Hide key" : "Trouble scanning?"}
                </button>

                {showSecret && (
                  <div className="mt-2.5 w-full rounded-lg bg-zinc-50 p-2 text-center text-xs font-mono select-all text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {secret}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 */}
            <div>
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                Step 2: <span className="font-normal text-zinc-700 dark:text-zinc-300">Enter your 6-digit code</span>
              </p>

              <div className="mt-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  placeholder="Enter your 6-digit code"
                  className={cn(
                    "h-11 w-full rounded-[10px] border border-zinc-200 bg-white px-3.5 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors",
                    "focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10",
                    "dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                    error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
                  )}
                />
                {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="cursor-pointer inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-[13px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isComplete || verifying}
                className={cn(
                  "cursor-pointer inline-flex h-9 items-center justify-center rounded-full px-5 text-[13px] font-medium text-white transition-all",
                  isComplete && !verifying
                    ? "bg-[#18181b] hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    : "bg-[#b5b5b5] text-white opacity-80 cursor-not-allowed",
                )}
              >
                {verifying ? "Verifying…" : "Verify"}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------
 * Phone Number SMS/WhatsApp Dialog (Image 3)
 * ------------------------------------------------------------------------- */

interface PhoneSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (phone: string) => void;
}

export function PhoneSetupDialog({
  open,
  onOpenChange,
  onSuccess,
}: PhoneSetupDialogProps) {
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry>(() => {
    return (
      PHONE_COUNTRIES.find((c) => c.iso === "US" && c.dial === "1") ||
      PHONE_COUNTRIES[0]
    );
  });
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [verificationCode, setVerificationCode] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setPhoneNumber("");
      setDropdownOpen(false);
      setCountrySearch("");
      setSending(false);
      setStep("phone");
      setVerificationCode("");
    }
  }, [open]);

  // Click outside to close country dropdown
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
        setCountrySearch("");
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [dropdownOpen]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        `+${c.dial}`.includes(q),
    );
  }, [countrySearch]);

  const cleanDigits = phoneNumber.replace(/\D/g, "");
  const canSend = cleanDigits.length >= 7;

  const handleSendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setStep("code");
    }, 500);
  };

  const handleVerifyCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanCode = verificationCode.replace(/\D/g, "");
    if (cleanCode.length !== 6) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      onSuccess?.(`+${selectedCountry.dial}${cleanDigits}`);
      onOpenChange(false);
    }, 500);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-nested-settings-dialog=""
          className="fixed inset-0 z-[220] bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[221] w-[min(calc(100vw-2rem),430px)] translate-x-[-50%] translate-y-[-50%]",
            "rounded-[22px] border border-black/[0.08] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.18)] outline-none duration-150",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "dark:border-white/10 dark:bg-[#1a1a1a] text-zinc-900 dark:text-zinc-100",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-100">
              {step === "phone" ? "Enter your phone number" : "Enter verification code"}
            </h2>
            <DialogPrimitive.Close className="ui-icon-button -mr-1.5 -mt-1.5 h-8 w-8 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {step === "phone" ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              <p className="text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                We’ll send you a code to confirm it’s really you
              </p>

              {/* Combined Country & Phone Field */}
              <div className="flex items-center gap-2">
                {/* Country selector button */}
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="cursor-pointer flex h-11 items-center gap-1.5 rounded-[10px] border border-zinc-200 bg-white px-3 text-[14px] font-medium text-zinc-900 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100"
                  >
                    <span>+{selectedCountry.dial}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                  </button>

                  {/* Dropdown list */}
                  {dropdownOpen && (
                    <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-72 overflow-hidden rounded-[14px] border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                      <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
                        <input
                          type="search"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search country or code"
                          className="h-8 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                          autoFocus
                        />
                      </div>
                      <ul className="max-h-56 overflow-y-auto py-1 text-xs">
                        {filteredCountries.map((c) => (
                          <li key={`${c.iso}-${c.dial}-${c.name}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c);
                                setDropdownOpen(false);
                                setCountrySearch("");
                              }}
                              className={cn(
                                "cursor-pointer flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                                c.iso === selectedCountry.iso &&
                                  c.dial === selectedCountry.dial &&
                                  "bg-zinc-100/70 font-medium dark:bg-zinc-800",
                              )}
                            >
                              <span className="text-sm">
                                {flagEmoji(c.iso)}
                              </span>
                              <span className="flex-1 truncate text-zinc-800 dark:text-zinc-200">
                                {c.name}
                              </span>
                              <span className="tabular-nums text-zinc-400">
                                +{c.dial}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Phone number input */}
                <input
                  type="tel"
                  autoFocus
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Phone number"
                  className={cn(
                    "h-11 flex-1 rounded-[10px] border border-zinc-200 bg-white px-3.5 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors",
                    "focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10",
                    "dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={!canSend || sending}
                  className={cn(
                    "cursor-pointer inline-flex h-9 items-center justify-center rounded-full px-5 text-[13px] font-medium text-white transition-all",
                    canSend && !sending
                      ? "bg-[#18181b] hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                      : "bg-[#b5b5b5] text-white opacity-80 cursor-not-allowed",
                  )}
                >
                  {sending ? "Sending…" : "Send code"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <p className="text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Enter the 6-digit verification code sent to{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  +{selectedCountry.dial} {phoneNumber}
                </span>
              </p>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, ""))
                }
                placeholder="Enter 6-digit code"
                className={cn(
                  "h-11 w-full rounded-[10px] border border-zinc-200 bg-white px-3.5 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors",
                  "focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10",
                  "dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                )}
              />

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="clickable-label cursor-pointer text-[13px] text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Change phone number
                </button>
                <button
                  type="submit"
                  disabled={verificationCode.length !== 6 || sending}
                  className={cn(
                    "cursor-pointer inline-flex h-9 items-center justify-center rounded-full px-5 text-[13px] font-medium text-white transition-all",
                    verificationCode.length === 6 && !sending
                      ? "bg-[#18181b] hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                      : "bg-[#b5b5b5] text-white opacity-80 cursor-not-allowed",
                  )}
                >
                  {sending ? "Verifying…" : "Verify"}
                </button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
