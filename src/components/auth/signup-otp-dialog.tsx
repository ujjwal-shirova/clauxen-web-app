"use client";

import { useEffect, useState } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { authPageStyles } from "@/components/auth/auth-shared";
import { cn } from "@/lib/utils";

export function SignupOtpDialog({
  open,
  email,
  submitting,
  error,
  info,
  onCodeComplete,
  onResend,
  onClose,
}: {
  open: boolean;
  email: string;
  submitting: boolean;
  error: string | null;
  info: string | null;
  onCodeComplete: (code: string) => void;
  onResend: () => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!open) setCode("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-otp-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-[400px] animate-in fade-in zoom-in-95 rounded-[16px] border border-zinc-200 bg-white p-6 shadow-[0_24px_64px_-24px_rgba(24,24,27,0.45)] duration-200">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2
            id="signup-otp-title"
            className="text-[18px] font-semibold tracking-tight text-zinc-900"
          >
            Verify your email
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <i className="bi bi-x-lg text-[14px]" aria-hidden />
          </button>
        </div>
        <p className="text-[13px] leading-relaxed text-zinc-500">
          Enter the 6-digit code we sent to{" "}
          <span className="font-medium text-zinc-800">{email}</span> to finish
          creating your account.
        </p>

        <div className="mt-5 flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            disabled={submitting}
            autoFocus
            onChange={(value) => {
              setCode(value);
              if (value.length === 6) {
                onCodeComplete(value);
              }
            }}
            containerClassName="gap-2"
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error ? (
          <p className="mt-4 text-center text-[13px] text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="mt-4 text-center text-[13px] text-zinc-600">{info}</p>
        ) : null}

        <button
          type="button"
          disabled={submitting || code.length !== 6}
          onClick={() => onCodeComplete(code)}
          className={cn(authPageStyles.primaryBtn, "mt-5")}
        >
          {submitting ? "Verifying…" : "Verify and create account"}
        </button>

        <p className="mt-4 text-center text-[12px] text-zinc-500">
          Didn&apos;t get a code?{" "}
          <button
            type="button"
            disabled={submitting}
            onClick={onResend}
            className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950 disabled:opacity-50"
          >
            Resend
          </button>
        </p>
      </div>
    </div>
  );
}
