import { env } from "@/server/config/env";
import {
  deriveSealKey,
  sealSecret as sealWithKey,
  unsealSecret as unsealWithKey,
} from "@/shared/lib/plugin-token-seal";

/**
 * Sealing for MCP OAuth token material in the Next.js runtime.
 *
 * Tokens are encrypted with AES-256-GCM *before* they reach Postgres and only
 * unsealed here at the moment of a tool call. The key is derived from
 * `PAYMENT_METHOD_ENCRYPTION_KEY` (falling back to `JWT_SECRET`) with a domain
 * separator, so a plugin token can never be unsealed by the payment path and
 * vice versa.
 */

function sealPassphrase(): string | null {
  const raw =
    env.paymentMethodEncryptionKey?.trim() || env.jwtSecret?.trim() || "";
  return raw || null;
}

export function isPluginTokenEncryptionConfigured(): boolean {
  return sealPassphrase() !== null;
}

/** AES-256-GCM seal. Throws when no encryption key is configured. */
export async function sealSecret(plaintext: string): Promise<string> {
  const passphrase = sealPassphrase();
  if (!passphrase) {
    throw new Error(
      "Plugin token encryption is not configured. Set PAYMENT_METHOD_ENCRYPTION_KEY.",
    );
  }
  return sealWithKey(plaintext, await deriveSealKey(passphrase));
}

/** AES-256-GCM open. Returns null instead of throwing on tamper/wrong key. */
export async function unsealSecret(payload: string): Promise<string | null> {
  const passphrase = sealPassphrase();
  if (!passphrase) return null;
  return unsealWithKey(payload, await deriveSealKey(passphrase));
}
