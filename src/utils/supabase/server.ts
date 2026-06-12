import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicConfig } from "./env";

function withSecureCookieDefaults(options: CookieOptions = {}): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    ...options,
    sameSite: options.sameSite ?? "lax",
    ...(isProduction ? { secure: true } : {}),
  };
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = requireSupabasePublicConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, withSecureCookieDefaults(options));
          });
        } catch {}
      },
    },
  });
}
