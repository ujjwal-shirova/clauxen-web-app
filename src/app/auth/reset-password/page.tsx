"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const PAGE_BG = "#faf9f5";
const INK = "#141413";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update password.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4"
      style={{ backgroundColor: PAGE_BG }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-[32px] border-[0.5px] border-[rgba(31,30,29,0.15)] p-7 shadow-lg"
        style={{ backgroundColor: PAGE_BG }}
      >
        <h1
          className="text-center font-serif text-2xl font-medium"
          style={{ color: INK }}
        >
          Set a new password
        </h1>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="password"
            placeholder="New password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-[9.6px] border border-[rgba(31,30,29,0.15)] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[rgba(44,132,219,0.15)]"
          />
          <input
            type="password"
            placeholder="Confirm password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-11 w-full rounded-[9.6px] border border-[rgba(31,30,29,0.15)] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[rgba(44,132,219,0.15)]"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-[9.6px] bg-[#141413] text-sm font-medium text-white hover:bg-[#272625] disabled:opacity-70"
          >
            {submitting ? "Saving…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}
