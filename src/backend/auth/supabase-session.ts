import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/utils/supabase/env";

/** Read-only Supabase client from an incoming request (API routes / middleware). */
export function createSupabaseClientFromRequest(request: NextRequest) {
  const { url, publishableKey } = getSupabasePublicConfig();
  if (!url || !publishableKey) return null;

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // ponytail: cookie writes happen in route handlers / middleware only
      },
    },
  });
}

export async function getSupabaseUserIdFromRequest(
  request: NextRequest,
): Promise<string | null> {
  const client = createSupabaseClientFromRequest(request);
  if (!client) return null;

  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}
