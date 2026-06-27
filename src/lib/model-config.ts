/**
 * Clauxen Model & Endpoint Configuration
 *
 * This is the SINGLE CENTRAL FILE for configuring all model slugs, base URLs,
 * and display metadata for the single chat model: Virgil.
 *
 * Edit this file to easily change endpoints, default models, or descriptions.
 */

export const MODEL_CONFIG = {
  // ==========================================
  // 1. Upstream Base Endpoints (Base URLs)
  // ==========================================
  endpoints: {
    /** Novita OpenAI-compatible base URL */
    novitaOpenAiBaseUrl: "https://api.novita.ai/openai",

    /** Novita Anthropic-compatible base URL */
    novitaAnthropicBaseUrl: "https://api.novita.ai/anthropic",

    /** Novita Anthropic Messages endpoint */
    novitaMessagesUrl: "https://api.novita.ai/anthropic/v1/messages",
  },

  // ==========================================
  // 2. Upstream Model Slugs (Default Slugs)
  // ==========================================
  models: {
    /** Homer — Most capable model for ambitious work (GLM-5.2) */
    homer: {
      defaultSlug: "zai-org/glm-5.2",
      envKey: "SHIROVA_HOMER_MODEL",
    },

    /** Helios — Responsive model for everyday work (Kimi K2.6) */
    helios: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "SHIROVA_HELIOS_MODEL",
    },

    /** Virgil — single autonomous model (Kimi K2.6) */
    virgil: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "SHIROVA_VIRGIL_MODEL",
    },

    /** Interleaved-thinking agent model (Kimi K2.6) */
    thinking: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "SHIROVA_THINKING_MODEL",
    },

    /** Fast chat path model (defaults to Helios) */
    fast: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "SHIROVA_OPENAI_FAST_MODEL",
    },
  },

  // ==========================================
  // 3. Model Display Metadata (Homer, Helios, Virgil)
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
      label: "Virgil",
      shortLabel: "Virgil",
      description: "Autonomous chat and tool orchestration",
      available: true,
      requiresUpgrade: false,
    },
  },

  // ==========================================
  // 4. Default Selected Model
  // ==========================================
  defaultModelId: "virgil" as const,
};

/** Upstream slugs that Novita no longer serves — remapped at runtime. */
const DEPRECATED_MODEL_SLUGS: Record<string, string> = {
  "nex-agi/nex-n2-pro": "moonshotai/kimi-k2.6",
  "deepseek/deepseek_v3": "",
};

/**
 * Normalize an upstream model slug from env overrides or legacy config.
 * Empty string is returned for deprecated/removed models with no replacement
 * (e.g. Virgil placeholder).
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
