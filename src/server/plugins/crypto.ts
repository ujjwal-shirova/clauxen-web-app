import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cloudflareContext } from "@/server/cloudflare/context";
import { AppError } from "@/server/db/errors";

export function connectorEnv(name: string): string | undefined {
  const bindings = cloudflareContext()?.env as unknown as Record<string, unknown> | undefined;
  const value = bindings?.[name] ?? process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function connectorError(message: string, status = 400): AppError {
  return new AppError(message, status, "plugin_connector_error");
}

export function sealKey(encoded = connectorEnv("PLUGIN_TOKEN_SEAL_KEY")): Buffer {
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) {
    throw connectorError("Connector encryption is not configured. Ask the administrator to set PLUGIN_TOKEN_SEAL_KEY.", 503);
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw connectorError("Connector encryption is not configured.", 503);
  }
  return key;
}

export type SealBinding = { userId: string; pluginId: string; purpose: string; id: string };
const aad = (binding: SealBinding) => Buffer.from(JSON.stringify(["plugin:v1", binding.userId, binding.pluginId, binding.purpose, binding.id]));
export function seal(value: unknown, binding: SealBinding, key = sealKey()): string {
  const plaintext = Buffer.from(JSON.stringify(value));
  if (plaintext.length > 262144) throw connectorError("Connector data is too large.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(binding));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function unseal<T>(value: string, binding: SealBinding, key = sealKey()): T {
  try {
    if (value.length > 360000) throw new Error();
    const [version, iv, tag, ciphertext, extra] = value.split(".");
    if (version !== "v1" || extra !== undefined || !iv || !tag || !ciphertext) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")) as T;
  } catch {
    throw connectorError("Stored connector credentials could not be verified. Reconnect this account.", 409);
  }
}
export const randomState = () => randomBytes(32).toString("base64url");
export const hashState = (value: string) => createHash("sha256").update(value).digest("hex");

/** Output is untrusted data, never instructions. Bound recursion, sizes and credential fields. */
export function sanitizeResult(value: unknown, secrets: string[] = []): unknown {
  let budget = 60000;
  const sensitive = /(?:access.?token|refresh.?token|id.?token|client.?secret|authorization|cookie|password|credential|code.?verifier|registration.?access.?token|api.?key|private.?key)/i;
  const scrub = (input: unknown, depth: number): unknown => {
    if (budget <= 0 || depth > 10) return "[truncated]";
    if (typeof input === "string") {
      let text = input.slice(0, Math.min(16000, budget));
      for (const secret of secrets.filter((entry) => entry.length >= 4)) text = text.split(secret).join("[redacted]");
      text = text.replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [redacted]")
        .replace(/([?&](?:access_token|refresh_token|token|code|client_secret)=)[^\s&#"']+/gi, "$1[redacted]");
      budget -= text.length;
      return text;
    }
    if (input === null || typeof input === "boolean") return input;
    if (typeof input === "number") return Number.isFinite(input) ? input : null;
    if (Array.isArray(input)) return input.slice(0, 100).map((entry) => scrub(entry, depth + 1));
    if (typeof input === "object") {
      const output: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(input).slice(0, 100)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) continue;
        budget -= key.length + 8;
        output[key.slice(0, 200)] = sensitive.test(key) ? "[redacted]" : scrub(entry, depth + 1);
      }
      return output;
    }
    return null;
  };
  const output = scrub(value, 0);
  return Buffer.byteLength(JSON.stringify(output)) <= 65536 ? output : { truncated: true, message: "Result exceeded the display limit. Narrow your query." };
}
