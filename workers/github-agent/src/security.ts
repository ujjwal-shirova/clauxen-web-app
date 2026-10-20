import { createHash, timingSafeEqual, createPrivateKey } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const randomToken = () => crypto.randomUUID() + crypto.randomUUID();
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function seal(
  key: string,
  value: unknown,
  context: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aes = await crypto.subtle.importKey(
    "raw",
    Buffer.from(key, "base64"),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) },
    aes,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Buffer.concat([iv, Buffer.from(encrypted)]).toString("base64");
}
export async function unseal<T>(
  key: string,
  value: string,
  context: string,
): Promise<T> {
  const bytes = Buffer.from(value, "base64");
  const aes = await crypto.subtle.importKey(
    "raw",
    Buffer.from(key, "base64"),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytes.subarray(0, 12),
      additionalData: new TextEncoder().encode(context),
    },
    aes,
    bytes.subarray(12),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
export async function appJwt(id: string, pem: string) {
  // GitHub manifest keys are PKCS#1; jose expects PKCS#8.
  const pkcs8 = createPrivateKey(pem)
    .export({ format: "pem", type: "pkcs8" })
    .toString();
  const key = await importPKCS8(pkcs8, "RS256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(id)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 60)
    .setExpirationTime("8m")
    .sign(key);
}
export async function verifyWebhook(
  secret: string,
  body: string,
  signature: string,
) {
  if (!/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(signature.slice(7), "hex"),
    new TextEncoder().encode(body),
  );
}
export async function readBody(request: Request, limit = 1024 * 1024) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new HttpError(413, "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "Request too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
