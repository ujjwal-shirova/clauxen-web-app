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
     * Prefer Provider_BASE_URL in Vercel / .env.local (…/openai or …/anthropic).
     */
    providerOpenAiBaseUrl: "",

    /** @deprecated Prefer Provider_BASE_URL */
    novitaOpenAiBaseUrl: "",

    /** @deprecated Prefer Provider_BASE_URL; Anthropic path is derived server-side */
    novitaAnthropicBaseUrl: "",

    /** @deprecated */
    novitaMessagesUrl: "",
  },

  // ==========================================
  // 2. Upstream Model Slugs (Default Slugs)
  // ==========================================
  models: {
    /** Homer — most capable (optional override) */
    homer: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "Provider_Model_Clauxen_V1",
    },

    /** Helios — everyday work */
    helios: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "Provider_Model_Clauxen_V1",
    },

    /** Virgil — default chat model */
    virgil: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "Provider_Model_Clauxen_V1",
    },

    /** Interleaved-thinking agent model */
    thinking: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "Provider_Model_Clauxen_V1",
    },

    /** Fast chat path */
    fast: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "Provider_Model_Clauxen_V1",
    },
  },

  // ==========================================
  // 3. Model Display Metadata
  // ==========================================
  metadata: {
    homer: {
      label: "Homer",
      shortLabel: "Homer",
      description: "Most capable for ambitious work",
      available: true,
      requiresUpgrade: true,
    },
    helios: {
      label: "Helios",
      shortLabel: "Helios",
      description: "Responsive everyday work",
      available: true,
      requiresUpgrade: false,
    },
    virgil: {
      label: "Virgil 1.1",
      shortLabel: "Virgil 1.1",
      description: "Autonomous chat and tool orchestration",
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
    modelClauxenV1: "Provider_Model_Clauxen_V1",
  },
} as const;

/** Upstream slugs that are no longer served — remapped at runtime. */
const DEPRECATED_MODEL_SLUGS: Record<string, string> = {
  "nex-agi/nex-n2-pro": "moonshotai/kimi-k2.6",
  "tencent/hy3": "moonshotai/kimi-k2.6",
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
