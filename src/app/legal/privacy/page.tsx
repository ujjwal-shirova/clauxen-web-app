import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Clauxen",
  description: "How Clauxen collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-shell-bg)] px-5 py-10 text-zinc-900 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <img
            src="/assets/icons/clauxen-icon.png"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
          />
          Clauxen
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated: July 9, 2026
        </p>

        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-zinc-700">
          <p>
            This Privacy Policy explains how Shirova AI (&quot;Clauxen&quot;,
            &quot;we&quot;, &quot;us&quot;) collects, uses, and shares
            information when you use clauxen.com and related services.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Information we collect
            </h2>
            <p>
              Account details (such as email and display name), authentication
              data from sign-in providers (for example Google), usage and device
              information, and content you submit in chats, projects, and
              uploads.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              How we use information
            </h2>
            <p>
              We use this information to provide and improve Clauxen, secure
              accounts, process payments where applicable, communicate with you,
              and comply with law. We do not sell your personal information.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Sign-in with Google
            </h2>
            <p>
              If you choose Continue with Google, we receive basic profile
              information (such as name, email, and profile photo) from Google
              solely to create and authenticate your Clauxen account. We request
              only the scopes needed for sign-in.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Retention and deletion
            </h2>
            <p>
              We retain account and service data while your account is active
              and as needed for security, billing, and legal obligations. You
              may request deletion of your account and associated personal data
              by contacting support.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">Contact</h2>
            <p>
              Questions about this policy:{" "}
              <a
                className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
                href="mailto:support@clauxen.com"
              >
                support@clauxen.com
              </a>
              .
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-zinc-500">
          See also our{" "}
          <Link
            href="/legal/terms"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
          >
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
