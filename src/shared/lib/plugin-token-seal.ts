/**
 * Dependency-free AES-256-GCM sealing for MCP OAuth token material.
 *
 * Shared by the Next.js runtime and the plugin-oauth Cloudflare worker so both
 * sides agree on the exact key derivation and blob layout. Implemented with
 * Web Crypto only — no node:crypto, no Buffer — so it runs unchanged in Node
 * and in a Worker.
 *
 * Blob format: `v1.<iv>.<authTag>.<ciphertext>` (base64url, 12-byte IV,
 * 16-byte auth tag).
 */

const PREFIX = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export const KEY_DOMAIN = "clauxen-plugin-token-v1";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// ─── base64url (no Buffer) ──────────────────────────────────────────────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

// ─── key derivation ─────────────────────────────────────────────────────────

/** Derive the 32-byte AES key from any configured passphrase. */
export async function deriveSealKey(passphrase: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(`${KEY_DOMAIN}:${passphrase}`),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// ─── seal / unseal ──────────────────────────────────────────────────────────

export async function sealSecret(
  plaintext: string,
  key: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: TAG_BYTES * 8 },
      key,
      textEncoder.encode(plaintext),
    ),
  );

  // Web Crypto appends the auth tag to the ciphertext; split it out so the
  // blob layout is explicit and matches the documented format.
  const ciphertext = sealed.slice(0, sealed.length - TAG_BYTES);
  const tag = sealed.slice(sealed.length - TAG_BYTES);

  return [
    PREFIX,
    bytesToBase64Url(iv),
    bytesToBase64Url(tag),
    bytesToBase64Url(ciphertext),
  ].join(".");
}

/** Returns null on tamper, wrong key, or malformed payload — never throws. */
export async function unsealSecret(
  payload: string,
  key: CryptoKey,
): Promise<string | null> {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;

  const [, ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64 || !dataB64) return null;

  const iv = base64UrlToBytes(ivB64);
  const tag = base64UrlToBytes(tagB64);
  const ciphertext = base64UrlToBytes(dataB64);
  if (!iv || !tag || !ciphertext) return null;

  // Web Crypto expects the auth tag appended to the ciphertext.
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  try {
    const opened = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: TAG_BYTES * 8 },
      key,
      combined,
    );
    return textDecoder.decode(opened);
  } catch {
    return null;
  }
}
