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

/** Exact 33 keys on Vercel — one sensitive row each (production, preview, development). */
export const CANONICAL_VERCEL_ENV_KEYS = [
  ...USER_FILL_ENV_KEYS,
  "AUTH_DEV_BYPASS",
  "AUTH_REQUIRED_FOR_CHAT",
  "STORAGE_REQUIRE_R2",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_AUTH_REQUIRED_FOR_CHAT",
  "JWT_SECRET",
  "NOVITA_AI_KEY",
  "NOVITA_OPENAI_BASE_URL",
  "NOVITA_SANDBOX_TIMEOUT_MS",
  "EXA_API_KEY",
  "FAL_KEY",
  "PARALLEL_API_KEY",
  "SHIROVA_DEFAULT_MODEL",
  "SHIROVA_GATEWAY_KEY",
  "SHIROVA_THINKING_TYPE",
  "R2_IMAGES_BUCKET",
  "R2_DOCUMENTS_BUCKET",
  "R2_ARTIFACTS_BUCKET",
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

/** Map Vercel Supabase integration vars → app aliases at runtime. */
export function bootstrapVercelEnvAliases(): void {
  if (isBlankEnvValue(process.env.DATABASE_URL)) {
    const url = firstEnv(
      "POSTGRES_URL_NON_POOLING",
      "POSTGRES_PRISMA_URL",
      "POSTGRES_URL",
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
}

export function resolveDatabaseUrl(): string {
  return firstEnv(
    "DATABASE_URL",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
  );
}

export function resolveSupabaseServiceRoleKey(): string {
  return firstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}

export function resolveSupabaseUrl(): string {
  return firstEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
}

export function resolveSupabasePublicKey(): string {
  return firstEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  );
}

// ponytail: run once on server import — safe no-op on client (only reads process.env)
bootstrapVercelEnvAliases();
