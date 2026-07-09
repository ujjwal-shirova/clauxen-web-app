import { MODEL_CONFIG, normalizeUpstreamModelSlug } from "../../lib/model-config";

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export const env = {
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:9002"),
  authRequiredForChat: optional("AUTH_REQUIRED_FOR_CHAT", "false") === "true",
  authDevBypass: optional("AUTH_DEV_BYPASS", "true") === "true",
  databaseUrl: optional("DATABASE_URL"),
  novitaApiKey: optional("NOVITA_AI_KEY") || optional("NOVITA_API_KEY"),
  novitaAnthropicBaseUrl: normalizeBaseUrl(
    optional("NOVITA_ANTHROPIC_BASE_URL", MODEL_CONFIG.endpoints.novitaAnthropicBaseUrl),
  ),
  novitaOpenAiBaseUrl: normalizeBaseUrl(
    optional("NOVITA_OPENAI_BASE_URL", MODEL_CONFIG.endpoints.novitaOpenAiBaseUrl),
  ),
  /** Homer — GLM-5.2 on Novita OpenAI-compatible path. */
  homerModel: normalizeUpstreamModelSlug(
    optional(MODEL_CONFIG.models.homer.envKey),
    MODEL_CONFIG.models.homer.defaultSlug,
  ),
  /** Helios — Kimi K2.6 on Novita OpenAI-compatible path. */
  heliosModel: normalizeUpstreamModelSlug(
    optional(MODEL_CONFIG.models.helios.envKey),
    MODEL_CONFIG.models.helios.defaultSlug,
  ),
  virgilModel: normalizeUpstreamModelSlug(
    optional(MODEL_CONFIG.models.virgil.envKey),
    MODEL_CONFIG.models.virgil.defaultSlug,
  ),
  /** Interleaved-thinking agent model on Novita chat/completions. */
  thinkingModel: normalizeUpstreamModelSlug(
    optional(MODEL_CONFIG.models.thinking.envKey),
    MODEL_CONFIG.models.thinking.defaultSlug,
  ),
  /** Model for OpenAI-compatible fast chat path (Helios default). */
  openAiFastModel: normalizeUpstreamModelSlug(
    optional(MODEL_CONFIG.models.fast.envKey),
    MODEL_CONFIG.models.fast.defaultSlug,
  ),
  novitaMessagesUrl: optional(
    "SHIROVA_NOVITA_MESSAGES_URL",
    MODEL_CONFIG.endpoints.novitaMessagesUrl,
  ),
  novitaModelsUrl: optional("NOVITA_MODELS_URL", ""),
  defaultSandboxTimeoutMs: Number(
    optional("NOVITA_SANDBOX_TIMEOUT_MS", "300000"),
  ),
  defaultModel: normalizeUpstreamModelSlug(
    optional("SHIROVA_DEFAULT_MODEL"),
    MODEL_CONFIG.models.helios.defaultSlug,
  ),
  exaApiKey: optional("EXA_API_KEY"),
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
  jwtSecret: optional("JWT_SECRET", "dev-jwt-secret-change-me"),

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
  return required("DATABASE_URL");
}

export function requireNovitaApiKey(): string {
  const key = env.novitaApiKey;
  if (!key) {
    throw new Error("NOVITA_AI_KEY is not configured on the server.");
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
