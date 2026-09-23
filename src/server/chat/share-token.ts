import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";

function sealingKey(): Buffer {
  const secret = env.jwtSecret.trim();
  if (!secret) {
    throw new AppError("Share links are not configured.", 503, "share_unconfigured");
  }
  return createHash("sha256").update(`clauxen-share-token:${secret}`).digest();
}

/** AES-GCM blob so the owner can see the link again without storing it in plaintext. */
export function sealShareToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealingKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function openShareToken(sealed: string): string | null {
  try {
    const buf = Buffer.from(sealed, "base64url");
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", sealingKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}

export function shareTokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
