/**
 * Product model catalog — single source of truth for Homer, Helios, Virgil.
 * Each entry has its own upstream base URL and model slug (overridable via env).
 */

export type ChatModelId = "homer" | "helios" | "virgil";

export type InferenceProviderKind = "openai";

export type ModelCatalogEntry = {
  id: ChatModelId;
  label: string;
  shortLabel: string;
  description: string;
  provider: InferenceProviderKind;
  /** Default Novita upstream model id */
  defaultModelSlug: string;
  /** Env var for model slug override */
  modelEnvKey: string;
  /** Env var for API base URL override */
  baseUrlEnvKey: string;
  /** Fallback base URL when env override is unset */
  defaultBaseUrl: string;
  available: boolean;
  requiresUpgrade?: boolean;
};

export const MODEL_CATALOG: readonly ModelCatalogEntry[] = [
  {
    id: "homer",
    label: "Homer 4.7",
    shortLabel: "Homer",
    description: "Most capable for ambitious work",
    provider: "openai",
    defaultModelSlug: "moonshotai/kimi-k2.6",
    modelEnvKey: "SHIROVA_HOMER_MODEL",
    baseUrlEnvKey: "NOVITA_OPENAI_BASE_URL",
    defaultBaseUrl: "https://api.novita.ai/openai",
    available: true,
    requiresUpgrade: true,
  },
  {
    id: "helios",
    label: "Helios 4.6",
    shortLabel: "Helios",
    description: "Responsive everyday work",
    provider: "openai",
    defaultModelSlug: "nex-agi/nex-n2-pro",
    modelEnvKey: "SHIROVA_HELIOS_MODEL",
    baseUrlEnvKey: "NOVITA_OPENAI_BASE_URL",
    defaultBaseUrl: "https://api.novita.ai/openai",
    available: true,
  },
  {
    id: "virgil",
    label: "Virgil 4.5",
    shortLabel: "Virgil",
    description: "Fastest, most efficient",
    provider: "openai",
    defaultModelSlug: "deepseek/deepseek_v3",
    modelEnvKey: "SHIROVA_VIRGIL_MODEL",
    baseUrlEnvKey: "NOVITA_OPENAI_BASE_URL",
    defaultBaseUrl: "https://api.novita.ai/openai",
    available: false,
  },
] as const;

export const DEFAULT_CHAT_MODEL_ID: ChatModelId = "helios";

export type ModelRuntimeConfig = {
  id: ChatModelId;
  label: string;
  provider: InferenceProviderKind;
  modelSlug: string;
  baseUrl: string;
};

export type ModelCatalogEnv = {
  novitaAnthropicBaseUrl: string;
  novitaOpenAiBaseUrl: string;
  homerModel: string;
  heliosModel: string;
  virgilModel: string;
  thinkingModel: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function readEnvOverride(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

function modelSlugForEntry(
  entry: ModelCatalogEntry,
  env: ModelCatalogEnv,
): string {
  const fromEnv = readEnvOverride(entry.modelEnvKey);
  if (fromEnv) return fromEnv;
  if (entry.id === "homer") return env.homerModel;
  if (entry.id === "helios") return env.heliosModel;
  return env.virgilModel;
}

function baseUrlForEntry(
  entry: ModelCatalogEntry,
  env: ModelCatalogEnv,
): string {
  const fromEnv = readEnvOverride(entry.baseUrlEnvKey);
  if (fromEnv) return normalizeBaseUrl(fromEnv);
  return normalizeBaseUrl(env.novitaOpenAiBaseUrl || entry.defaultBaseUrl);
}

export function getCatalogEntry(id: ChatModelId): ModelCatalogEntry {
  return (
    MODEL_CATALOG.find((entry) => entry.id === id) ??
    MODEL_CATALOG.find((entry) => entry.id === DEFAULT_CHAT_MODEL_ID)!
  );
}

export function parseChatModelId(value?: string | null): ChatModelId {
  if (value === "homer" || value === "helios" || value === "virgil") {
    return value;
  }
  return DEFAULT_CHAT_MODEL_ID;
}

export function resolveModelRuntime(
  chatModelId: ChatModelId | string | null | undefined,
  env: ModelCatalogEnv,
): ModelRuntimeConfig {
  const entry = getCatalogEntry(parseChatModelId(chatModelId));
  return {
    id: entry.id,
    label: entry.label,
    provider: entry.provider,
    modelSlug: modelSlugForEntry(entry, env),
    baseUrl: baseUrlForEntry(entry, env),
  };
}

/** UI selector options (frontend + API). */
export type ChatModelOption = {
  id: ChatModelId;
  label: string;
  shortLabel: string;
  description: string;
  requiresUpgrade?: boolean;
  available: boolean;
};

export const CHAT_MODEL_OPTIONS: readonly ChatModelOption[] = MODEL_CATALOG.map(
  (entry) => ({
    id: entry.id,
    label: entry.label,
    shortLabel: entry.shortLabel,
    description: entry.description,
    requiresUpgrade: entry.requiresUpgrade,
    available: entry.available,
  }),
);

export function getChatModelOption(id: ChatModelId): ChatModelOption {
  return (
    CHAT_MODEL_OPTIONS.find((option) => option.id === id) ??
    CHAT_MODEL_OPTIONS.find((option) => option.id === DEFAULT_CHAT_MODEL_ID)!
  );
}

/** @deprecated Use resolveModelRuntime().modelSlug */
export function resolveOpenAiModelId(
  chatModelId: ChatModelId,
  models: { homerModel: string; heliosModel: string },
): string {
  return resolveModelRuntime(chatModelId, {
    novitaAnthropicBaseUrl: "",
    novitaOpenAiBaseUrl: "",
    homerModel: models.homerModel,
    heliosModel: models.heliosModel,
    virgilModel: "deepseek/deepseek_v3",
    thinkingModel: "deepseek/deepseek-v4-pro",
  }).modelSlug;
}

export function modelCatalogEnvFromProcess(): ModelCatalogEnv {
  return {
    novitaAnthropicBaseUrl:
      readEnvOverride("NOVITA_ANTHROPIC_BASE_URL") ??
      "https://api.novita.ai/anthropic",
    novitaOpenAiBaseUrl:
      readEnvOverride("NOVITA_OPENAI_BASE_URL") ?? "https://api.novita.ai/openai",
    homerModel:
      readEnvOverride("SHIROVA_HOMER_MODEL") ?? "moonshotai/kimi-k2.6",
    heliosModel:
      readEnvOverride("SHIROVA_HELIOS_MODEL") ?? "nex-agi/nex-n2-pro",
    virgilModel:
      readEnvOverride("SHIROVA_VIRGIL_MODEL") ?? "deepseek/deepseek_v3",
    thinkingModel:
      readEnvOverride("SHIROVA_THINKING_MODEL") ?? "deepseek/deepseek-v4-pro",
  };
}
