function optional(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}
function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`); // config missing — server/route fail
  }
  return value; // validated env string return
}
export const env = {
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:9002"), // public app base URL
  authRequiredForChat: optional("AUTH_REQUIRED_FOR_CHAT", "false") === "true",
  authDevBypass: optional("AUTH_DEV_BYPASS", "true") === "true",
  cockroachDatabaseUrl: optional("COCKROACH_DATABASE_URL"), // CockroachDB connection string
  novitaApiKey: optional("NOVITA_AI_KEY") || optional("NOVITA_API_KEY"), // Novita inference API key
  novitaAnthropicBaseUrl: optional(
    "NOVITA_ANTHROPIC_BASE_URL",
    "https://api.novita.ai/anthropic",
  ),
  novitaMessagesUrl: optional(
    "SHIROVA_NOVITA_MESSAGES_URL",
    "https://api.novita.ai/anthropic/v1/messages",
  ),
  defaultModel: optional("SHIROVA_DEFAULT_MODEL", "moonshotai/kimi-k2.6"), // default LLM model id
  /** Kimi thinking: enabled | disabled -> Anthropic extended thinking. */
  thinkingType:
    optional("SHIROVA_THINKING_TYPE", "disabled") === "enabled"
      ? "enabled" // thinking mode on
      : "disabled", // thinking mode off
  razorpayKeyId: optional("RAZORPAY_KEY_ID"), // Razorpay server key id
  razorpayKeySecret: optional("RAZORPAY_KEY_SECRET"), // Razorpay server secret
  razorpayWebhookSecret: optional("RAZORPAY_WEBHOOK_SECRET"), // webhook signature verify secret
  publicRazorpayKeyId: optional("NEXT_PUBLIC_RAZORPAY_KEY_ID"), // client-side Razorpay key
  /** Raw file from Razorpay Dashboard → Apple Pay domain verification. */
  applePayDomainAssociation: optional("APPLE_PAY_DOMAIN_ASSOCIATION"),
  checkoutUsdInrRate: optional("CHECKOUT_USD_INR_RATE"),
  oryKratosPublicUrl: optional("ORY_KRATOS_PUBLIC_URL"), // Kratos public API base
  oryKratosAdminUrl: optional("ORY_KRATOS_ADMIN_URL"), // Kratos admin API base
  oryHydraPublicUrl: optional("ORY_HYDRA_PUBLIC_URL"), // Hydra OAuth public URL
  oryHydraAdminUrl: optional("ORY_HYDRA_ADMIN_URL"), // Hydra admin URL
  oryHydraClientId: optional("ORY_HYDRA_CLIENT_ID", "clauxen-web"), // OAuth client id
  oryHydraClientSecret: optional("ORY_HYDRA_CLIENT_SECRET"), // OAuth client secret
  oryHydraRedirectUri: optional("ORY_HYDRA_REDIRECT_URI"), // OAuth redirect URI
  oryKratosWebhookSecret: optional("ORY_KRATOS_WEBHOOK_SECRET"), // Kratos webhook HMAC secret
  sessionCookieName: "clauxen_session",
};
export function requireDatabaseUrl() {
  return required("COCKROACH_DATABASE_URL");
}
export function requireNovitaApiKey() {
  const key = env.novitaApiKey; // configured key read
  if (!key) {
    throw new Error("NOVITA_AI_KEY is not configured on the server.");
  }
  return key;
}
export function isDatabaseConfigured() {
  return Boolean(env.cockroachDatabaseUrl);
}
export function isOryConfigured() {
  return Boolean(env.oryKratosPublicUrl);
}
export function isHydraConfigured() {
  return Boolean(env.oryHydraPublicUrl && env.oryHydraClientId);
}
