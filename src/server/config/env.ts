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

/**
 * Resolve Anthropic Messages API base URL from Provider_* env only.
 * Never hardcode vendor hosts — derive `/anthropic` from Provider_BASE_URL
 * when that env points at an OpenAI-compatible path (`…/openai`).
 */
function resolveAnthropicBaseUrl(): string {
  const dedicated = firstOptional(
    "NOVITA_ANTHROPIC_BASE_URL",
    "ANTHROPIC_BASE_URL",
  );
  if (dedicated) return normalizeBaseUrl(dedicated);

  const providerBase = firstOptional(
    PROVIDER.baseUrl,
    "NOVITA_OPENAI_BASE_URL",
    "LLM_BASE_URL",
  );
  if (!providerBase) {
    return normalizeBaseUrl(MODEL_CONFIG.endpoints.novitaAnthropicBaseUrl);
  }

  if (/\/anthropic\/?$/i.test(providerBase)) {
    return normalizeBaseUrl(providerBase);
  }

  // Provider_BASE_URL is often `https://…/openai` — map to Messages path.
  if (/\/openai\/?$/i.test(providerBase)) {
    return normalizeBaseUrl(providerBase.replace(/\/openai\/?$/i, "/anthropic"));
  }

  // Host-only or other path — append /anthropic.
  return normalizeBaseUrl(`${normalizeBaseUrl(providerBase)}/anthropic`);
}

function resolveAuthDevBypass(): boolean {
  // Never allow unsigned cookie bypass on Vercel / production.
  if (isProduction || isVercel) return false;
  // Local only when explicitly enabled in .env.local.
  return optional("AUTH_DEV_BYPASS", "false") === "true";
}

export const env = {
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:9002"),
  // Fail closed: chat/inference APIs require auth unless explicitly disabled.
  authRequiredForChat: optional("AUTH_REQUIRED_FOR_CHAT", "true") === "true",
  authDevBypass: resolveAuthDevBypass(),
  databaseUrl: resolveDatabaseUrl(),
  supabaseServiceRoleKey: resolveSupabaseServiceRoleKey(),

  /**
   * Inference API key — Provider_API_Key (Vercel sensitive).
   * Legacy NOVITA_* aliases accepted only as fallback for local migration.
   */
  providerApiKey,
  /** @deprecated Use providerApiKey */
  novitaApiKey: providerApiKey,

  novitaAnthropicBaseUrl: resolveAnthropicBaseUrl(),
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
  /**
   * UPI QR merchant profile — fallback construct when `image_content` is absent.
   * `pa` is the live Razorpay-issued VPA from Create QR `image_content`
   * (not invented). Prefer `image_content` for payments; Dashboard Checkout
   * Styling controls the logo GPay shows for this VPA.
   */
  razorpayUpiPa: optional(
    "RAZORPAY_UPI_PA",
    "shirovaaiprivat478370.rzp@rxairtel",
  ),
  razorpayUpiPn: optional("RAZORPAY_UPI_PN", "Shirova AI"),
  razorpayUpiTn: optional(
    "RAZORPAY_UPI_TN",
    "Payment To SHIROVA AI PRIVATE LIMITED",
  ),
  razorpayUpiMc: optional("RAZORPAY_UPI_MC", "5817"),
  razorpayUpiMode: optional("RAZORPAY_UPI_MODE", "22"),
  /** Appended to qr id (without `qr_` prefix) to form the UPI `tr` param. */
  razorpayUpiTrSuffix: optional("RAZORPAY_UPI_TR_SUFFIX", "qrv2"),
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

  /** Cloudflare chat-coord Worker (Durable Object generation leases). */
  chatCoordWorkerUrl: normalizeBaseUrl(optional("CHAT_COORD_WORKER_URL")),
  chatCoordInternalToken: optional("CHAT_COORD_INTERNAL_TOKEN"),

  /** Cloudflare auth-email Worker (OTP send/verify via Email Service). */
  authEmailWorkerUrl: normalizeBaseUrl(optional("AUTH_EMAIL_WORKER_URL")),
  /** Shared secret for auth-email Worker. */
  authEmailInternalToken: optional("AUTH_EMAIL_INTERNAL_TOKEN"),

  /** Cloudflare billing Worker (Razorpay proxy + invoice PDF). */
  billingWorkerUrl: normalizeBaseUrl(optional("BILLING_WORKER_URL")),
  /** Shared secret for billing Worker internal routes. */
  billingInternalToken: optional("BILLING_INTERNAL_TOKEN"),

  /**
   * Shared secret for scheduled-tasks cron dispatch
   * (`/api/v1/internal/scheduled-tasks/dispatch`).
   */
  scheduledTasksInternalToken: optional("SCHEDULED_TASKS_INTERNAL_TOKEN"),

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

/** Anthropic Messages path derived from Provider_BASE_URL (…/openai → …/anthropic). */
export function requireAnthropicBaseUrl(): string {
  if (typeof window !== "undefined") {
    throw new Error("Provider base URL is server-only.");
  }
  const url = env.novitaAnthropicBaseUrl;
  if (!url) {
    throw new Error(
      `${PROVIDER.baseUrl} (Anthropic path) is not configured on the server.`,
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
