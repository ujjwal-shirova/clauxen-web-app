import Link from "next/link";
import { FOOTER_COLUMNS, SITE } from "@/website/lib/site";

const SOCIAL_LINKS = [
  {
    label: "X",
    href: "https://x.com/",
    icon: "bi-twitter-x",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/",
    icon: "bi-youtube",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/",
    icon: "bi-linkedin",
  },
  {
    label: "GitHub",
    href: "https://github.com/",
    icon: "bi-github",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/",
    icon: "bi-instagram",
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--app-shell-bg)]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link
              href="/overview"
              className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/icons/clauxen-icon.png"
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] object-contain"
              />
              {SITE.brand}
            </Link>
            <p className="mt-3 max-w-[220px] text-sm leading-relaxed text-zinc-500">
              An AI workspace by {SITE.company}.
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {col.title}
              </div>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.company}. {SITE.brand} ·{" "}
            {SITE.domain}
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                >
                  <i className={`bi ${social.icon} text-[16px]`} aria-hidden />
                </a>
              ))}
            </div>
            <div className="flex gap-4">
              <Link
                href="/legal/privacy"
                className="hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Privacy
              </Link>
              <Link
                href="/legal/terms"
                className="hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Terms
              </Link>
              <a
                href={`mailto:${SITE.supportEmail}`}
                className="hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
