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

export const env = {
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:9002"),
  authRequiredForChat: optional("AUTH_REQUIRED_FOR_CHAT", "false") === "true",
  authDevBypass: optional("AUTH_DEV_BYPASS", "true") === "true",
  cockroachDatabaseUrl: optional("COCKROACH_DATABASE_URL"),
  novitaApiKey: optional("NOVITA_AI_KEY") || optional("NOVITA_API_KEY"),
  novitaAnthropicBaseUrl: optional(
    "NOVITA_ANTHROPIC_BASE_URL",
    "https://api.novita.ai/anthropic",
  ),
  novitaMessagesUrl: optional(
    "SHIROVA_NOVITA_MESSAGES_URL",
    "https://api.novita.ai/anthropic/v1/messages",
  ),
  novitaModelsUrl: optional("NOVITA_MODELS_URL", ""),
  defaultSandboxTimeoutMs: Number(
    optional("NOVITA_SANDBOX_TIMEOUT_MS", "300000"),
  ),
  defaultModel: optional("SHIROVA_DEFAULT_MODEL", "moonshotai/kimi-k2.6"),
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
  oryKratosPublicUrl: optional("ORY_KRATOS_PUBLIC_URL"),
  oryKratosAdminUrl: optional("ORY_KRATOS_ADMIN_URL"),
  oryHydraPublicUrl: optional("ORY_HYDRA_PUBLIC_URL"),
  oryHydraAdminUrl: optional("ORY_HYDRA_ADMIN_URL"),
  oryHydraClientId: optional("ORY_HYDRA_CLIENT_ID", "clauxen-web"),
  oryHydraClientSecret: optional("ORY_HYDRA_CLIENT_SECRET"),
  oryHydraRedirectUri: optional("ORY_HYDRA_REDIRECT_URI"),
  oryKratosWebhookSecret: optional("ORY_KRATOS_WEBHOOK_SECRET"),
  sessionCookieName: "clauxen_session",
};

export function requireDatabaseUrl(): string {
  return required("COCKROACH_DATABASE_URL");
}

export function requireNovitaApiKey(): string {
  const key = env.novitaApiKey;
  if (!key) {
    throw new Error("NOVITA_AI_KEY is not configured on the server.");
  }
  return key;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.cockroachDatabaseUrl);
}

export function isOryConfigured(): boolean {
  return Boolean(env.oryKratosPublicUrl);
}

export function isHydraConfigured(): boolean {
  return Boolean(env.oryHydraPublicUrl && env.oryHydraClientId);
}
