"use client";

import { useMemo, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  authPageStyles,
  CountryCodePicker,
} from "@/components/auth/auth-shared";
import { useAuth } from "@/hooks/use-auth";
import {
  findCountryByIso,
  flagEmoji,
  toE164,
  type PhoneCountry,
} from "@/lib/phone-countries";
import { cn } from "@/lib/utils";

/** Minimum national significant digits we accept before enabling Continue. */
const MIN_NATIONAL_DIGITS = 7;

export function VerifyPhonePage() {
  const { user } = useAuth();

  const [countryIso, setCountryIso] = useState<string>("IN");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const country: PhoneCountry = findCountryByIso(countryIso);
  const nationalDigits = phone.replace(/\D/g, "");
  const canContinue =
    nationalDigits.length >= MIN_NATIONAL_DIGITS && !submitting;

  const e164 = useMemo(
    () => (nationalDigits ? toE164(country.dial, phone) : ""),
    [country.dial, nationalDigits, phone],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (nationalDigits.length < MIN_NATIONAL_DIGITS) {
      setError("Enter a valid mobile number.");
      return;
    }

    setSubmitting(true);
    try {
      // TODO(next step): send an OTP to `e164` and route to the code-entry view.
      //   e.g. await signInWithPhoneOtp(e164); router.replace("/verify-phone/otp");
      // For now the UI is built and ready to wire up.
      void e164;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Phone verification
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
          Verify your mobile number
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
          We&apos;ll text a confirmation code to this number to make sure
          it&apos;s really you.
        </p>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mt-7 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <label
            htmlFor="verify-phone-input"
            className="mb-1.5 block text-[13px] font-medium text-zinc-800"
          >
            Mobile number
          </label>

          <div
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-[10px] border border-zinc-200 bg-white pl-1.5 pr-2 transition-colors focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-900/10",
            )}
          >
            <CountryCodePicker
              country={country}
              onSelect={(c) => setCountryIso(c.iso)}
            />
            <span
              className="h-6 w-px shrink-0 bg-zinc-200"
              aria-hidden
            />
            <input
              id="verify-phone-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              autoFocus
              value={phone}
              disabled={submitting}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter mobile number"
              aria-label="Mobile number"
              className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>

          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-zinc-400">
            <span aria-hidden>
              {flagEmoji(country.iso)} +{country.dial}
            </span>
            <span className="truncate">
              {e164 ? e164 : "We won’t share your number."}
            </span>
          </p>

          {error ? (
            <p className="mt-3 text-[13px] text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canContinue}
            className={cn(authPageStyles.primaryBtn, "mt-4")}
          >
            {submitting ? "Please wait…" : "Continue"}
          </button>

          <button
            type="button"
            disabled={submitting}
            className={cn(
              authPageStyles.textLink,
              "mt-3 block w-full text-center",
            )}
          >
            Skip for now
          </button>
        </form>

        <p className="mt-5 text-[12px] leading-relaxed text-zinc-500">
          By continuing, you agree to receive a verification code by SMS.
          Message rates may apply. See our{" "}
          <a
            href="/legal/privacy"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>

      <p className="mx-auto mt-auto max-w-[380px] pb-2 text-center text-[12px] leading-relaxed text-zinc-400">
        {user?.email ? (
          <>
            Signed in as{" "}
            <span className="font-medium text-zinc-600">{user.email}</span>
            {" · "}
          </>
        ) : null}
        Need help?{" "}
        <a
          href="mailto:support@clauxen.com"
          className="text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
        >
          Get in touch
        </a>
      </p>
    </AuthShell>
  );
}
