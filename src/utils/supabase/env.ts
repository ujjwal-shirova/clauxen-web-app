export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
}

export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function getSupabasePublicConfig() {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    return {
      error: "Supabase browser auth is not configured.",
      url: null,
      publishableKey: null,
    };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      return {
        error: "NEXT_PUBLIC_SUPABASE_URL must be an HTTPS URL.",
        url: null,
        publishableKey: null,
      };
    }
  } catch {
    return {
      error: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL.",
      url: null,
      publishableKey: null,
    };
  }

  return { error: null, url, publishableKey };
}

export function requireSupabasePublicConfig() {
  const config = getSupabasePublicConfig();
  if (config.error || !config.url || !config.publishableKey) {
    throw new Error(config.error ?? "Supabase browser auth is not configured.");
  }
  return config;
}
