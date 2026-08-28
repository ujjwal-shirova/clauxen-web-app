/**
 * Clauxen Model & Endpoint Configuration
 *
 * Single central file for model slugs, base URLs, and display metadata.
 * Secrets and upstream URLs come from server env (`Provider_*`) — never
 * NEXT_PUBLIC_* and never hardcode API keys here.
 */

export const MODEL_CONFIG = {
  // ==========================================
  // 1. Upstream Base Endpoints (fallbacks only)
  // ==========================================
  endpoints: {
    /**
     * Last-resort Provider base URL when Provider_BASE_URL is unset.
     * Prefer Provider_BASE_URL in Vercel / .env.local.
     */
    providerOpenAiBaseUrl: "https://api.novita.ai/openai",

    /** @deprecated Prefer Provider_BASE_URL */
    novitaOpenAiBaseUrl: "",

    /** @deprecated */
    novitaMessagesUrl: "",
  },

  // ==========================================
  // 2. Upstream Model Slugs (Default Slugs)
  // ==========================================
  models: {
    /** Homer — balanced medium model (optional override) */
    homer: {
      defaultSlug: "qwen/qwen3.8-2.4t-a95b",
      envKey: "Provider_Model_Homer",
    },

    /** Helios — smartest model */
    helios: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "Provider_Model_Helios",
    },

    /** Virgil — default chat model */
    virgil: {
      defaultSlug: "qwen/qwen3.8-flash",
      envKey: "Provider_Model_Virgil",
    },

    /** OpenAI reasoning model */
    thinking: {
      defaultSlug: "qwen/qwen3.8-flash",
      envKey: "Provider_Model_Virgil",
    },

    /** Fast chat path */
    fast: {
      defaultSlug: "qwen/qwen3.8-flash",
      envKey: "Provider_Model_Virgil",
    },
  },

  // ==========================================
  // 3. Model Display Metadata
  // ==========================================
  metadata: {
    homer: {
      label: "Homer",
      shortLabel: "Homer",
      description: "Balanced for complex tasks",
      available: true,
      requiresUpgrade: false,
    },
    helios: {
      label: "Helios",
      shortLabel: "Helios",
      description: "Smartest for demanding work",
      available: true,
      requiresUpgrade: false,
    },
    virgil: {
      label: "Virgil",
      shortLabel: "Virgil",
      description: "Fast for everyday tasks",
      available: true,
      requiresUpgrade: false,
    },
  },

  // ==========================================
  // 4. Default Selected Model
  // ==========================================
  defaultModelId: "virgil" as const,

  /** Canonical sensitive env keys for inference (server-only). */
  providerEnv: {
    apiKey: "Provider_API_Key",
    baseUrl: "Provider_BASE_URL",
    sandboxTimeoutMs: "Provider_SANDBOX_TIMEOUT_MS",
    modelVirgil: "Provider_Model_Virgil",
    modelHomer: "Provider_Model_Homer",
    modelHelios: "Provider_Model_Helios",
    /** Legacy one-model override retained for old deployments. */
    modelClauxenV1: "Provider_Model_Clauxen_V1",
  },
} as const;

/** Upstream slugs that are no longer served — remapped at runtime. */
const DEPRECATED_MODEL_SLUGS: Record<string, string> = {
  "nex-agi/nex-n2-pro": "gpt-5.6",
  "tencent/hy3": "gpt-5.6",
  "deepseek/deepseek_v3": "",
};

/**
 * Normalize an upstream model slug from env overrides or legacy config.
 * Empty string is returned for deprecated/removed models with no replacement.
 */
export function normalizeUpstreamModelSlug(
  slug: string | undefined | null,
  fallback: string,
): string {
  const trimmed = slug?.trim() ?? "";
  if (!trimmed) return fallback;
  const remapped = DEPRECATED_MODEL_SLUGS[trimmed];
  if (remapped !== undefined) return remapped || fallback;
  return trimmed;
}

export type ConfiguredModelId = "homer" | "helios" | "virgil";
