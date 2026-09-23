/**
 * Vercel + Supabase marketplace env resolution.
 * ponytail: one canonical key set (33) — code reads integration names with fallbacks.
 */

/** Keys the user fills in Vercel dashboard (sync script seeds empty). */
export const USER_FILL_ENV_KEYS = new Set([
  "POSTGRES_DATABASE",
  "POSTGRES_HOST",
  "POSTGRES_PASSWORD",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_USER",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_JWT_SECRET",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]);

/** Exact keys on Vercel — one sensitive row each where applicable. */
export const CANONICAL_VERCEL_ENV_KEYS = [
  ...USER_FILL_ENV_KEYS,
  "AUTH_DEV_BYPASS",
  "AUTH_REQUIRED_FOR_CHAT",
  "STORAGE_REQUIRE_R2",
  "DATABASE_POOL_MAX",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT",
  "JWT_SECRET",
  "Provider_API_Key",
  "Provider_BASE_URL",
  "Provider_SANDBOX_TIMEOUT_MS",
  "Provider_Model_Virgil",
  "Provider_Model_Homer",
  "Provider_Model_Clauxen_V1",
  "EXA_API_KEY",
  "Assembly_Provider_Key",
  "ASSEMBLYAI_STREAMING_HOST",
  "R2_AUDIO_RECORDINGS_BUCKET",
  "FAL_KEY",
  "PARALLEL_API_KEY",
  "SHIROVA_THINKING_TYPE",
  "R2_IMAGES_BUCKET",
  "R2_DOCUMENTS_BUCKET",
  "R2_ARTIFACTS_BUCKET",
  "WORKER_URL",
  "NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL",
  "CHAT_HISTORY_WORKER_URL",
  "CHAT_HISTORY_INTERNAL_TOKEN",
  "CHAT_COORD_WORKER_URL",
  "CHAT_COORD_INTERNAL_TOKEN",
  "BILLING_WORKER_URL",
  "BILLING_INTERNAL_TOKEN",
  "SHARE_WORKER_URL",
  "NEXT_PUBLIC_SHARE_WORKER_URL",
  "SHARE_WORKER_INTERNAL_TOKEN",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "EDGE_CONFIG",
] as const;

const BLANK_RE =
  /^$|^__FILL_IN_VERCEL_DASHBOARD__$|^YOUR_|change-me-in-production|CHANGEME/i;

export function isBlankEnvValue(value: string | undefined | null): boolean {
  const v = value?.trim() ?? "";
  return !v || BLANK_RE.test(v);
}

function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (!isBlankEnvValue(value)) return value!;
  }
  return "";
}

/**
 * Next.js only inlines `NEXT_PUBLIC_*` when accessed as static property reads
 * (`process.env.NEXT_PUBLIC_FOO`). Dynamic `process.env[name]` is empty in the
 * browser bundle — that caused "Supabase browser auth is not configured."
 */
function firstPublicEnv(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (!isBlankEnvValue(trimmed)) return trimmed!;
  }
  return "";
}

function isSupabasePoolerUrl(value: string, port: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname.endsWith(".pooler.supabase.com") && url.port === port;
  } catch {
    return false;
  }
}

/**
 * Serverless functions should prefer Supabase's transaction pooler (6543).
 * A session-pooler URL on 5432 can exhaust client slots when Vercel creates
 * several isolates, so use it only when no safer candidate is provisioned.
 */
function firstDatabaseEnv(...names: string[]): string {
  const candidates = names
    .map((name) => process.env[name]?.trim() ?? "")
    .filter((value) => !isBlankEnvValue(value));
  return (
    candidates.find((value) => isSupabasePoolerUrl(value, "6543")) ??
    candidates.find((value) => !isSupabasePoolerUrl(value, "5432")) ??
    candidates[0] ??
    ""
  );
}

/** Map Vercel Supabase integration vars → app aliases at runtime. */
export function bootstrapVercelEnvAliases(): void {
  if (isBlankEnvValue(process.env.DATABASE_URL)) {
    const url = firstDatabaseEnv(
      "POSTGRES_URL",
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL_NON_POOLING",
    );
    if (url) process.env.DATABASE_URL = url;
  }

  if (isBlankEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    const url = firstEnv("SUPABASE_URL");
    if (url) process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  }

  if (isBlankEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    const key = firstEnv(
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    if (key) process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
  }

  if (isBlankEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    const key = firstEnv("SUPABASE_SECRET_KEY");
    if (key) process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  }

  // Inference: prefer Provider_* names; mirror legacy NOVITA_* only when unset.
  if (isBlankEnvValue(process.env.Provider_API_Key)) {
    const key = firstEnv("NOVITA_AI_KEY", "NOVITA_API_KEY");
    if (key) process.env.Provider_API_Key = key;
  }
  if (isBlankEnvValue(process.env.Provider_BASE_URL)) {
    const url = firstEnv("NOVITA_OPENAI_BASE_URL", "LLM_BASE_URL");
    if (url) process.env.Provider_BASE_URL = url;
  }
  if (isBlankEnvValue(process.env.Provider_SANDBOX_TIMEOUT_MS)) {
    const ms = firstEnv("NOVITA_SANDBOX_TIMEOUT_MS");
    if (ms) process.env.Provider_SANDBOX_TIMEOUT_MS = ms;
  }
  if (isBlankEnvValue(process.env.Provider_Model_Clauxen_V1)) {
    const model = firstEnv(
      "SHIROVA_DEFAULT_MODEL",
      "SHIROVA_VIRGIL_MODEL",
      "LLM_MODEL",
    );
    if (model) process.env.Provider_Model_Clauxen_V1 = model;
  }
  if (isBlankEnvValue(process.env.Provider_Model_Virgil)) {
    const model = firstEnv("SHIROVA_VIRGIL_MODEL", "Provider_Model_Clauxen_V1");
    if (model) process.env.Provider_Model_Virgil = model;
  }
  if (isBlankEnvValue(process.env.Provider_Model_Homer)) {
    const model = firstEnv("SHIROVA_HOMER_MODEL", "Provider_Model_Clauxen_V1");
    if (model) process.env.Provider_Model_Homer = model;
  }

  // Sandbox SDK still reads NOVITA_API_KEY — mirror Provider key server-side only.
  if (
    isBlankEnvValue(process.env.NOVITA_API_KEY) &&
    !isBlankEnvValue(process.env.Provider_API_Key)
  ) {
    process.env.NOVITA_API_KEY = process.env.Provider_API_Key;
  }
}

export function resolveDatabaseUrl(): string {
  return firstDatabaseEnv(
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
  );
}

export function resolveSupabaseServiceRoleKey(): string {
  return firstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}

export function resolveSupabaseUrl(): string {
  // Public keys: static reads for browser; server-only names via firstEnv.
  return (
    firstPublicEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    firstEnv("SUPABASE_URL")
  );
}

export function resolveSupabasePublicKey(): string {
  return (
    firstPublicEnv(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ) || firstEnv("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY")
  );
}

// ponytail: run once on server import — safe no-op on client (only reads process.env)
bootstrapVercelEnvAliases();
