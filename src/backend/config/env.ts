import {
  resolveDatabaseUrl,
  resolveSupabaseServiceRoleKey,
} from "../../lib/vercel-env";
import { MODEL_CONFIG, normalizeUpstreamModelSlug } from "../../lib/model-config";

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

/** First non-empty env value among names (server-only secrets). */
function firstOptional(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

const isVercel = optional("VERCEL", "") === "1";
const isProduction = process.env.NODE_ENV === "production" || isVercel;

const PROVIDER = MODEL_CONFIG.providerEnv;

const providerApiKey = firstOptional(
  PROVIDER.apiKey,
  "NOVITA_AI_KEY",
  "NOVITA_API_KEY",
);

/** Primary chat / inference model from Provider_Model_Clauxen_V1. */
const providerModelClauxenV1 = normalizeUpstreamModelSlug(
  firstOptional(PROVIDER.modelClauxenV1, "SHIROVA_DEFAULT_MODEL"),
  MODEL_CONFIG.models.virgil.defaultSlug,
);

const providerOpenAiBaseUrl = normalizeBaseUrl(
  firstOptional(
    PROVIDER.baseUrl,
    "NOVITA_OPENAI_BASE_URL",
    "LLM_BASE_URL",
  ) || MODEL_CONFIG.endpoints.providerOpenAiBaseUrl,
);

export const env = {
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:9002"),
  authRequiredForChat: optional("AUTH_REQUIRED_FOR_CHAT", "false") === "true",
  // ponytail: on Vercel default to false — production must use Supabase GoTrue
  authDevBypass:
    optional("AUTH_DEV_BYPASS", isVercel ? "false" : "true") === "true",
  databaseUrl: resolveDatabaseUrl(),
  supabaseServiceRoleKey: resolveSupabaseServiceRoleKey(),

  /**
   * Inference API key — Provider_API_Key (Vercel sensitive).
   * Legacy NOVITA_* aliases accepted only as fallback for local migration.
   */
  providerApiKey,
  /** @deprecated Use providerApiKey */
  novitaApiKey: providerApiKey,

  novitaAnthropicBaseUrl: normalizeBaseUrl(
    firstOptional(
      PROVIDER.baseUrl,
      "NOVITA_ANTHROPIC_BASE_URL",
      "LLM_BASE_URL",
    ) || providerOpenAiBaseUrl,
  ),
  novitaOpenAiBaseUrl: providerOpenAiBaseUrl,
  /** Alias for OpenAI-compatible provider base URL. */
  providerBaseUrl: providerOpenAiBaseUrl,

  /** Homer — uses Provider_Model_Clauxen_V1 unless a legacy override exists. */
  homerModel: normalizeUpstreamModelSlug(
    firstOptional(PROVIDER.modelClauxenV1, MODEL_CONFIG.models.homer.envKey),
    MODEL_CONFIG.models.homer.defaultSlug,
  ),
  heliosModel: normalizeUpstreamModelSlug(
    firstOptional(PROVIDER.modelClauxenV1, MODEL_CONFIG.models.helios.envKey),
    MODEL_CONFIG.models.helios.defaultSlug,
  ),
  virgilModel: normalizeUpstreamModelSlug(
    firstOptional(PROVIDER.modelClauxenV1, MODEL_CONFIG.models.virgil.envKey),
    MODEL_CONFIG.models.virgil.defaultSlug,
  ),
  thinkingModel: normalizeUpstreamModelSlug(
    firstOptional(PROVIDER.modelClauxenV1, MODEL_CONFIG.models.thinking.envKey),
    MODEL_CONFIG.models.thinking.defaultSlug,
  ),
  openAiFastModel: normalizeUpstreamModelSlug(
    firstOptional(PROVIDER.modelClauxenV1, MODEL_CONFIG.models.fast.envKey),
    MODEL_CONFIG.models.fast.defaultSlug,
  ),
  novitaMessagesUrl: optional("SHIROVA_NOVITA_MESSAGES_URL", ""),
  novitaModelsUrl: optional("NOVITA_MODELS_URL", ""),
  defaultSandboxTimeoutMs: Number(
    firstOptional(PROVIDER.sandboxTimeoutMs, "NOVITA_SANDBOX_TIMEOUT_MS") ||
      "300000",
  ),
  defaultModel: providerModelClauxenV1,
  /** Exa web search — EXA_API_KEY from Vercel / .env.local (server-only). */
  exaApiKey: firstOptional("EXA_API_KEY"),
  falKey: optional("FAL_KEY"),
  parallelApiKey: optional("PARALLEL_API_KEY"),
  googlePlacesApiKey: optional("GOOGLE_PLACES_API_KEY"),
  openAiApiKey: optional("OPENAI_API_KEY"),
  /** Kimi thinking: enabled | disabled -> Anthropic extended thinking. */
  thinkingType:
    optional("SHIROVA_THINKING_TYPE", "disabled") === "enabled"
      ? ("enabled" as const)
      : ("disabled" as const),
  razorpayKeyId: optional("RAZORPAY_KEY_ID"),
  razorpayKeySecret: optional("RAZORPAY_KEY_SECRET"),
  razorpayWebhookSecret: optional("RAZORPAY_WEBHOOK_SECRET"),
  publicRazorpayKeyId: optional("NEXT_PUBLIC_RAZORPAY_KEY_ID"),
  applePayDomainAssociation: optional("APPLE_PAY_DOMAIN_ASSOCIATION"),
  checkoutUsdInrRate: optional("CHECKOUT_USD_INR_RATE"),
  sessionCookieName: "clauxen_session",
  jwtSecret: optional(
    "JWT_SECRET",
    isProduction ? "" : "dev-jwt-secret-change-me",
  ),

  isProduction,
  isVercel,

  // Cloudflare account (dashboard → Account ID)
  r2AccountId: optional("R2_ACCOUNT_ID"),
  /** Cloudflare API token — CI/admin (bucket management); not used for S3 uploads at runtime. */
  r2ApiToken: optional("R2_API_TOKEN") || optional("CLOUDFLARE_API_TOKEN"),
  /** S3-compatible credentials from R2 → Manage R2 API Tokens */
  r2AccessKeyId: optional("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: optional("R2_SECRET_ACCESS_KEY"),
  /**
   * S3 API endpoint from Cloudflare R2 dashboard (e.g. https://<account_id>.r2.cloudflarestorage.com).
   * Falls back to R2_ACCOUNT_ID when unset.
   */
  r2S3Endpoint: optional("R2_S3_ENDPOINT"),
  /** Optional public base URL for signed/public object delivery (custom domain or r2.dev). */
  r2PublicBaseUrl: optional("R2_PUBLIC_BASE_URL"),
  workerUrl: optional("WORKER_URL"),
  /** Cloudflare chat-history Worker (keyset pages via Hyperdrive). */
  chatHistoryWorkerUrl: normalizeBaseUrl(
    optional("CHAT_HISTORY_WORKER_URL") || optional("NEXT_PUBLIC_CHAT_HISTORY_WORKER_URL"),
  ),
  /** Shared secret for Worker /internal/warm write-through. */
  chatHistoryInternalToken: optional("CHAT_HISTORY_INTERNAL_TOKEN"),

  r2ImagesBucket: optional("R2_IMAGES_BUCKET", "clauxen-images"),
  r2DocumentsBucket: optional(
    "R2_DOCUMENTS_BUCKET",
    optional("R2_USER_FILES_BUCKET", "clauxen-documents"),
  ),
  r2ArtifactsBucket: optional("R2_ARTIFACTS_BUCKET", "clauxen-artifacts"),
  r2SkillsBucket: optional("R2_SKILLS_BUCKET", "clauxen-skills"),
  r2ChatArchivesBucket: optional(
    "R2_CHAT_ARCHIVES_BUCKET",
    "clauxen-chat-archives",
  ),
  /** @deprecated Use R2_DOCUMENTS_BUCKET */
  r2UserFilesBucket: optional(
    "R2_USER_FILES_BUCKET",
    optional("R2_DOCUMENTS_BUCKET", "clauxen-documents"),
  ),

  storageLocalPath: optional("STORAGE_LOCAL_PATH", "./storage/r2-fallback"),
  /** When true (default on Vercel), object storage must use R2 — no local disk fallback. */
  storageRequireR2:
    optional("STORAGE_REQUIRE_R2", "") === "true" ||
    optional("VERCEL", "") === "1",
};

export function requireDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  if (!url) {
    throw new Error(
      "Database URL is not configured. Set POSTGRES_URL_NON_POOLING or DATABASE_URL.",
    );
  }
  return url;
}

/** Server-only inference API key (Provider_API_Key). */
export function requireProviderApiKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("Provider credentials are server-only.");
  }
  const key = env.providerApiKey;
  if (!key) {
    throw new Error(
      `${PROVIDER.apiKey} is not configured on the server.`,
    );
  }
  return key;
}

