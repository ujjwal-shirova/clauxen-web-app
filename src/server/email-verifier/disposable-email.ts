import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "@/server/db/errors";

/** Shown in UI + returned by API when a disposable/temp domain is used. */
export const DISPOSABLE_EMAIL_MESSAGE =
  "Temporary accounts are not allowed. Use a legitimate email address — disposable or temporary inboxes cannot create or sign in to Clauxen.";

export const DISPOSABLE_EMAIL_CODE = "disposable_email";

let domainSet: Set<string> | null = null;
let loadError: Error | null = null;

/**
 * Candidate paths for disposable.txt.
 *
 * - Module-adjacent: works in local/dev when the source file sits next to the list.
 * - Traced deploy path: outputFileTracingIncludes in next.config.ts copies the
 *   list under src/server/email-verifier/. The turbopackIgnore comment on
 *   process.cwd() keeps Turbopack from walking cwd as a dynamic NFT root
 *   (that produced the "unexpected file in NFT list" build spam).
 */
function listCandidates(): string[] {
  return [
    path.join(path.dirname(fileURLToPath(import.meta.url)), "disposable.txt"),
    path.join(
      /* turbopackIgnore: true */ process.cwd(),
      "src",
      "server",
      "email-verifier",
      "disposable.txt",
    ),
  ];
}

function loadDomainSet(): Set<string> {
  if (domainSet) return domainSet;
  if (loadError) throw loadError;

  let raw: string | null = null;
  let lastErr: Error | null = null;
  for (const candidate of listCandidates()) {
    try {
      raw = fs.readFileSync(candidate, "utf8");
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (raw == null) {
    loadError = lastErr ?? new Error("Disposable email list missing.");
    throw loadError;
  }

  const set = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const domain = line.trim().toLowerCase();
    if (!domain || domain.startsWith("#")) continue;
    set.add(domain);
  }
  domainSet = set;
  return set;
}

/** Extract and normalize the domain from an email (handles "Name <a@b.com>"). */
export function emailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const angle = trimmed.match(/<([^>]+)>/);
  const addr = (angle?.[1] ?? trimmed).trim();
  const at = addr.lastIndexOf("@");
  if (at <= 0 || at === addr.length - 1) return null;
  // strip trailing dots / brackets
  return addr
    .slice(at + 1)
    .replace(/[>\]]+$/g, "")
    .replace(/\.+$/g, "")
    .toLowerCase();
}

/**
 * True when the email's domain (or any parent domain) is on the disposable list.
 * e.g. foo.mailinator.com matches mailinator.com if listed.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;

  const set = loadDomainSet();
  if (set.has(domain)) return true;

  const parts = domain.split(".");
  // require at least domain.tld (2 labels) for parent walk
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (set.has(parent)) return true;
  }
  return false;
}

/** Throws AppError when the address uses a blocked disposable domain. */
export function assertEmailNotDisposable(email: string): void {
  const domain = emailDomain(email);
  if (!domain) {
    throw new AppError("Invalid email address.", 400, "invalid_email");
  }
  try {
    if (isDisposableEmail(email)) {
      throw new AppError(
        DISPOSABLE_EMAIL_MESSAGE,
        403,
        DISPOSABLE_EMAIL_CODE,
      );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Fail closed for auth — never allow signup/login if the list cannot load.
    throw new AppError(
      "Email verification is temporarily unavailable. Try again shortly.",
      503,
      "email_check_unavailable",
    );
  }
}

/** Soft check for middleware: false if list cannot load (avoid locking everyone out of the app shell). */
export function isDisposableEmailSafe(email: string): boolean {
  try {
    return isDisposableEmail(email);
  } catch {
    return false;
  }
}
