import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  resolveSupabasePublicKey,
  resolveSupabaseServiceRoleKey,
  resolveSupabaseUrl,
} from "@/lib/vercel-env";

let adminClient: SupabaseClient<Database> | null = null;
let anonClient: SupabaseClient<Database> | null = null;

function requiredSupabaseUrl() {
  const value = resolveSupabaseUrl();
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not configured.",
    );
  }
  return value;
}

function requiredSupabaseServiceRoleKey() {
  const value = resolveSupabaseServiceRoleKey();
  if (!value) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is not configured.",
    );
  }
  return value;
}

function requiredSupabasePublicKey() {
  const value = resolveSupabasePublicKey();
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEY, or SUPABASE_ANON_KEY is not configured.",
    );
  }
  return value;
}

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient<Database>(
      requiredSupabaseUrl(),
      requiredSupabaseServiceRoleKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return adminClient;
}

export function getSupabaseAnonServerClient() {
  if (!anonClient) {
    anonClient = createClient<Database>(
      requiredSupabaseUrl(),
      requiredSupabasePublicKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return anonClient;
}

export async function getUserFromAccessToken(
  accessToken: string,
): Promise<User> {
  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error("Invalid or expired Supabase session.");
  }

  return data.user;
}