/** @deprecated Use requireProviderApiKey */
export function requireNovitaApiKey(): string {
  return requireProviderApiKey();
}

export function requireProviderBaseUrl(): string {
  if (typeof window !== "undefined") {
    throw new Error("Provider base URL is server-only.");
  }
  const url = env.providerBaseUrl;
  if (!url) {
    throw new Error(
      `${PROVIDER.baseUrl} is not configured on the server.`,
    );
  }
  return url;
}

/** Server-only Exa API key (EXA_API_KEY). */
export function requireExaApiKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("Exa credentials are server-only.");
  }
  const key = env.exaApiKey;
  if (!key) {
    throw new Error("EXA_API_KEY is not configured on the server.");
  }
  return key;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.databaseUrl);
}

export function isR2Configured(): boolean {
  return Boolean(
    env.r2AccessKeyId &&
      env.r2SecretAccessKey &&
      (env.r2S3Endpoint || env.r2AccountId),
  );
}

export function requireR2InProduction(): void {
  if (env.storageRequireR2 && !isR2Configured()) {
    throw new Error(
      "R2 object storage is required in production. Set R2_S3_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    );
  }
}

export function getR2S3Endpoint(): string {
  if (env.r2S3Endpoint) {
    return normalizeBaseUrl(env.r2S3Endpoint);
  }
  if (env.r2AccountId) {
    return `https://${env.r2AccountId}.r2.cloudflarestorage.com`;
  }
  throw new Error("R2_S3_ENDPOINT or R2_ACCOUNT_ID is not configured.");
}
