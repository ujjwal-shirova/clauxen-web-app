import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateOpaqueToken(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}

export function generateUserCode(): string {
  // XXXX-XXXX style, exclude ambiguous chars
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    out += alphabet[buf[i]! % alphabet.length];
    if (i === 3) out += "-";
  }
  return out;
}

export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  if (computed.length !== codeChallenge.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(codeChallenge),
    );
  } catch {
    return false;
  }
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
