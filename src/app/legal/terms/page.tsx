import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Clauxen",
  description: "Terms that govern your use of Clauxen.",
};

export default function TermsPage() {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-shell-bg)] px-5 py-10 text-zinc-900 sm:px-8">
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
            className="h-5 w-5 object-contain"
          />
          Clauxen
        </a>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated: July 9, 2026
        </p>

        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-zinc-700">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern access to and use
            of Clauxen, operated by Shirova AI, including clauxen.com and
            related applications and APIs.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Acceptance
            </h2>
            <p>
              By creating an account or using Clauxen, you agree to these Terms
              and our{" "}
              <a
                href="/legal/privacy"
                className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
              >
                Privacy Policy
              </a>
              . If you use Clauxen on behalf of an organization, you represent
              that you have authority to bind that organization.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Accounts and authentication
            </h2>
            <p>
              You are responsible for activity under your account and for
              keeping credentials secure. Sign-in providers (such as Google or
              GitHub) are subject to those providers&apos; terms in addition to
              these Terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Acceptable use
            </h2>
            <p>
              You may not misuse Clauxen, attempt unauthorized access, interfere
              with the service, or use it to violate law or others&apos; rights.
              We may suspend or terminate access for violations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Your content
            </h2>
            <p>
              You retain ownership of content you submit. You grant us a limited
              license to host, process, and display that content as needed to
              operate Clauxen.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Disclaimers
            </h2>
            <p>
              Clauxen is provided &quot;as is&quot; to the extent permitted by
              law. AI outputs may be inaccurate; you are responsible for how you
              use them.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">Contact</h2>
            <p>
              Questions about these Terms:{" "}
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
      </div>
    </main>
  );
}
