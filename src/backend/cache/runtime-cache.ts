/**
 * Regional Runtime Cache for non-chat Vercel function data.
 * Chat messages/lists stay on Cloudflare chat-history Worker — never here.
 */
import { getCache } from "@vercel/functions";

const SETTINGS_TAG = "user-settings";
const MODEL_CATALOG_TAG = "model-catalog";

function cacheOrNull() {
  try {
    return getCache();
  } catch {
    return null;
  }
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const cache = cacheOrNull();
  if (!cache) return null;
  try {
    const hit = await cache.get(key);
    if (hit == null) return null;
    if (typeof hit === "string") {
      return JSON.parse(hit) as T;
    }
    return hit as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  opts: { ttlSeconds: number; tags: string[] },
): Promise<void> {
  const cache = cacheOrNull();
  if (!cache) return;
  try {
    await cache.set(key, JSON.stringify(value), {
      ttl: opts.ttlSeconds,
      tags: opts.tags,
    });
  } catch (error) {
    console.warn("[runtime-cache] set failed", error);
  }
}

export async function invalidateRuntimeCacheTags(
  tags: string[],
): Promise<void> {
  const cache = cacheOrNull();
  if (!cache || tags.length === 0) return;
  try {
    for (const tag of tags) {
      await cache.expireTag(tag);
    }
  } catch (error) {
    console.warn("[runtime-cache] invalidate failed", error);
  }
}

export function userSettingsCacheKey(userId: string): string {
  return `settings:v1:${userId}`;
}

export const RUNTIME_CACHE_TAGS = {
  settings: SETTINGS_TAG,
  modelCatalog: MODEL_CATALOG_TAG,
} as const;

export async function cacheUserSettings(
  userId: string,
  payload: unknown,
): Promise<void> {
  await setCachedJson(userSettingsCacheKey(userId), payload, {
    ttlSeconds: 60,
    tags: [SETTINGS_TAG, `settings:${userId}`],
  });
}

export async function readCachedUserSettings<T>(
  userId: string,
): Promise<T | null> {
  return getCachedJson<T>(userSettingsCacheKey(userId));
}

export async function invalidateUserSettingsCache(
  userId: string,
): Promise<void> {
  await invalidateRuntimeCacheTags([SETTINGS_TAG, `settings:${userId}`]);
}

export async function cacheModelCatalog(payload: unknown): Promise<void> {
  await setCachedJson("model-catalog:v1", payload, {
    ttlSeconds: 300,
    tags: [MODEL_CATALOG_TAG],
  });
}

export async function readCachedModelCatalog<T>(): Promise<T | null> {
  return getCachedJson<T>("model-catalog:v1");
}
