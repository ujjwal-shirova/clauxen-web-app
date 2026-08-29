import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy - Clauxen",
  description: "How Clauxen uses essential and optional cookies.",
};

export default function CookiePolicyPage() {
  return (
    <main className="min-h-[100dvh] bg-[#faf7f6] px-5 py-10 text-zinc-900 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <img
            src="/assets/icons/clauxen-icon.png"
            alt=""
            width={20}
            height={20}
            className="size-5 object-contain"
          />
          Clauxen
        </a>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight">
          Cookie Policy
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated: August 28, 2026
        </p>

        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-zinc-700">
          <p>
            Clauxen uses cookies and similar browser storage to keep the service
            secure, remember preferences, understand performance, and—only when
            you allow it—measure advertising.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Essential cookies
            </h2>
            <p>
              These are required for authentication, fraud prevention, session
              continuity, consent storage, and core product features. They
              cannot be disabled through cookie settings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Performance cookies
            </h2>
            <p>
              With your permission, these help us measure reliability, diagnose
              errors, and understand which product experiences need improvement.
              When enabled, Clauxen loads first-party performance events (page
              views and load timing) and Vercel Analytics.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Advertising cookies
            </h2>
            <p>
              With your permission, these may be used to measure campaigns and
              personalize Clauxen marketing outside the app. When enabled,
              Clauxen stores a first-party advertising identifier and campaign
              parameters (such as UTM tags) and records landing attribution.
              Clauxen does not enable them when you reject optional cookies.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Managing your choices
            </h2>
            <p>
              You can accept all optional cookies, reject them, or choose each
              category in the cookie settings dialog. Optional categories start
              selected in that dialog; collection begins only after you save or
              accept. Your choice is stored for up to one year in a first-party
              cookie and, when you are signed in, on your Clauxen account. You
              can change it later from Settings → Privacy, or by clearing
              Clauxen cookies and local site data. Rejecting optional cookies
              stops collection and deletes matching first-party telemetry for
              this visitor.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">Contact</h2>
            <p>
              Questions about cookies or privacy can be sent to{" "}
              <a
                href="mailto:support@clauxen.com"
                className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
              >
                support@clauxen.com
              </a>
              .
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-zinc-500">
          See also our{" "}
          <a
            href="/legal/privacy"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
          >
            Privacy Policy
          </a>{" "}
          and{" "}
          <a
            href="/legal/terms"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
          >
            Terms of Service
          </a>
          .
        </p>
      </div>
    </main>
  );
}
