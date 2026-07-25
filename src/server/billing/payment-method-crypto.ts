import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env } from "@/server/config/env";
import { AppError } from "@/server/db/errors";

const PREFIX = "v1";

function resolveKey(): Buffer {
  // Prefer dedicated key; fall back to Razorpay secret / JWT so card-on-file
  // encryption works in production without a separate env when keys already exist.
  const raw =
    env.paymentMethodEncryptionKey?.trim() ||
    env.razorpayKeySecret?.trim() ||
    env.jwtSecret?.trim() ||
    "";
  if (!raw) {
    throw new AppError(
      "Payment method encryption is not configured. Set PAYMENT_METHOD_ENCRYPTION_KEY.",
      503,
      "encryption_unavailable",
    );
  }

  // Accept 32-byte hex or utf8 passphrase (hashed to 32 bytes).
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return createHash("sha256")
    .update(`clauxen-pm-v1:${raw}`)
    .digest();
}

export function fingerprintProviderRef(providerRef: string): string {
  return createHash("sha256").update(providerRef).digest("hex");
}

/** AES-256-GCM encrypt Razorpay card/token id. Never encrypt PAN (we never have it). */
export function encryptProviderRef(providerRef: string): string {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(providerRef, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptProviderRef(payload: string): string {
  const key = resolveKey();
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new AppError("Invalid encrypted payment reference.", 500, "decrypt_error");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64!, "base64url");
  const tag = Buffer.from(tagB64!, "base64url");
  const data = Buffer.from(dataB64!, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function isPaymentMethodEncryptionConfigured(): boolean {
  return Boolean(
    env.paymentMethodEncryptionKey?.trim() ||
      env.razorpayKeySecret?.trim() ||
      env.jwtSecret?.trim(),
  );
}
