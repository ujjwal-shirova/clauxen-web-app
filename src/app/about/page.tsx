import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Clauxen",
  description:
    "Clauxen is Shirova AI’s platform for AI chats, projects, agents, and tools — sign in to build and collaborate.",
};

export default function AboutPage() {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-shell-bg)] px-5 py-10 text-zinc-900 sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/login"
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
          About Clauxen
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Operated by Shirova AI · clauxen.com
        </p>

        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-zinc-700">
          <p>
            Clauxen is an AI workspace for individuals and teams. Sign in to
            chat with models, organize work into projects, run agents and
            tools, and collaborate on documents and code — from the web app and
            related Clauxen products.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              What you can do
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Start and continue AI conversations</li>
              <li>Group chats and files into projects</li>
              <li>Use agents, connectors, and skills to automate work</li>
              <li>Sign in with email or providers such as Google and GitHub</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">
              Google sign-in
            </h2>
            <p>
              When you choose Continue with Google, Clauxen uses Google only to
              authenticate your account (name, email, and profile photo). We do
              not use Google Sign-In for advertising. See our privacy policy for
              how account data is handled.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900">Get started</h2>
            <p>
              <Link
                href="/login"
                className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
              >
                Sign in
              </Link>{" "}
              or{" "}
              <Link
                href="/signup"
                className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
              >
                create an account
              </Link>{" "}
              to use Clauxen.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-zinc-500">
          <Link
            href="/legal/privacy"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
          >
            Privacy Policy
          </Link>
          {" · "}
          <Link
            href="/legal/terms"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
          >
            Terms of Service
          </Link>
          {" · "}
          <a
            href="mailto:support@clauxen.com"
            className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
          >
            support@clauxen.com
          </a>
        </p>
      </div>
    </main>
  );
}
