"use client";

import { createClient } from "@/utils/supabase/client";

type AccessTokenCache = {
  token: string;
  at: number;
  expiresAt: number;
};

const TOKEN_TTL_MS = 30_000;

let inflight: Promise<string | null> | null = null;
let generation = 0;
let cached: AccessTokenCache | null = null;

/**
 * Singleflight Supabase access token for Worker fetches.
 * Avoids serial getSession() on list + messages during boot.
 */
export async function getSupabaseAccessTokenSingleflight(): Promise<
  string | null
> {
  if (typeof window === "undefined") return null;
  if (
    cached &&
    Date.now() - cached.at < TOKEN_TTL_MS &&
    cached.expiresAt > Date.now() + 30_000
  ) {
    return cached.token;
  }
  if (!inflight) {
    const currentGeneration = generation;
    inflight = (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
        if (currentGeneration !== generation) return null;
        if (token) {
          cached = {
            token,
            at: Date.now(),
            expiresAt: (session?.expires_at ?? 0) * 1000,
          };
        }
        return token;
      } catch {
        return null;
      } finally {
        if (currentGeneration === generation) inflight = null;
      }
    })();
  }
  return inflight;
}

/** Drop memo after logout / auth change so the next fetch re-reads session. */
export function clearSupabaseAccessTokenSingleflight(): void {
  generation += 1;
  cached = null;
  inflight = null;
}
