import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { AppError } from "@/server/db/errors";
import { resolveSupabaseServiceRoleKey } from "@/lib/vercel-env";

/**
 * Seals per-install MCP API keys for gateway-less mode (AES-256-GCM, random
 * 12-byte nonce, per-install AAD). Key versions:
 * - v2: explicit PLUGIN_CREDENTIAL_KEY (64-char hex or base64url 32B).
 * - v1: HKDF derived from SUPABASE_SERVICE_ROLE_KEY (zero-config default).
 *
 * Trade-off: v1 keeps the feature working with no extra env; anyone holding
 * both the database and the service key can unseal. Set
 * PLUGIN_CREDENTIAL_KEY (Cloudflare-style split secret) for breach
 * separation between the database and the key holder.
 */

const AAD_PREFIX = "installation:";
const AAD_SUFFIX = ":apikey";

function versionedKey(
  version: 1 | 2,
): { key: Buffer; version: 1 | 2 } {
  if (version === 2) {
    const raw = (process.env.PLUGIN_CREDENTIAL_KEY || "").trim();
    if (!raw) {
      throw new AppError(
        "API key storage is not configured.",
        500,
        "plugin_api_key_storage_unavailable",
      );
    }
    let key: Buffer | null = null;
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      key = Buffer.from(raw, "hex");
    } else {
      try {
        const candidate = Buffer.from(raw, "base64url");
        if (candidate.length === 32) key = candidate;
      } catch {
        key = null;
      }
    }
    if (!key || key.length !== 32) {
      throw new AppError(
        "PLUGIN_CREDENTIAL_KEY must be 64-char hex or base64url 32 bytes.",
        500,
        "plugin_api_key_storage_unavailable",
      );
    }
    return { key, version: 2 };
  }
  const serviceKey = resolveSupabaseServiceRoleKey();
  if (!serviceKey) {
    throw new AppError(
      "API key storage is not configured.",
      500,
      "plugin_api_key_storage_unavailable",
    );
  }
  const key = hkdfSync(
    "sha256",
    serviceKey,
    "clauxen-plugin-api-keys",
    "v1",
    32,
  );
  return { key: Buffer.from(key), version: 1 };
}

function sealingKey(): { key: Buffer; version: 1 | 2 } {
  if ((process.env.PLUGIN_CREDENTIAL_KEY || "").trim()) {
    return versionedKey(2);
  }
  return versionedKey(1);
}

function aad(installationId: string): Buffer {
  return Buffer.from(`${AAD_PREFIX}${installationId}${AAD_SUFFIX}`, "utf8");
}

export function sealPluginApiKey(
  apiKey: string,
  installationId: string,
): { ciphertext: string; nonce: string; version: 1 | 2 } {
  const { key, version } = sealingKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad(installationId));
  const encrypted = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64url"),
    nonce: nonce.toString("base64url"),
    version,
  };
}

export function openPluginApiKey(
  sealed: { ciphertext: string; nonce: string; version: number },
  installationId: string,
): string {
  const version = sealed.version === 2 ? 2 : 1;
  const { key } = versionedKey(version);
  const combined = Buffer.from(sealed.ciphertext, "base64url");
  if (combined.length < 17) throw new Error("API key payload too short.");
  const encrypted = combined.subarray(0, combined.length - 16);
  const tag = combined.subarray(combined.length - 16);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(sealed.nonce, "base64url"),
  );
  decipher.setAAD(aad(installationId));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
