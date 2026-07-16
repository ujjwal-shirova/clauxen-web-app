import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { requireSupabasePublicConfig } from "./env";

let browserClient: SupabaseClient<Database> | null = null;

export function createClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }
  const { url, publishableKey } = requireSupabasePublicConfig();
  browserClient = createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}
