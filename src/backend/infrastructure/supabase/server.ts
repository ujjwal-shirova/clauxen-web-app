import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getSupabasePublishableKey } from "@/utils/supabase/env";

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function requiredSupabasePublicKey() {
  const value = getSupabasePublishableKey();
  if (!value) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.");
  }
  return value;
}

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

export function getSupabaseAnonServerClient() {
  if (!anonClient) {
    anonClient = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredSupabasePublicKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return anonClient;
}

export async function getUserFromAccessToken(accessToken: string): Promise<User> {
  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error("Invalid or expired Supabase session.");
  }

  return data.user;
}
