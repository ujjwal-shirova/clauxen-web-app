/**
 * Clauxen Model & Endpoint Configuration
 * 
 * This is the SINGLE CENTRAL FILE for configuring all model slugs, base URLs,
 * and display metadata for the three models: Homer, Helios, and Virgil.
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
    /** Homer — Most capable model for ambitious work (Kimi K2.6) */
    homer: {
      defaultSlug: "moonshotai/kimi-k2.6",
      envKey: "SHIROVA_HOMER_MODEL",
    },

    /** Helios — Responsive model for everyday work (Nex-AGI N2 Pro) */
    helios: {
      defaultSlug: "nex-agi/nex-n2-pro",
      envKey: "SHIROVA_HELIOS_MODEL",
    },

    /** Virgil — Fast and efficient model (DeepSeek V3) */
    virgil: {
      defaultSlug: "deepseek/deepseek_v3",
      envKey: "SHIROVA_VIRGIL_MODEL",
    },

    /** Interleaved-thinking agent model (DeepSeek V4 Pro) */
    thinking: {
      defaultSlug: "deepseek/deepseek-v4-pro",
      envKey: "SHIROVA_THINKING_MODEL",
    },

    /** Fast chat path model (defaults to Helios) */
    fast: {
      defaultSlug: "nex-agi/nex-n2-pro",
      envKey: "SHIROVA_OPENAI_FAST_MODEL",
    },
  },

  // ==========================================
  // 3. Model Display Metadata (Homer, Helios, Virgil)
  // ==========================================
  metadata: {
    homer: {
      label: "Homer 4.7",
      shortLabel: "Homer",
      description: "Most capable for ambitious work",
      available: true,
      requiresUpgrade: true,
    },
    helios: {
      label: "Helios 4.6",
      shortLabel: "Helios",
      description: "Responsive everyday work",
      available: true,
      requiresUpgrade: false,
    },
    virgil: {
      label: "Virgil 4.5",
      shortLabel: "Virgil",
      description: "Fastest, most efficient",
      available: false,
      requiresUpgrade: false,
    },
  },

  // ==========================================
  // 4. Default Selected Model
  // ==========================================
  defaultModelId: "helios" as const,
};

export type ConfiguredModelId = "homer" | "helios" | "virgil";
