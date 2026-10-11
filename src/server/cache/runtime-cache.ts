/** Public model catalog cache. Mutable user settings always come from Postgres. */
import { cloudflareContext } from "@/server/cloudflare/context";

const SETTINGS_TAG = "user-settings";
const MODEL_CATALOG_TAG = "model-catalog";

export async function getCachedJson<T>(key: string): Promise<T | null> {
  if (key.startsWith("settings:")) return null;
  try {
    return (
      (await cloudflareContext()?.env.APP_CONFIG_KV.get<T>(key, "json")) ?? null
    );
  } catch {
    return null;
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  opts: { ttlSeconds: number; tags: string[] },
): Promise<void> {
  // KV is eventually consistent; it must not cache mutable per-user settings.
  if (key.startsWith("settings:")) return;
  try {
    await cloudflareContext()?.env.APP_CONFIG_KV.put(
      key,
      JSON.stringify(value),
      {
        expirationTtl: Math.max(60, opts.ttlSeconds),
      },
    );
  } catch (error) {
    console.warn("[runtime-cache] set failed", error);
  }
}

export async function invalidateRuntimeCacheTags(
  tags: string[],
): Promise<void> {
  if (!tags.includes(MODEL_CATALOG_TAG)) return;
  try {
    await cloudflareContext()?.env.APP_CONFIG_KV.delete("model-catalog:v1");
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
