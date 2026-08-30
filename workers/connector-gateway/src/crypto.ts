const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const raw = base64ToBytes(secret);
  if (raw.byteLength !== 32) {
    throw new Error(
      "CONNECTOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    );
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function sealText(
  plaintext: string,
  secret: string,
  context: string,
): Promise<{ ciphertext: string; nonce: string }> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: encoder.encode(context),
    },
    await encryptionKey(secret),
    encoder.encode(plaintext),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    nonce: bytesToBase64(nonce),
  };
}

export async function openText(
  ciphertext: string,
  nonce: string,
  secret: string,
  context: string,
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(nonce),
      additionalData: encoder.encode(context),
    },
    await encryptionKey(secret),
    base64ToBytes(ciphertext),
  );
  return decoder.decode(plaintext);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(verifier),
  );
  return bytesToBase64(new Uint8Array(digest))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function randomUrlSafe(bytes = 32): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  return crypto.subtle.timingSafeEqual(leftBytes, rightBytes);
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalValue(item)]),
  );
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}
